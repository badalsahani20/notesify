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
});