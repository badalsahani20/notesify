import { WORKFLOW_STATUS } from "./workflowConstants.js";

export function createWorkflow({
    title, 
    phases, 
    userId, 
    sessionId = null,
}) {
    const now = new Date().toISOString();

    return {
        id: crypto.randomUUID(),

        userId,
        sessionId,

        title,
        phases,
        status: WORKFLOW_STATUS.DRAFT,
        activePhaseId: null,
        activeTaskId: null,
        activeCheckpointId: null,

        taskStates: {},
        checkpoints: {},

        version: 0,

        createdAt: now,
        updatedAt: now,
    }
}