import mongoose from "mongoose";
import { jest } from "@jest/globals";
import Workflow from "../../src/models/workflow.model.js";
import { MongoWorkflowRepository } from "../../src/services/ai/workflow/repository/mongoWorkflowRepository.js";
import {
    WORKFLOW_REPOSITORY_ERROR,
} from "../../src/services/ai/workflow/repository/workflowRepositoryErrors.js";

describe("MongoWorkflowRepository", () => {
    let model;
    let repository;

    const workflow = {
        id: "workflow-1",
        userId: "user-1",
        sessionId: null,
        title: "Learn MongoDB",
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
        status: "DRAFT",
        activePhaseId: null,
        activeTaskId: null,
        activeCheckpointId: null,
        taskStates: {},
        checkpoints: {},
        version: 0,
    };

    beforeEach(() => {
        model = {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findOneAndUpdate: jest.fn(),
            findOneAndDelete: jest.fn(),
            exists: jest.fn(),
        };

        repository = new MongoWorkflowRepository(model);
    });

    it("creates a workflow and maps userId to user", async () => {
        const document = {
            ...workflow,
            user: "user-1",
            toObject: () => ({
                ...workflow,
                user: "user-1",
            }),
        };

        model.create.mockResolvedValue(document);

        const result = await repository.create(workflow);

        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "workflow-1",
                user: "user-1",
                title: "Learn MongoDB",
                version: 0,
            }),
        );

        expect(result.userId).toBe("user-1");
        expect(result.id).toBe("workflow-1");
    });

    it("Mongo mapping preserves evaluationSpec", async () => {
        const wfWithCheckpoint = {
            ...workflow,
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is an index?",
                    evaluationSpec: {
                        expectedAnswer: "Quick lookup structure",
                        keyConcepts: ["B-Tree", "Scan time"],
                        rubric: [
                            { criterion: "Accuracy", weight: 0.8 },
                            { criterion: "Clarity", weight: 0.2 },
                        ],
                        commonMisconceptions: ["No disk usage"],
                    },
                    status: "WAITING_FOR_ANSWER",
                    userAnswer: null,
                    evaluation: null,
                    presentedAt: new Date().toISOString(),
                    answeredAt: null,
                },
            },
        };

        const doc = {
            ...wfWithCheckpoint,
            user: "user-1",
            toObject: () => ({
                ...wfWithCheckpoint,
                user: "user-1",
            }),
        };

        model.create.mockResolvedValue(doc);

        const result = await repository.create(wfWithCheckpoint);

        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                checkpoints: expect.objectContaining({
                    "checkpoint-1": expect.objectContaining({
                        evaluationSpec: expect.objectContaining({
                            expectedAnswer: "Quick lookup structure",
                            keyConcepts: ["B-Tree", "Scan time"],
                            rubric: [
                                { criterion: "Accuracy", weight: 0.8 },
                                { criterion: "Clarity", weight: 0.2 },
                            ],
                            commonMisconceptions: ["No disk usage"],
                        }),
                    }),
                }),
            }),
        );

        expect(result.checkpoints["checkpoint-1"].evaluationSpec).toEqual({
            expectedAnswer: "Quick lookup structure",
            keyConcepts: ["B-Tree", "Scan time"],
            rubric: [
                { criterion: "Accuracy", weight: 0.8 },
                { criterion: "Clarity", weight: 0.2 },
            ],
            commonMisconceptions: ["No disk usage"],
        });
    });

    it("Mongo mapping preserves backwards compatibility when evaluationSpec is null", async () => {
        const legacyWorkflow = {
            ...workflow,
            checkpoints: {
                "checkpoint-old": {
                    id: "checkpoint-old",
                    taskId: "task-1",
                    question: "Legacy question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: null,
                },
            },
        };

        const doc = {
            ...legacyWorkflow,
            user: "user-1",
            toObject: () => ({
                ...legacyWorkflow,
                user: "user-1",
            }),
        };

        model.create.mockResolvedValue(doc);

        const result = await repository.create(legacyWorkflow);
        expect(result.checkpoints["checkpoint-old"].evaluationSpec).toBeNull();
    });

    it("gets a workflow by id and user", async () => {
        const document = {
            ...workflow,
            user: "user-1",
        };

        const lean = jest.fn().mockResolvedValue(document);

        model.findOne.mockReturnValue({
            lean,
        });

        const result = await repository.getById(
            "workflow-1",
            "user-1",
        );

        expect(model.findOne).toHaveBeenCalledWith({
            id: "workflow-1",
            user: "user-1",
        });

        expect(result).toEqual(
            expect.objectContaining({
                id: "workflow-1",
                userId: "user-1",
            }),
        );
    });

    it("returns null when getById cannot find the workflow", async () => {
        const lean = jest.fn().mockResolvedValue(null);

        model.findOne.mockReturnValue({
            lean,
        });

        const result = await repository.getById(
            "missing",
            "user-1",
        );

        expect(result).toBeNull();
    });

    it("lists workflows for a user", async () => {
        const documents = [
            {
                ...workflow,
                id: "workflow-1",
                user: "user-1",
            },
            {
                ...workflow,
                id: "workflow-2",
                user: "user-1",
                title: "Learn Docker",
            },
        ];

        const lean = jest.fn().mockResolvedValue(documents);

        const sort = jest.fn().mockReturnValue({
            lean,
        });

        model.find.mockReturnValue({
            sort,
        });

        const result = await repository.listByUser("user-1");

        expect(model.find).toHaveBeenCalledWith({
            user: "user-1",
        });

        expect(sort).toHaveBeenCalledWith({
            createdAt: -1,
        });

        expect(result).toHaveLength(2);
        expect(result[0].userId).toBe("user-1");
    });

    it("updates a workflow when expectedVersion matches", async () => {
        const updatedWorkflow = {
            ...workflow,
            status: "ACTIVE",
            version: 1,
        };

        const document = {
            ...updatedWorkflow,
            user: "user-1",
        };

        model.findOneAndUpdate.mockResolvedValue(document);

        const result = await repository.update(
            updatedWorkflow,
            updatedWorkflow.userId,
            0,
        );

        expect(model.findOneAndUpdate).toHaveBeenCalledWith(
            {
                id: "workflow-1",
                user: "user-1",
                version: 0,
            },
            {
                $set: expect.objectContaining({
                    status: "ACTIVE",
                    version: 1,
                }),
            },
            {
                new: true,
                runValidators: true,
            },
        );

        expect(result.version).toBe(1);
        expect(result.status).toBe("ACTIVE");
    });

    it("throws NOT_FOUND when update cannot find the workflow", async () => {
        model.findOneAndUpdate.mockResolvedValue(null);

        model.exists.mockResolvedValue(null);

        await expect(
            repository.update(workflow, workflow.userId, 0),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });

        expect(model.exists).toHaveBeenCalledWith({
            id: "workflow-1",
            user: "user-1",
        });
    });

    it("throws VERSION_CONFLICT when the workflow exists but version is stale", async () => {
        model.findOneAndUpdate.mockResolvedValue(null);

        model.exists.mockResolvedValue({
            _id: "mongo-id",
        });

        await expect(
            repository.update(
                {
                    ...workflow,
                    version: 1,
                },
                workflow.userId,
                0,
            ),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        });

        expect(model.findOneAndUpdate).toHaveBeenCalledWith(
            {
                id: "workflow-1",
                user: "user-1",
                version: 0,
            },
            expect.any(Object),
            expect.any(Object),
        );
    });

    it("writes the workflow version supplied by the transition result", async () => {
        const nextWorkflow = {
            ...workflow,
            status: "ACTIVE",
            version: 4,
        };

        const document = {
            ...nextWorkflow,
            user: "user-1",
        };

        model.findOneAndUpdate.mockResolvedValue(document);

        await repository.update(nextWorkflow, nextWorkflow.userId, 3);

        expect(model.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                version: 3,
            }),
            {
                $set: expect.objectContaining({
                    version: 4,
                }),
            },
            expect.any(Object),
        );
    });

    it("deletes a workflow when expectedVersion matches", async () => {
        model.findOneAndDelete.mockResolvedValue({ id: "workflow-1" });

        const result = await repository.delete("workflow-1", "user-1", 2);

        expect(result).toBe(true);
        expect(model.findOneAndDelete).toHaveBeenCalledWith({
            id: "workflow-1",
            user: "user-1",
            version: 2,
        });
    });

    it("throws NOT_FOUND when delete cannot find the workflow", async () => {
        model.findOneAndDelete.mockResolvedValue(null);
        model.exists.mockResolvedValue(false);

        await expect(
            repository.delete("missing-workflow", "user-1", 0),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
            statusCode: 404,
        });
    });

    it("throws VERSION_CONFLICT when workflow exists but version is stale on delete", async () => {
        model.findOneAndDelete.mockResolvedValue(null);
        model.exists.mockResolvedValue(true);

        await expect(
            repository.delete("workflow-1", "user-1", 1),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            statusCode: 409,
        });
    });
});

describe("Workflow Mongoose Schema - evaluationSpec", () => {
    const validUserId = new mongoose.Types.ObjectId();

    const baseWorkflowData = {
        id: "workflow-schema-test",
        user: validUserId,
        title: "Workflow Schema Test",
        phases: [
            {
                id: "phase-1",
                title: "Phase 1",
                tasks: [
                    {
                        id: "task-1",
                        title: "Task 1",
                        concept: "Concept 1",
                        order: 1,
                    },
                ],
            },
        ],
        status: "ACTIVE",
        version: 1,
    };

    it("successfully validates when evaluationSpec is null", () => {
        const doc = new Workflow({
            ...baseWorkflowData,
            checkpoints: {
                "cp-1": {
                    id: "cp-1",
                    taskId: "task-1",
                    question: "Test question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: null,
                },
            },
        });

        const error = doc.validateSync();
        expect(error).toBeUndefined();
    });

    it("successfully validates when a full valid evaluationSpec is provided", () => {
        const doc = new Workflow({
            ...baseWorkflowData,
            checkpoints: {
                "cp-1": {
                    id: "cp-1",
                    taskId: "task-1",
                    question: "Test question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: {
                        expectedAnswer: "An index is a B-Tree structure.",
                        keyConcepts: ["B-Tree", "lookup"],
                        rubric: [
                            { criterion: "Accuracy", weight: 0.6 },
                            { criterion: "Clarity", weight: 0.4 },
                        ],
                        commonMisconceptions: ["No disk usage"],
                    },
                },
            },
        });

        const error = doc.validateSync();
        expect(error).toBeUndefined();
    });

    it("fails validation when evaluationSpec is provided without expectedAnswer", () => {
        const doc = new Workflow({
            ...baseWorkflowData,
            checkpoints: {
                "cp-1": {
                    id: "cp-1",
                    taskId: "task-1",
                    question: "Test question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: {
                        keyConcepts: ["B-Tree"],
                    },
                },
            },
        });

        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error.errors["checkpoints.cp-1.evaluationSpec.expectedAnswer"]).toBeDefined();
    });

    it("fails validation when rubric criterion weight is greater than 1 or less than 0", () => {
        const docOver = new Workflow({
            ...baseWorkflowData,
            checkpoints: {
                "cp-1": {
                    id: "cp-1",
                    taskId: "task-1",
                    question: "Test question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: {
                        expectedAnswer: "Valid answer",
                        rubric: [{ criterion: "Accuracy", weight: 1.5 }],
                    },
                },
            },
        });

        const errorOver = docOver.validateSync();
        expect(errorOver).toBeDefined();
        expect(errorOver.errors["checkpoints.cp-1.evaluationSpec.rubric.0.weight"]).toBeDefined();

        const docUnder = new Workflow({
            ...baseWorkflowData,
            checkpoints: {
                "cp-1": {
                    id: "cp-1",
                    taskId: "task-1",
                    question: "Test question?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec: {
                        expectedAnswer: "Valid answer",
                        rubric: [{ criterion: "Accuracy", weight: -0.1 }],
                    },
                },
            },
        });

        const errorUnder = docUnder.validateSync();
        expect(errorUnder).toBeDefined();
        expect(errorUnder.errors["checkpoints.cp-1.evaluationSpec.rubric.0.weight"]).toBeDefined();
    });
});