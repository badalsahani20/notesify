import { InMemoryWorkflowRepository } from "../../src/services/ai/workflow/repository/inMemoryWorkflowRepository.js";
import {
    WORKFLOW_REPOSITORY_ERROR,
} from "../../src/services/ai/workflow/repository/workflowRepositoryErrors.js";

describe("InMemoryWorkflowRepository", () => {
    let repository;

    const workflow = {
        id: "workflow-1",
        userId: "user-1",
        title: "Learn MongoDB",
        version: 0,
        status: "DRAFT",
        taskStates: {},
        checkpoints: {},
    };

    beforeEach(() => {
        repository = new InMemoryWorkflowRepository();
    });

    it("creates and retrieves a workflow", async () => {
        await repository.create(workflow);

        const result = await repository.getById(
            workflow.id,
            workflow.userId,
        );

        expect(result).toEqual(workflow);
    });

    it("returns null when a workflow does not exist", async () => {
        const result = await repository.getById(
            "missing-workflow",
            "user-1",
        );

        expect(result).toBeNull();
    });

    it("does not allow one user to read another user's workflow", async () => {
        await repository.create(workflow);

        const result = await repository.getById(
            workflow.id,
            "user-2",
        );

        expect(result).toBeNull();
    });

    it("lists only workflows belonging to the requested user", async () => {
        await repository.create(workflow);

        await repository.create({
            ...workflow,
            id: "workflow-2",
            userId: "user-1",
            title: "Learn Docker",
        });

        await repository.create({
            ...workflow,
            id: "workflow-3",
            userId: "user-2",
            title: "Learn React",
        });

        const result = await repository.listByUser("user-1");

        expect(result).toHaveLength(2);
        expect(result.map((item) => item.id)).toEqual([
            "workflow-1",
            "workflow-2",
        ]);
    });

    it("updates a workflow when the expected version matches", async () => {
        await repository.create(workflow);

        const updated = {
            ...workflow,
            status: "ACTIVE",
            version: 1,
        };

        const result = await repository.update(updated, workflow.userId, 0);

        expect(result).toEqual(updated);

        const stored = await repository.getById(
            workflow.id,
            workflow.userId,
        );

        expect(stored).toEqual(updated);
    });

    it("rejects an update when the workflow does not exist", async () => {
        const updated = {
            ...workflow,
            id: "missing-workflow",
            version: 1,
        };

        await expect(
            repository.update(updated, workflow.userId, 0),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        });
    });

    it("rejects an update when the expected version is stale", async () => {
        await repository.create({
            ...workflow,
            version: 2,
        });

        await expect(
            repository.update(
                {
                    ...workflow,
                    version: 3,
                },
                workflow.userId,
                1,
            ),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        });
    });

    it("returns cloned data instead of the stored object", async () => {
        await repository.create(workflow);

        const result = await repository.getById(
            workflow.id,
            workflow.userId,
        );

        result.title = "Modified outside repository";

        const stored = await repository.getById(
            workflow.id,
            workflow.userId,
        );

        expect(stored.title).toBe("Learn MongoDB");
    });

    it("assigns HTTP 404 to NOT_FOUND repository errors", async () => {
        await expect(
            repository.update(
                {
                    ...workflow,
                    id: "missing-workflow",
                },
                workflow.userId,
                0,
            ),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
            statusCode: 404,
        });
    });

    it("assigns HTTP 409 to VERSION_CONFLICT repository errors", async () => {
        await repository.create({
            ...workflow,
            version: 2,
        });

        await expect(
            repository.update(
                {
                    ...workflow,
                    version: 3,
                },
                workflow.userId,
                1,
            ),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            statusCode: 409,
        });
    });

    it("deletes a workflow when expectedVersion matches", async () => {
        await repository.create(workflow);

        const result = await repository.delete(workflow.id, workflow.userId, 0);
        expect(result).toBe(true);

        const stored = await repository.getById(workflow.id, workflow.userId);
        expect(stored).toBeNull();
    });

    it("rejects delete when workflow does not exist", async () => {
        await expect(
            repository.delete("missing-workflow", workflow.userId, 0),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
            statusCode: 404,
        });
    });

    it("rejects delete when version conflict occurs", async () => {
        await repository.create({
            ...workflow,
            version: 2,
        });

        await expect(
            repository.delete(workflow.id, workflow.userId, 1),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            statusCode: 409,
        });
    });

    it("evaluationSpec survives repository round-trip", async () => {
        const evaluationSpec = {
            expectedAnswer: "Indexes provide O(log n) lookups using B-Trees.",
            keyConcepts: ["B-Tree", "lookup performance"],
            rubric: [
                { criterion: "Mentions B-Tree", weight: 0.5 },
                { criterion: "Explains performance benefit", weight: 0.5 },
            ],
            commonMisconceptions: ["Indexes speed up all write operations"],
        };

        const workflowWithSpec = {
            ...workflow,
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "How do indexes optimize query execution?",
                    status: "WAITING_FOR_ANSWER",
                    evaluationSpec,
                    userAnswer: null,
                    evaluation: null,
                    presentedAt: new Date().toISOString(),
                    answeredAt: null,
                },
            },
        };

        await repository.create(workflowWithSpec);

        // Retrieve and verify
        const fetched = await repository.getById(workflow.id, workflow.userId);
        expect(fetched.checkpoints["checkpoint-1"].evaluationSpec).toEqual(evaluationSpec);

        // Update and verify persistence
        const updated = {
            ...fetched,
            version: 1,
            checkpoints: {
                ...fetched.checkpoints,
                "checkpoint-1": {
                    ...fetched.checkpoints["checkpoint-1"],
                    status: "ANSWERED",
                    userAnswer: "They use B-Trees to avoid full collection scans.",
                },
            },
        };

        const updateResult = await repository.update(updated, workflow.userId, 0);
        expect(updateResult.checkpoints["checkpoint-1"].evaluationSpec).toEqual(evaluationSpec);

        const fetchedAfterUpdate = await repository.getById(workflow.id, workflow.userId);
        expect(fetchedAfterUpdate.checkpoints["checkpoint-1"].evaluationSpec).toEqual(evaluationSpec);
    });

    it("preserves backwards compatibility when evaluationSpec is null", async () => {
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

        await repository.create(legacyWorkflow);

        const fetched = await repository.getById(workflow.id, workflow.userId);
        expect(fetched.checkpoints["checkpoint-old"].evaluationSpec).toBeNull();
    });
});