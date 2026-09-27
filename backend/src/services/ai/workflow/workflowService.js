import { transition } from "./domain/workflowTransitions.js";
import { WORKFLOW_REPOSITORY_ERROR, workflowRepositoryError } from "./repository/workflowRepositoryErrors.js";

export class WorkflowService {
    constructor(repository) {
        this.repository = repository;
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
            expectedVersion,
        );
    }
}