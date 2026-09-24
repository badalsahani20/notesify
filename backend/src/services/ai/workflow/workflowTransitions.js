import {
    WORKFLOW_STATUS,
    TASK_STATUS,
    CHECKPOINT_STATUS,
    VERDICT,
    COMMAND,
    ERROR_CODE,
} from "./workflowConstants.js";


const cloneWithNextVersion = (state) => ({
    ...state,
    taskStates: { ...state.taskStates },
    checkpoints: { ...state.checkpoints },
    version: (state.version || 0) + 1,
    updatedAt: new Date().toISOString(),
});

export function taskExists(state, taskId) {
    return Boolean(findTask(state, taskId));
}

export function findTask(state, taskId) {
    if(!taskId || !Array.isArray(state?.phases)) return null;

    for(const phase of state.phases) {
        const task = (phase.tasks || []).find((task) => task.id === taskId );
        if(task) return { 
            phaseId: phase.id, 
            task
        };
    }
    return null;
}

//Start workflow: Transition draft/paused -> active

export const transition = (state, command, payload = {}) => {
    switch(command) {
        case COMMAND.START_WORKFLOW:
            validate(
                state.status === WORKFLOW_STATUS.DRAFT,
                "Only DRAFT workflows can be started.",
            );
            return guard(
                state,
                (next) => {
                    next.status = WORKFLOW_STATUS.ACTIVE;
                },
            );
        
        case COMMAND.PAUSE_WORKFLOW: 
            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can be paused.",
            );
            return guard(
                state,
                (next) => {
                    next.status = WORKFLOW_STATUS.PAUSED;
                }
            );

        case COMMAND.RESUME_WORKFLOW:
            validate(
                state.status === WORKFLOW_STATUS.PAUSED,
                "Only PAUSED workflows can be resumed.",
            );
            return guard(
                state,
                (next) => {
                    next.status = WORKFLOW_STATUS.ACTIVE;
                }
            );

        case COMMAND.RETRY_WORKFLOW:
            validate(
                state.status === WORKFLOW_STATUS.FAILED,
                "Only FAILED workflows can be retried.",
            );
            return guard(
                state,
                (next) => {
                    next.status = WORKFLOW_STATUS.ACTIVE;
                }
            );

        case COMMAND.ACTIVATE_TASK: {
            const { taskId } = payload;
            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can have tasks activated.",
            );

            const currentTaskId = state.activeTaskId;
            validate(
                !currentTaskId || currentTaskId === taskId,
                `Task ${currentTaskId} is already active.`,
            );

            const match = findTask(state, taskId);
            validate(
                Boolean(match),
                `Task ${taskId} does not exist in the workflow definition.`,
            );  

            const taskState = state.taskStates[taskId] || {
                status: TASK_STATUS.PENDING,
                attempts: 0,
            };

            validate(
                taskState.status !== TASK_STATUS.COMPLETED,
                `task ${taskId} is already completed.`,
            );

            return guard(
                state,
                (next) => {
                    next.activeTaskId = taskId;
                    next.activePhaseId = match.phaseId;
                    next.taskStates[taskId] = {
                        ...taskState,
                        status: TASK_STATUS.ACTIVE,
                    };
                },
            );
        }

        case COMMAND.PRESENT_CHECKPOINT: {
            const { taskId, checkpointId, question } = payload;

            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can present checkpoints.",
            );
            validate(
                state.activeTaskId === taskId,
                `Task ${taskId} is not active.`,
            );
            validate(
                !state.activeCheckpointId,
                `Checkpoint ${state.activeCheckpointId} is still open.`,
            );
            validate(
                Boolean(checkpointId),
                "Checkpoint ID is required.",
            );
            validate(
                Boolean(question && question.trim()),
                "Checkpoint question cannot be empty.",
            );
            validate(
                !state.checkpoints[checkpointId],
                `Checkpoint ${checkpointId} already exists.`,
            );

            return guard(
                state,
                (next) => {
                    next.activeCheckpointId = checkpointId;
                    next.checkpoints[checkpointId] = {
                        id: checkpointId,
                        taskId,
                        question: question.trim(),
                        status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
                        presentedAt: new Date().toISOString(),
                    };
                },
            );
        }

        case COMMAND.SUBMIT_ANSWER: {
            const { checkpointId, answer } = payload;
            const checkpoint = state.checkpoints[checkpointId];

            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can accept answers.",
            );
            validate(
                Boolean(checkpoint),
                `Checkpoint ${checkpointId} not found.`,
            );
            validate(
                state.activeCheckpointId === checkpointId,
                `Checkpoint ${checkpointId} is not the active checkpoint.`,
            );
            validate(
                checkpoint?.status === CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
                `Checkpoint ${checkpointId} is not waiting for an answer.`,
            );
            validate(
                typeof answer === "string" && Boolean(answer.trim()),
                "Answer must be a non-empty string.",
            );

            return guard(
                state,
                (next) => {
                    next.checkpoints[checkpointId] = {
                        ...checkpoint,
                        userAnswer: answer.trim(),
                        status: CHECKPOINT_STATUS.ANSWERED,
                        answeredAt: new Date().toISOString(),
                    };
                },
            );
        }

        case COMMAND.EVALUATE_CHECKPOINT: {
            const { checkpointId, verdict, confidence = 1.0 } = payload;
            const checkpoint = state.checkpoints[checkpointId];

            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can evaluate checkpoints.",
            );
            validate(
                Boolean(checkpoint),
                `Checkpoint ${checkpointId} not found.`,
            );
            validate(
                checkpoint?.status === CHECKPOINT_STATUS.ANSWERED,
                `Checkpoint ${checkpointId} has not been answered yet.`,
            );
            validate(
                Object.values(VERDICT).includes(verdict),
                `Invalid verdict: ${verdict}`,
            );
            validate(
                typeof confidence === "number" && confidence >= 0 && confidence <= 1,
                "Confidence must be between 0 and 1.",
            );

            return guard(
                state,
                (next) => {
                    next.checkpoints[checkpointId] = {
                        ...checkpoint,
                        status: CHECKPOINT_STATUS.EVALUATED,
                        evaluation: {
                            verdict,
                            confidence,
                            evaluatedAt: new Date().toISOString(),
                        },
                    };

                    const taskId = checkpoint.taskId;
                    const currentTask = next.taskStates[taskId] || { attempts: 0 };
                    const attempts = (currentTask.attempts || 0) + 1;

                    if (verdict === VERDICT.PASSED) {
                        next.taskStates[taskId] = {
                            ...currentTask,
                            status: TASK_STATUS.COMPLETED,
                            attempts,
                            completedAt: new Date().toISOString(),
                        };
                        next.activeTaskId = null;
                        next.activeCheckpointId = null;
                        next.activePhaseId = null;

                        if (areAllTasksCompleted(next)) {
                            next.status = WORKFLOW_STATUS.COMPLETED;
                        }
                    } else {
                        next.taskStates[taskId] = {
                            ...currentTask,
                            status: TASK_STATUS.NEEDS_REVIEW,
                            attempts,
                        };
                        next.activeTaskId = null;
                        next.activeCheckpointId = null;
                        next.activePhaseId = null;
                    }
                },
            );
        }

        case COMMAND.ABANDON_TASK: {
            const { taskId } = payload;

            validate(
                state.status === WORKFLOW_STATUS.ACTIVE,
                "Only ACTIVE workflows can abandon tasks.",
            );
            validate(
                state.activeTaskId === taskId,
                `Task ${taskId} is not active.`,
            );

            return guard(
                state,
                (next) => {
                    const currentTask = next.taskStates[taskId] || {};
                    next.taskStates[taskId] = {
                        ...currentTask,
                        status: TASK_STATUS.FAILED,
                    };
                    next.activeTaskId = null;
                    next.activeCheckpointId = null;
                    next.activePhaseId = null;
                },
            );
        }
        default:
            throw error(
                ERROR_CODE.UNKNOWN_COMMAND,`Unknown command ${command}`,
            );
    }
}

function validate(precondition, message = "Invalid workflow transition.") {
    if (!precondition) {
        throw error(
            ERROR_CODE.INVALID_TRANSITION,
            message,
        );
    }
}
function guard(state, mutate) {
    const next = cloneWithNextVersion(state);
    mutate(next);
    return next;
}



function error(code, msg = '') {
    const e = new Error(`[${code}] ${msg}`.trim());
    e.code = code;
    return e;
}

export function areAllTasksCompleted(state) {
    if (!state?.phases || !Array.isArray(state.phases)) {
        return false;
    }

    const requiredTaskIds = state.phases.flatMap(
        (phase) => (phase.tasks || []).map((task) => task.id),
    );

    return (
        requiredTaskIds.length > 0 &&
        requiredTaskIds.every(
            (taskId) =>
                state.taskStates?.[taskId]?.status === TASK_STATUS.COMPLETED,
        )
    );
}