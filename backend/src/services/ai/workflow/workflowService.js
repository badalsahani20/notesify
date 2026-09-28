import { transition } from "./domain/workflowTransitions.js";
import { COMMAND } from "./domain/workflowConstants.js";
import { WORKFLOW_REPOSITORY_ERROR, workflowRepositoryError } from "./repository/workflowRepositoryErrors.js";
import { defaultJevEvaluator } from "./jev/index.js";

export class WorkflowService {
    constructor(repository, evaluator = defaultJevEvaluator) {
        this.repository = repository;
        this.evaluator = evaluator;
    }

    async create(workflow) {
        return this.repository.create(workflow);
    }

    async getById(workflowId, userId) {
        const workflow = await this.repository.getById(
            workflowId,
            userId,
        );

        if (!workflow) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found.`,
            );
        }

        return workflow;
    }

    async listByUser(userId) {
        return this.repository.listByUser(userId);
    }

    async execute({
        workflowId,
        userId,
        command,
        payload = {},
        expectedVersion,
    }) {
        const workflow = await this.repository.getById(
            workflowId,
            userId,
        );

        if (!workflow) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found for user ${userId}`,
            );
        }

        if (workflow.version !== expectedVersion) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
                `Workflow ${workflowId} version conflict.`,
            );
        }

        const nextWorkflow = transition(
            workflow,
            command,
            payload,
        );

        return this.repository.update(
            nextWorkflow,
            userId,
            expectedVersion,
        );
    }

    async submitAnswer({
        workflowId,
        userId,
        payload = {},
        expectedVersion,
    }) {
        const workflow = await this.repository.getById(
            workflowId,
            userId,
        );

        if (!workflow) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found.`,
            );
        }

        if (workflow.version !== expectedVersion) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
                `Workflow ${workflowId} version conflict.`,
            );
        }

        const checkpointId =
            payload.checkpointId ?? workflow.activeCheckpointId;

        const checkpoint = workflow.checkpoints?.[checkpointId];

        if (!checkpoint) {
            throw new Error(
                `Checkpoint ${checkpointId} not found.`,
            );
        }

        // First mutation: persist the user's answer.
        const submittedWorkflow = transition(
            workflow,
            COMMAND.SUBMIT_ANSWER,
            {
                ...payload,
                checkpointId,
            },
        );

        const savedWorkflow = await this.repository.update(
            submittedWorkflow,
            userId,
            expectedVersion,
        );

        if (!this.evaluator) {
            throw new Error("JEV evaluator is not configured on WorkflowService.");
        }

        // JEV receives only what it needs.
        const evaluation = await this.evaluator.evaluate({
            checkpoint: savedWorkflow.checkpoints[checkpointId],
            userAnswer: payload.answer,
        });

        // Second mutation uses the NEW version.
        const evaluatedWorkflow = transition(
            savedWorkflow,
            COMMAND.EVALUATE_CHECKPOINT,
            {
                checkpointId,
                verdict: evaluation.verdict,
                confidence: evaluation.confidence,
                feedback: evaluation.feedback,
                misconceptions: evaluation.misconceptions,
                criterionResults: evaluation.criterionResults,
            },
        );

        return this.repository.update(
            evaluatedWorkflow,
            userId,
            savedWorkflow.version,
        );
    }

    async delete({ workflowId, userId, expectedVersion }) {
        const workflow = await this.repository.getById(workflowId, userId);

        if(!workflow) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found.`,
            );
        }

        if (workflow.version !== expectedVersion) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
                `Workflow ${workflowId} version conflict.`,
            );
        }

       return this.repository.delete(workflowId, userId, expectedVersion);
    }
}