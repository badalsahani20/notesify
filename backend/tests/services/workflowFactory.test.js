import { createWorkflow } from "../../src/services/ai/workflow/domain/workflowFactory.js";
import { WORKFLOW_STATUS } from "../../src/services/ai/workflow/domain/workflowConstants.js";

describe("createWorkflow", () => {
    const phases = [
        {
            id: "phase-1",
            title: "MongoDB Fundamentals",
            tasks: [
                {
                    id: "task-1",
                    title: "Documents",
                    concept: "MongoDB documents",
                    order: 1,
                },
                {
                    id: "task-2",
                    title: "Collections",
                    concept: "MongoDB collections",
                    order: 2,
                },
            ],
        },
    ];

    it("creates a workflow with the correct initial state", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases,
            userId: "user-1",
        });

        expect(workflow.id).toBeDefined();
        expect(workflow.title).toBe("Learn MongoDB");
        expect(workflow.userId).toBe("user-1");

        expect(workflow.status).toBe(WORKFLOW_STATUS.DRAFT);

        expect(workflow.activePhaseId).toBeNull();
        expect(workflow.activeTaskId).toBeNull();
        expect(workflow.activeCheckpointId).toBeNull();

        expect(workflow.taskStates).toEqual({});
        expect(workflow.checkpoints).toEqual({});

        expect(workflow.version).toBe(0);
    });

    it("preserves the supplied workflow definition", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases,
            userId: "user-1",
        });

        expect(workflow.phases).toEqual(phases);
    });

    it("defaults sessionId to null", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases,
            userId: "user-1",
        });

        expect(workflow.sessionId).toBeNull();
    });

    it("preserves the supplied sessionId", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases,
            userId: "user-1",
            sessionId: "session-123",
        });

        expect(workflow.sessionId).toBe("session-123");
    });

    it("uses the same timestamp for creation and initial update time", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases,
            userId: "user-1",
        });

        expect(workflow.createdAt).toBe(workflow.updatedAt);
        expect(() => new Date(workflow.createdAt)).not.toThrow();
    });

    it("creates a unique workflow id", () => {
        const first = createWorkflow({
            title: "MongoDB",
            phases,
            userId: "user-1",
        });

        const second = createWorkflow({
            title: "Docker",
            phases,
            userId: "user-1",
        });

        expect(first.id).not.toBe(second.id);
    });
});