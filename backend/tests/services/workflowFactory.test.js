import { createWorkflow } from "../../src/services/ai/workflow/workflowFactory.js";
import { WORKFLOW_STATUS } from "../../src/services/ai/workflow/workflowConstants.js";

describe("createWorkflow", () => {
    const definition = [
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

    it("creates a new workflow in DRAFT state", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases: definition,
            userId: "user-1",
        });

        expect(workflow.status).toBe(WORKFLOW_STATUS.DRAFT);
        expect(workflow.version).toBe(0);
    });

    it("preserves workflow identity and definition", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases: definition,
            userId: "user-1",
            sessionId: "session-1",
        });

        expect(workflow.id).toEqual(expect.any(String));
        expect(workflow.userId).toBe("user-1");
        expect(workflow.sessionId).toBe("session-1");
        expect(workflow.title).toBe("Learn MongoDB");
        expect(workflow.phases).toEqual(definition);
    });

    it("starts with no active execution state", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases: definition,
            userId: "user-1",
        });

        expect(workflow.activePhaseId).toBeNull();
        expect(workflow.activeTaskId).toBeNull();
        expect(workflow.activeCheckpointId).toBeNull();

        expect(workflow.taskStates).toEqual({});
        expect(workflow.checkpoints).toEqual({});
    });

    it("sets timestamps when the workflow is created", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases: definition,
            userId: "user-1",
        });

        expect(workflow.createdAt).toEqual(expect.any(String));
        expect(workflow.updatedAt).toEqual(expect.any(String));
        expect(Date.parse(workflow.createdAt)).not.toBeNaN();
        expect(Date.parse(workflow.updatedAt)).not.toBeNaN();
    });

    it("defaults sessionId to null", () => {
        const workflow = createWorkflow({
            title: "Learn MongoDB",
            phases: definition,
            userId: "user-1",
        });

        expect(workflow.sessionId).toBeNull();
    });
});
