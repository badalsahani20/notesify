import { WORKFLOW_REPOSITORY_ERROR, workflowRepositoryError } from "./workflowRepositoryErrors.js";

export class InMemoryWorkflowRepository {
    constructor() {
        this.workflows = new Map();
    }

    async create(workflow) {
        this.workflows.set(workflow.id, structuredClone(workflow));
        return structuredClone(workflow);
    }
    async getById(workflowId, userId) {
        const workflow = this.workflows.get(workflowId);

        if (!workflow || workflow.userId !== userId) {
            return null;
        }

        return structuredClone(workflow);
    }

    async listByUser(userId) {
        return [...this.workflows.values()]
            .filter((workflow) => workflow.userId === userId)
            .map((workflow) => structuredClone(workflow));
    }

    async update(workflow, userId, expectedVersion) {
        const existing = this.workflows.get(workflow.id);

        if (!existing || existing.userId !== userId) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflow.id} not found.`
            );
        }

        if (existing.version !== expectedVersion) {
            throw workflowRepositoryError(
            WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            `Workflow ${workflow.id} version conflict.`,
        );
        }

        this.workflows.set(workflow.id, structuredClone(workflow));

        return structuredClone(workflow);
    }

    async delete(workflowId, userId, expectedVersion) {
        const existing = this.workflows.get(workflowId);

        if (!existing || existing.userId !== userId) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found.`,
            );
        }

        if (existing.version !== expectedVersion) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
                `Workflow ${workflowId} version conflict.`,
            );
        }

        this.workflows.delete(workflowId);
        return true;
    }
}