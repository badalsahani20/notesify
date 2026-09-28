import { jest } from "@jest/globals";
import { WorkflowService } from "../../src/services/ai/workflow/workflowService.js";
import {
    InMemoryWorkflowRepository,
} from "../../src/services/ai/workflow/repository/inMemoryWorkflowRepository.js";

import {
    createWorkflow,
} from "../../src/services/ai/workflow/domain/workflowFactory.js";

import {
    WORKFLOW_STATUS,
    COMMAND,
    CHECKPOINT_STATUS,
    VERDICT,
} from "../../src/services/ai/workflow/domain/workflowConstants.js";

import {
    WORKFLOW_REPOSITORY_ERROR,
} from "../../src/services/ai/workflow/repository/workflowRepositoryErrors.js";

describe("WorkflowService", () => {
    let repository;
    let service;
    let workflow;

    beforeEach(async () => {
        repository = new InMemoryWorkflowRepository();
        service = new WorkflowService(repository);

        workflow = createWorkflow({
            title: "Learn MongoDB",
            userId: "user-1",
            phases: [
                {
                    id: "phase-1",
                    title: "Fundamentals",
                    tasks: [
                        {
                            id: "task-1",
                            title: "Documents",
                            concept: "MongoDB documents",
                            order: 1,
                        },
                    ],
                },
            ],
        });

        await repository.create(workflow);
    });

    it("executes a valid transition and persists the result", async () => {
        const result = await service.execute({
            workflowId: workflow.id,
            userId: "user-1",
            command: COMMAND.START_WORKFLOW,
            expectedVersion: 0,
        });

        expect(result.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(result.version).toBe(1);

        const stored = await repository.getById(
            workflow.id,
            "user-1",
        );

        expect(stored.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(stored.version).toBe(1);
    });

    it("rejects a stale client version", async () => {
        await expect(
            service.execute({
                workflowId: workflow.id,
                userId: "user-1",
                command: COMMAND.START_WORKFLOW,
                expectedVersion: 99,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        });

        const stored = await repository.getById(
            workflow.id,
            "user-1",
        );

        expect(stored.status).toBe(WORKFLOW_STATUS.DRAFT);
        expect(stored.version).toBe(0);
    });

    it("does not mutate the workflow when the transition itself is invalid", async () => {
        await expect(
            service.execute({
                workflowId: workflow.id,
                userId: "user-1",
                command: COMMAND.PAUSE_WORKFLOW,
                expectedVersion: 0,
            }),
        ).rejects.toThrow();

        const stored = await repository.getById(
            workflow.id,
            "user-1",
        );

        expect(stored.status).toBe(WORKFLOW_STATUS.DRAFT);
        expect(stored.version).toBe(0);
    });

    it("rejects access to a nonexistent workflow", async () => {
        await expect(
            service.execute({
                workflowId: "missing-workflow",
                userId: "user-1",
                command: COMMAND.START_WORKFLOW,
                expectedVersion: 0,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("does not allow one user to operate on another user's workflow", async () => {
        await expect(
            service.execute({
                workflowId: workflow.id,
                userId: "user-2",
                command: COMMAND.START_WORKFLOW,
                expectedVersion: 0,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("passes command payload to the transition engine", async () => {
        await service.execute({
            workflowId: workflow.id,
            userId: "user-1",
            command: COMMAND.START_WORKFLOW,
            expectedVersion: 0,
        });

        const result = await service.execute({
            workflowId: workflow.id,
            userId: "user-1",
            command: COMMAND.ACTIVATE_TASK,
            payload: {
                taskId: "task-1",
            },
            expectedVersion: 1,
        });

        expect(result.activeTaskId).toBe("task-1");
        expect(result.version).toBe(2);
    });

    it("creates a workflow through the repository", async () => {
        const created = await service.create(workflow);

        expect(created).toEqual(workflow);

        const stored = await repository.getById(
            workflow.id,
            workflow.userId,
        );

        expect(stored).toEqual(workflow);
    });

    it("gets a workflow by id", async () => {
        const result = await service.getById(
            workflow.id,
            workflow.userId,
        );

        expect(result).toEqual(workflow);
    });

    it("throws NOT_FOUND when getting a missing workflow", async () => {
        await expect(
            service.getById("missing-workflow", "user-1"),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("lists workflows for a user", async () => {
        await repository.create(workflow);

        await repository.create({
            ...workflow,
            id: "workflow-2",
            title: "Learn Docker",
        });

        const result = await service.listByUser("user-1");

        expect(result).toHaveLength(2);
    });

    it("deletes a workflow when expectedVersion matches", async () => {
        const result = await service.delete({
            workflowId: workflow.id,
            userId: "user-1",
            expectedVersion: 0,
        });

        expect(result).toBe(true);

        const stored = await repository.getById(workflow.id, "user-1");
        expect(stored).toBeNull();
    });

    it("rejects delete when workflow does not exist", async () => {
        await expect(
            service.delete({
                workflowId: "missing-workflow",
                userId: "user-1",
                expectedVersion: 0,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("rejects delete when user does not own the workflow", async () => {
        await expect(
            service.delete({
                workflowId: workflow.id,
                userId: "user-2",
                expectedVersion: 0,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("rejects delete when expectedVersion is stale", async () => {
        await expect(
            service.delete({
                workflowId: workflow.id,
                userId: "user-1",
                expectedVersion: 99,
            }),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        });

        const stored = await repository.getById(workflow.id, "user-1");
        expect(stored).not.toBeNull();
    });

    describe("submitAnswer", () => {
        let mockEvaluator;

        beforeEach(async () => {
            mockEvaluator = {
                evaluate: jest.fn(),
            };
            service = new WorkflowService(repository, mockEvaluator);

            // Transition workflow to ACTIVE, activate task-1, present checkpoint-1
            await service.execute({
                workflowId: workflow.id,
                userId: "user-1",
                command: COMMAND.START_WORKFLOW,
                expectedVersion: 0,
            });

            await service.execute({
                workflowId: workflow.id,
                userId: "user-1",
                command: COMMAND.ACTIVATE_TASK,
                payload: { taskId: "task-1" },
                expectedVersion: 1,
            });

            await service.execute({
                workflowId: workflow.id,
                userId: "user-1",
                command: COMMAND.PRESENT_CHECKPOINT,
                payload: {
                    taskId: "task-1",
                    checkpointId: "checkpoint-1",
                    question: "What is a document in MongoDB?",
                    evaluationSpec: {
                        expectedAnswer: "A record composed of field and value pairs in BSON format.",
                        keyConcepts: ["BSON", "field-value pairs"],
                        rubric: [{ criterion: "Explains BSON records", weight: 1.0 }],
                        commonMisconceptions: ["MongoDB stores SQL rows"],
                    },
                },
                expectedVersion: 2,
            });
        });

        it("orchestrates SUBMIT_ANSWER -> JEV -> EVALUATE_CHECKPOINT on success", async () => {
            mockEvaluator.evaluate.mockResolvedValue({
                verdict: VERDICT.PASSED,
                confidence: 0.95,
                feedback: "Excellent understanding of BSON documents.",
                misconceptions: [],
                criterionResults: [
                    { criterion: "Explains BSON records", passed: true, feedback: "Spot on." },
                ],
            });

            const result = await service.submitAnswer({
                workflowId: workflow.id,
                userId: "user-1",
                payload: {
                    checkpointId: "checkpoint-1",
                    answer: "A BSON document composed of field and value pairs.",
                },
                expectedVersion: 3,
            });

            // Evaluation should have received only checkpoint and answer
            expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(1);
            expect(mockEvaluator.evaluate).toHaveBeenCalledWith({
                checkpoint: expect.objectContaining({
                    id: "checkpoint-1",
                    question: "What is a document in MongoDB?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "A BSON document composed of field and value pairs.",
                }),
                userAnswer: "A BSON document composed of field and value pairs.",
            });

            // The workflow was transitioned twice (3 -> 4 for SUBMIT_ANSWER, 4 -> 5 for EVALUATE_CHECKPOINT)
            expect(result.version).toBe(5);

            // Since task-1 was the only task, passing it completes the workflow!
            expect(result.status).toBe(WORKFLOW_STATUS.COMPLETED);
            expect(result.checkpoints["checkpoint-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
            expect(result.checkpoints["checkpoint-1"].evaluation).toMatchObject({
                verdict: VERDICT.PASSED,
                confidence: 0.95,
                feedback: "Excellent understanding of BSON documents.",
            });

            // Verify stored in repository
            const stored = await repository.getById(workflow.id, "user-1");
            expect(stored.version).toBe(5);
            expect(stored.status).toBe(WORKFLOW_STATUS.COMPLETED);
            expect(stored.checkpoints["checkpoint-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
        });

        it("persists the answer when JEV evaluation fails, leaving workflow in ANSWERED state", async () => {
            mockEvaluator.evaluate.mockRejectedValue(new Error("JEV LLM failure"));

            await expect(
                service.submitAnswer({
                    workflowId: workflow.id,
                    userId: "user-1",
                    payload: {
                        checkpointId: "checkpoint-1",
                        answer: "My saved answer.",
                    },
                    expectedVersion: 3,
                }),
            ).rejects.toThrow("JEV LLM failure");

            // Verify the answer was persisted in repository at version 4, in ANSWERED state!
            const stored = await repository.getById(workflow.id, "user-1");
            expect(stored.version).toBe(4);
            expect(stored.status).toBe(WORKFLOW_STATUS.ACTIVE);
            expect(stored.checkpoints["checkpoint-1"].status).toBe(CHECKPOINT_STATUS.ANSWERED);
            expect(stored.checkpoints["checkpoint-1"].userAnswer).toBe("My saved answer.");
            expect(stored.checkpoints["checkpoint-1"].evaluation).toBeNull();
        });

        it("defaults checkpointId to workflow.activeCheckpointId when omitted in payload", async () => {
            mockEvaluator.evaluate.mockResolvedValue({
                verdict: VERDICT.PASSED,
                confidence: 0.9,
                feedback: "Good answer.",
                misconceptions: [],
                criterionResults: [],
            });

            const result = await service.submitAnswer({
                workflowId: workflow.id,
                userId: "user-1",
                payload: {
                    answer: "An answer without explicit checkpointId.",
                },
                expectedVersion: 3,
            });

            expect(result.checkpoints["checkpoint-1"].userAnswer).toBe("An answer without explicit checkpointId.");
            expect(result.checkpoints["checkpoint-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
        });

        it("rejects when workflow does not exist", async () => {
            await expect(
                service.submitAnswer({
                    workflowId: "missing-wf",
                    userId: "user-1",
                    payload: { answer: "test" },
                    expectedVersion: 0,
                }),
            ).rejects.toMatchObject({
                code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
            });
        });

        it("rejects when expectedVersion is stale before any mutation", async () => {
            await expect(
                service.submitAnswer({
                    workflowId: workflow.id,
                    userId: "user-1",
                    payload: { answer: "test" },
                    expectedVersion: 99,
                }),
            ).rejects.toMatchObject({
                code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            });

            const stored = await repository.getById(workflow.id, "user-1");
            expect(stored.version).toBe(3);
            expect(stored.checkpoints["checkpoint-1"].status).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);
        });

        it("rejects when checkpoint does not exist", async () => {
            await expect(
                service.submitAnswer({
                    workflowId: workflow.id,
                    userId: "user-1",
                    payload: { checkpointId: "nonexistent-cp", answer: "test" },
                    expectedVersion: 3,
                }),
            ).rejects.toThrow("Checkpoint nonexistent-cp not found.");
        });
    });
});