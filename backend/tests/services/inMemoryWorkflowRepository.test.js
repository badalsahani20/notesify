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

        const result = await repository.update(updated, 0);

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
            repository.update(updated, 0),
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
                1,
            ),
        ).rejects.toMatchObject({
            code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            statusCode: 409,
        });
    });
});