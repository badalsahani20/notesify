import { transition, areAllTasksCompleted } from "../../src/services/ai/workflow/workflowTransitions.js";
import {
  WORKFLOW_STATUS,
  TASK_STATUS,
  CHECKPOINT_STATUS,
  VERDICT,
  COMMAND,
} from "../../src/services/ai/workflow/workflowConstants.js";

describe("workflowTransitions", () => {
  describe("START_WORKFLOW", () => {
    it("transitions a DRAFT workflow to ACTIVE", () => {
      const state = {
        status: WORKFLOW_STATUS.DRAFT,
        version: 0,
        taskStates: {},
        checkpoints: {},
      };

      const next = transition(state, COMMAND.START_WORKFLOW);

      expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
      expect(next.version).toBe(1);
      expect(next.updatedAt).toEqual(expect.any(String));

      // transition must not mutate the original state
      expect(state.status).toBe(WORKFLOW_STATUS.DRAFT);
      expect(state.version).toBe(0);
    });
  });
});


describe("PAUSE_WORKFLOW", () => {
    it("transitions an ACTIVE workflow to PAUSED", () => {
        const state = {
            status: WORKFLOW_STATUS.ACTIVE,
            version: 1,
            taskStates: {},
            checkpoints: {},
        };

        const next = transition(state, COMMAND.PAUSE_WORKFLOW);

        expect(next.status).toBe(WORKFLOW_STATUS.PAUSED);
        expect(next.version).toBe(2);

        expect(state.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(state.version).toBe(1);
    });
});

describe("RESUME_WORKFLOW", () => {
    it("transitions a PAUSED workflow to ACTIVE", () => {
        const state = {
            status: WORKFLOW_STATUS.PAUSED,
            version: 2,
            taskStates: {},
            checkpoints: {},
        };

        const next = transition(state, COMMAND.RESUME_WORKFLOW);

        expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(next.version).toBe(3);

        expect(state.status).toBe(WORKFLOW_STATUS.PAUSED);
        expect(state.version).toBe(2);
    });
});

describe("RETRY_WORKFLOW", () => {
    it("transitions a FAILED workflow to ACTIVE", () => {
        const state = {
            status: WORKFLOW_STATUS.FAILED,
            version: 3,
            taskStates: {},
            checkpoints: {},
        };

        const next = transition(state, COMMAND.RETRY_WORKFLOW);

        expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(next.version).toBe(4);

        expect(state.status).toBe(WORKFLOW_STATUS.FAILED);
        expect(state.version).toBe(3);
    });
});

describe("ACTIVATE_TASK", () => {
    it("activates a pending task", () => {
        const state = {
            status: WORKFLOW_STATUS.ACTIVE,
            activeTaskId: null,
            version: 1,
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.PENDING,
                    attempts: 0,
                },
            },
            checkpoints: {},
        };

        const next = transition(
            state,
            COMMAND.ACTIVATE_TASK,
            { taskId: "task-1" },
        );

        expect(next.activeTaskId).toBe("task-1");
        expect(next.taskStates["task-1"].status)
            .toBe(TASK_STATUS.ACTIVE);

        expect(next.version).toBe(2);

        // Original state remains untouched.
        expect(state.activeTaskId).toBe(null);
        expect(state.taskStates["task-1"].status)
            .toBe(TASK_STATUS.PENDING);
    });
});

it("rejects activating another task when a task is already active", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        version: 2,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
            "task-2": {
                status: TASK_STATUS.PENDING,
                attempts: 0,
            },
        },
        checkpoints: {},
    };

    expect(() =>
        transition(
            state,
            COMMAND.ACTIVATE_TASK,
            { taskId: "task-2" },
        ),
    ).toThrow();

    // Invariant preserved
    expect(state.activeTaskId).toBe("task-1");
    expect(state.taskStates["task-1"].status)
        .toBe(TASK_STATUS.ACTIVE);
    expect(state.taskStates["task-2"].status)
        .toBe(TASK_STATUS.PENDING);
    expect(state.version).toBe(2);
});

it("reactivates the same task when it needs review", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: null,
        version: 3,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.NEEDS_REVIEW,
                attempts: 1,
            },
        },
        checkpoints: {},
    };

    const next = transition(
        state,
        COMMAND.ACTIVATE_TASK,
        { taskId: "task-1" },
    );

    expect(next.activeTaskId).toBe("task-1");
    expect(next.taskStates["task-1"].status)
        .toBe(TASK_STATUS.ACTIVE);

    // Attempts should NOT reset.
    expect(next.taskStates["task-1"].attempts).toBe(1);

    expect(next.version).toBe(4);
});

it("reactivates a failed task for retry", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: null,
        version: 4,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.FAILED,
                attempts: 2,
            },
        },
        checkpoints: {},
    };

    const next = transition(
        state,
        COMMAND.ACTIVATE_TASK,
        { taskId: "task-1" },
    );

    expect(next.activeTaskId).toBe("task-1");
    expect(next.taskStates["task-1"].status)
        .toBe(TASK_STATUS.ACTIVE);

    expect(next.taskStates["task-1"].attempts).toBe(2);
    expect(next.version).toBe(5);
});

describe("PRESENT_CHECKPOINT", () => {
    it("presents a checkpoint for the active task", () => {
        const state = {
            status: WORKFLOW_STATUS.ACTIVE,
            activeTaskId: "task-1",
            activeCheckpointId: null,
            version: 5,
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },
            checkpoints: {},
        };

        const next = transition(
            state,
            COMMAND.PRESENT_CHECKPOINT,
            {
                taskId: "task-1",
                checkpointId: "checkpoint-1",
                question: "What is a MongoDB index?",
            },
        );

        expect(next.activeCheckpointId).toBe("checkpoint-1");

        expect(next.checkpoints["checkpoint-1"]).toEqual(
            expect.objectContaining({
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
            }),
        );

        expect(next.version).toBe(6);

        // Original state remains unchanged.
        expect(state.activeCheckpointId).toBe(null);
        expect(state.checkpoints).toEqual({});
        expect(state.version).toBe(5);
    });
});

it("rejects presenting another checkpoint while one is active", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 6,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.PRESENT_CHECKPOINT,
            {
                taskId: "task-1",
                checkpointId: "checkpoint-2",
                question: "What is an aggregation pipeline?",
            },
        ),
    ).toThrow();

    // State must remain untouched.
    expect(state.activeCheckpointId).toBe("checkpoint-1");
    expect(state.version).toBe(6);
    expect(state.checkpoints["checkpoint-2"]).toBeUndefined();
});

it("rejects presenting a checkpoint for a different task", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: null,
        version: 5,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
            "task-2": {
                status: TASK_STATUS.PENDING,
                attempts: 0,
            },
        },
        checkpoints: {},
    };

    expect(() =>
        transition(
            state,
            COMMAND.PRESENT_CHECKPOINT,
            {
                taskId: "task-2",
                checkpointId: "checkpoint-1",
                question: "What is a MongoDB index?",
            },
        ),
    ).toThrow();

    expect(state.activeTaskId).toBe("task-1");
    expect(state.activeCheckpointId).toBe(null);
    expect(state.version).toBe(5);
    expect(state.checkpoints).toEqual({});
});

describe("SUBMIT_ANSWER", () => {
    it("submits an answer to the active checkpoint", () => {
        const state = {
            status: WORKFLOW_STATUS.ACTIVE,
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            version: 6,
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is a MongoDB index?",
                    status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
                },
            },
        };

        const next = transition(
            state,
            COMMAND.SUBMIT_ANSWER,
            {
                checkpointId: "checkpoint-1",
                answer: "An index is a data structure that helps MongoDB find documents faster.",
            },
        );

        expect(next.checkpoints["checkpoint-1"]).toEqual(
            expect.objectContaining({
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer:
                    "An index is a data structure that helps MongoDB find documents faster.",
            }),
        );

        expect(next.checkpoints["checkpoint-1"].answeredAt)
            .toEqual(expect.any(String));

        // The checkpoint remains the active checkpoint.
        expect(next.activeCheckpointId).toBe("checkpoint-1");

        expect(next.version).toBe(7);

        // Original state remains untouched.
        expect(
            state.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);

        expect(state.version).toBe(6);
    });
});

it("rejects an empty answer", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 6,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.SUBMIT_ANSWER,
            {
                checkpointId: "checkpoint-1",
                answer: "   ",
            },
        ),
    ).toThrow();

    expect(
        state.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);

    expect(state.version).toBe(6);
});

it("rejects an answer for a non-active checkpoint", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 6,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
            },
            "checkpoint-2": {
                id: "checkpoint-2",
                taskId: "task-1",
                question: "What is an aggregation pipeline?",
                status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.SUBMIT_ANSWER,
            {
                checkpointId: "checkpoint-2",
                answer: "An aggregation pipeline processes documents through stages.",
            },
        ),
    ).toThrow();

    expect(
        state.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);

    expect(
        state.checkpoints["checkpoint-2"].status,
    ).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);

    expect(state.activeCheckpointId).toBe("checkpoint-1");
    expect(state.version).toBe(6);
});

it("rejects submitting an answer to an already answered checkpoint", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 7,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "An index makes lookups faster.",
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.SUBMIT_ANSWER,
            {
                checkpointId: "checkpoint-1",
                answer: "A completely different answer.",
            },
        ),
    ).toThrow();

    expect(
        state.checkpoints["checkpoint-1"].userAnswer,
    ).toBe("An index makes lookups faster.");

    expect(state.version).toBe(7);
});

describe("EVALUATE_CHECKPOINT", () => {
    it("evaluates a passed checkpoint and completes the task", () => {
        const state = {
            status: WORKFLOW_STATUS.ACTIVE,
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            version: 7,

            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },

            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is a MongoDB index?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "An index helps MongoDB find documents faster.",
                },
            },
        };

        const next = transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: VERDICT.PASSED,
                confidence: 0.95,
            },
        );

        // Checkpoint is evaluated.
        expect(
            next.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.EVALUATED);

        expect(
            next.checkpoints["checkpoint-1"].evaluation,
        ).toEqual(
            expect.objectContaining({
                verdict: VERDICT.PASSED,
                confidence: 0.95,
            }),
        );

        // Task is completed.
        expect(
            next.taskStates["task-1"].status,
        ).toBe(TASK_STATUS.COMPLETED);

        // Attempt count increases.
        expect(
            next.taskStates["task-1"].attempts,
        ).toBe(1);

        // Active task/checkpoint are cleared.
        expect(next.activeTaskId).toBe(null);
        expect(next.activeCheckpointId).toBe(null);

        expect(next.version).toBe(8);

        // Original state remains unchanged.
        expect(
            state.taskStates["task-1"].status,
        ).toBe(TASK_STATUS.ACTIVE);

        expect(
            state.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.ANSWERED);

        expect(state.version).toBe(7);
    });
});

it("marks the task for review when the checkpoint is PARTIAL", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 7,

        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 1,
            },
        },

        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "It stores the documents.",
            },
        },
    };

    const next = transition(
        state,
        COMMAND.EVALUATE_CHECKPOINT,
        {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.PARTIAL,
            confidence: 0.65,
        },
    );

    expect(
        next.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.EVALUATED);

    expect(
        next.checkpoints["checkpoint-1"].evaluation,
    ).toEqual(
        expect.objectContaining({
            verdict: VERDICT.PARTIAL,
            confidence: 0.65,
        }),
    );

    expect(
        next.taskStates["task-1"].status,
    ).toBe(TASK_STATUS.NEEDS_REVIEW);

    // Second attempt.
    expect(
        next.taskStates["task-1"].attempts,
    ).toBe(2);

    // The checkpoint is consumed, but the task needs remediation.
    expect(next.activeCheckpointId).toBe(null);

    // Task itself is no longer active (NEEDS_REVIEW).
    // The next step will explicitly reactivate it.
    expect(next.activeTaskId).toBe(null);

    expect(next.version).toBe(8);

    // Original state untouched.
    expect(
        state.taskStates["task-1"].status,
    ).toBe(TASK_STATUS.ACTIVE);

    expect(state.taskStates["task-1"].attempts).toBe(1);
    expect(state.version).toBe(7);
});

it("marks the task for review when the checkpoint is a MISCONCEPTION", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 8,

        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 2,
            },
        },

        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "Indexes store the actual documents permanently.",
            },
        },
    };

    const next = transition(
        state,
        COMMAND.EVALUATE_CHECKPOINT,
        {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.MISCONCEPTION,
            confidence: 0.91,
        },
    );

    expect(
        next.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.EVALUATED);

    expect(
        next.checkpoints["checkpoint-1"].evaluation,
    ).toEqual(
        expect.objectContaining({
            verdict: VERDICT.MISCONCEPTION,
            confidence: 0.91,
        }),
    );

    expect(
        next.taskStates["task-1"].status,
    ).toBe(TASK_STATUS.NEEDS_REVIEW);

    expect(
        next.taskStates["task-1"].attempts,
    ).toBe(3);

    expect(next.activeTaskId).toBe(null);
    expect(next.activeCheckpointId).toBe(null);

    expect(next.version).toBe(9);

    // Original state untouched.
    expect(
        state.taskStates["task-1"].status,
    ).toBe(TASK_STATUS.ACTIVE);

    expect(state.taskStates["task-1"].attempts).toBe(2);
    expect(state.version).toBe(8);
});

it("rejects evaluating an already evaluated checkpoint", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: null,
        activeCheckpointId: null,
        version: 8,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.COMPLETED,
                attempts: 1,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.EVALUATED,
                userAnswer: "It speeds up lookups.",
                evaluation: {
                    verdict: VERDICT.PASSED,
                    confidence: 0.95,
                },
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: VERDICT.PASSED,
                confidence: 0.99,
            },
        ),
    ).toThrow();

    expect(state.version).toBe(8);

    expect(
        state.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.EVALUATED);
});

it("rejects an invalid verdict", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 7,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "It speeds up lookups.",
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: "MAYBE",
                confidence: 0.8,
            },
        ),
    ).toThrow();

    expect(state.version).toBe(7);

    expect(
        state.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.ANSWERED);
});

it.each([
    -0.01,
    1.01,
    -1,
    2,
    NaN,
    Infinity,
    -Infinity,
    "0.5",
    null,
])("rejects invalid confidence: %p", (confidence) => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 7,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "It speeds up lookups.",
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: VERDICT.PASSED,
                confidence,
            },
        ),
    ).toThrow();

    expect(state.version).toBe(7);
    expect(
        state.checkpoints["checkpoint-1"].status,
    ).toBe(CHECKPOINT_STATUS.ANSWERED);
});

it("rejects evaluating a nonexistent checkpoint", () => {
    const state = {
        status: WORKFLOW_STATUS.ACTIVE,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 6,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {},
    };

    expect(() =>
        transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "missing",
                verdict: VERDICT.PASSED,
                confidence: 0.9,
            },
        ),
    ).toThrow();

    expect(state.version).toBe(6);
});

it("rejects evaluation when workflow is not active", () => {
    const state = {
        status: WORKFLOW_STATUS.PAUSED,
        activeTaskId: "task-1",
        activeCheckpointId: "checkpoint-1",
        version: 7,
        taskStates: {
            "task-1": {
                status: TASK_STATUS.ACTIVE,
                attempts: 0,
            },
        },
        checkpoints: {
            "checkpoint-1": {
                id: "checkpoint-1",
                taskId: "task-1",
                question: "What is a MongoDB index?",
                status: CHECKPOINT_STATUS.ANSWERED,
                userAnswer: "It speeds up lookups.",
            },
        },
    };

    expect(() =>
        transition(
            state,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: VERDICT.PASSED,
                confidence: 0.9,
            },
        ),
    ).toThrow();

    expect(state.version).toBe(7);
});

describe("areAllTasksCompleted", () => {
    it("returns true when every required task is completed", () => {
        const state = {
            phases: [
                {
                    id: "phase-1",
                    tasks: [
                        { id: "task-1" },
                        { id: "task-2" },
                    ],
                },
            ],
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.COMPLETED,
                },
                "task-2": {
                    status: TASK_STATUS.COMPLETED,
                }, 
            },
        };

        expect(areAllTasksCompleted(state)).toBe(true);
    });
});

describe("EVALUATE_CHECKPOINT workflow completion", () => {
    const baseState = {
        version: 7,
        taskStates: {},
        checkpoints: {},
    };

    it("completes the workflow when the final required task passes", () => {
        const state = {
            ...baseState,
            status: WORKFLOW_STATUS.ACTIVE,
            phases: [
                {
                    id: "phase-1",
                    tasks: [
                        { id: "task-1" },
                    ],
                },
            ],
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is MongoDB?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "A document database.",
                },
            },
        };

        const next = transition(state, COMMAND.EVALUATE_CHECKPOINT, {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.PASSED,
            confidence: 0.95,
        });

        expect(next.status).toBe(WORKFLOW_STATUS.COMPLETED);
        expect(next.taskStates["task-1"].status).toBe(TASK_STATUS.COMPLETED);
        expect(next.activeTaskId).toBeNull();
        expect(next.activeCheckpointId).toBeNull();
    });

    it("keeps the workflow ACTIVE when a non-final task passes", () => {
        const state = {
            ...baseState,
            status: WORKFLOW_STATUS.ACTIVE,
            phases: [
                {
                    id: "phase-1",
                    tasks: [
                        { id: "task-1" },
                        { id: "task-2" },
                    ],
                },
            ],
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
                "task-2": {
                    status: TASK_STATUS.PENDING,
                    attempts: 0,
                },
            },
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is MongoDB?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "A document database.",
                },
            },
        };

        const next = transition(state, COMMAND.EVALUATE_CHECKPOINT, {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.PASSED,
            confidence: 0.95,
        });

        expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(next.taskStates["task-1"].status).toBe(TASK_STATUS.COMPLETED);
    });

    it("does not complete the workflow on PARTIAL", () => {
        const state = {
            ...baseState,
            status: WORKFLOW_STATUS.ACTIVE,
            phases: [
                {
                    id: "phase-1",
                    tasks: [
                        { id: "task-1" },
                    ],
                },
            ],
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is MongoDB?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "Something related to databases.",
                },
            },
        };

        const next = transition(state, COMMAND.EVALUATE_CHECKPOINT, {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.PARTIAL,
            confidence: 0.7,
        });

        expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(next.taskStates["task-1"].status).toBe(
            TASK_STATUS.NEEDS_REVIEW,
        );
    });

    it("does not complete the workflow on MISCONCEPTION", () => {
        const state = {
            ...baseState,
            status: WORKFLOW_STATUS.ACTIVE,
            phases: [
                {
                    id: "phase-1",
                    tasks: [
                        { id: "task-1" },
                    ],
                },
            ],
            activeTaskId: "task-1",
            activeCheckpointId: "checkpoint-1",
            taskStates: {
                "task-1": {
                    status: TASK_STATUS.ACTIVE,
                    attempts: 0,
                },
            },
            checkpoints: {
                "checkpoint-1": {
                    id: "checkpoint-1",
                    taskId: "task-1",
                    question: "What is MongoDB?",
                    status: CHECKPOINT_STATUS.ANSWERED,
                    userAnswer: "MongoDB is a relational SQL database.",
                },
            },
        };

        const next = transition(state, COMMAND.EVALUATE_CHECKPOINT, {
            checkpointId: "checkpoint-1",
            verdict: VERDICT.MISCONCEPTION,
            confidence: 0.95,
        });

        expect(next.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(next.taskStates["task-1"].status).toBe(
            TASK_STATUS.NEEDS_REVIEW,
        );
    });
});

it.each([
    COMMAND.START_WORKFLOW,
    COMMAND.PAUSE_WORKFLOW,
    COMMAND.RESUME_WORKFLOW,
    COMMAND.RETRY_WORKFLOW,
    COMMAND.ACTIVATE_TASK,
    COMMAND.PRESENT_CHECKPOINT,
    COMMAND.SUBMIT_ANSWER,
    COMMAND.EVALUATE_CHECKPOINT,
])("rejects %s on a COMPLETED workflow", (command) => {
    const state = {
        status: WORKFLOW_STATUS.COMPLETED,
        activeTaskId: null,
        activeCheckpointId: null,
        version: 7,
        taskStates: {},
        checkpoints: {},
    };

    expect(() => {
        transition(state, command, {});
    }).toThrow();

    expect(state.version).toBe(7);
});