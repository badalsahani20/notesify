import { jest } from "@jest/globals";
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
            repository.update(workflow, 0),
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

        await repository.update(nextWorkflow, 3);

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
});