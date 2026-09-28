export class WorkflowRepository {
    async create(workflow) {
        throw new Error("Not Implemented");
    }

    async getById(workflowId, userId) {
        throw new Error("Not implemented");
    }

    async listByUser(userId) {
        throw new Error("Not implemented");
    }

    async update(workflow, userId, expectedVersion) {
        throw new Error("Not implemented");
    }

    async delete(workflowId, userId, expectedVersion) {
        throw new Error("Not implemented");
    }
}