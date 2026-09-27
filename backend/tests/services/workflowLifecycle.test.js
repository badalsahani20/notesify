import { createWorkflow } from "../../src/services/ai/workflow/domain/workflowFactory.js";
import {
    transition,
} from "../../src/services/ai/workflow/domain/workflowTransitions.js";
import {
    WORKFLOW_STATUS,
    TASK_STATUS,
    CHECKPOINT_STATUS,
    VERDICT,
    COMMAND,
} from "../../src/services/ai/workflow/domain/workflowConstants.js";

describe("workflow lifecycle", () => {
    it("runs a workflow from creation to completion", () => {
        let workflow = createWorkflow({
            title: "Learn MongoDB",
            userId: "user-1",
            phases: [
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
                    ],
                },
            ],
        });

        // 1. Newly created workflow
        expect(workflow.status).toBe(WORKFLOW_STATUS.DRAFT);
        expect(workflow.version).toBe(0);

        // 2. Start workflow
        workflow = transition(
            workflow,
            COMMAND.START_WORKFLOW,
        );

        expect(workflow.status).toBe(WORKFLOW_STATUS.ACTIVE);
        expect(workflow.version).toBe(1);

        // 3. Activate task
        workflow = transition(
            workflow,
            COMMAND.ACTIVATE_TASK,
            {
                taskId: "task-1",
            },
        );

        expect(workflow.activeTaskId).toBe("task-1");
        expect(workflow.taskStates["task-1"].status).toBe(
            TASK_STATUS.ACTIVE,
        );

        // 4. Present checkpoint
        workflow = transition(
            workflow,
            COMMAND.PRESENT_CHECKPOINT,
            {
                taskId: "task-1",
                checkpointId: "checkpoint-1",
                question: "What is a MongoDB document?",
            },
        );

        expect(workflow.activeCheckpointId).toBe("checkpoint-1");
        expect(
            workflow.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.WAITING_FOR_ANSWER);

        // 5. Submit answer
        workflow = transition(
            workflow,
            COMMAND.SUBMIT_ANSWER,
            {
                checkpointId: "checkpoint-1",
                answer: "A BSON document containing fields and values.",
            },
        );

        expect(
            workflow.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.ANSWERED);

        // 6. Evaluate checkpoint
        workflow = transition(
            workflow,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId: "checkpoint-1",
                verdict: VERDICT.PASSED,
                confidence: 0.95,
            },
        );

        // 7. Final state
        expect(workflow.status).toBe(WORKFLOW_STATUS.COMPLETED);
        expect(workflow.activeTaskId).toBeNull();
        expect(workflow.activeCheckpointId).toBeNull();

        expect(workflow.taskStates["task-1"].status).toBe(
            TASK_STATUS.COMPLETED,
        );

        expect(
            workflow.checkpoints["checkpoint-1"].status,
        ).toBe(CHECKPOINT_STATUS.EVALUATED);

        expect(
            workflow.checkpoints["checkpoint-1"].evaluation,
        ).toEqual(
            expect.objectContaining({
                verdict: VERDICT.PASSED,
                confidence: 0.95,
            }),
        );

        expect(workflow.version).toBe(5);
    });
});