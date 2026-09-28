import Workflow from "../../../../models/workflow.model.js";
import { WORKFLOW_REPOSITORY_ERROR, workflowRepositoryError } from "./workflowRepositoryErrors.js";

function toDomainWorkflow(document) {
    if (!document) return null;

    const workflow =
        typeof document.toObject === "function"
            ? document.toObject({ flattenMaps: true })
            : { ...document };

    const userId = (workflow.user ?? workflow.userId)?.toString?.() ?? (workflow.user ?? workflow.userId);

    const result = {
        ...workflow,
        userId,
    };
    delete result.user;
    return result;
}

export class MongoWorkflowRepository {
    constructor(model = Workflow) {
        this.model = model;
    }

    async create(workflow) {
        const doc = await this.model.create({
            id: workflow.id,
            user: workflow.userId,
            sessionId: workflow.sessionId,
            title: workflow.title,
            phases: workflow.phases,
            status: workflow.status,
            activePhaseId: workflow.activePhaseId,
            activeTaskId: workflow.activeTaskId,
            activeCheckpointId: workflow.activeCheckpointId,
            taskStates: workflow.taskStates,
            checkpoints: workflow.checkpoints,
            version: workflow.version,
        });
        return toDomainWorkflow(doc);
    }

    async getById(workflowId, userId) {
        const doc = await this.model.findOne({ id: workflowId, user: userId }).lean();
        if (!doc) return null;

        return toDomainWorkflow(doc);
    }

    async listByUser(userId) {
        const docs = await this.model.find({ user: userId }).sort({ createdAt: -1 }).lean();

        return docs.map((doc) => toDomainWorkflow(doc));
    }

    async update(workflow, userId, expectedVersion) {
        const updated = await this.model.findOneAndUpdate(
            {
                id: workflow.id,
                user: userId,
                version: expectedVersion,
            },
            {
                $set: {
                    sessionId: workflow.sessionId,
                    title: workflow.title,
                    phases: workflow.phases,
                    status: workflow.status,
                    activePhaseId: workflow.activePhaseId,
                    activeTaskId: workflow.activeTaskId,
                    activeCheckpointId: workflow.activeCheckpointId,
                    taskStates: workflow.taskStates,
                    checkpoints: workflow.checkpoints,
                    version: workflow.version,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        );

        if (updated) {
            return toDomainWorkflow(updated);
        }

        const existing = await this.model.exists({
            id: workflow.id,
            user: userId,
        });

        if (!existing) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflow.id} not found.`,
            );
        }

        throw workflowRepositoryError(
            WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            `Workflow ${workflow.id} version conflict.`,
        );
    }

    async delete(workflowId, userId, expectedVersion) {
        const deleted = await this.model.findOneAndDelete({
            id: workflowId,
            user: userId,
            version: expectedVersion,
        });

        if (deleted) {
            return true;
        }

        const existing = await this.model.exists({
            id: workflowId,
            user: userId,
        });

        if (!existing) {
            throw workflowRepositoryError(
                WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
                `Workflow ${workflowId} not found.`,
            );
        }

        throw workflowRepositoryError(
            WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
            `Workflow ${workflowId} version conflict.`,
        );
    }
}