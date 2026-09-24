import mongoose from "mongoose";
import { WORKFLOW_STATUS } from "./workflowConstants.js";
import { WorkflowRepository } from "./workflowRepository.js";

const taskDefinitionSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        concept: {
            type: String,
            default: null,
            trim: true,
        },
        order: {
            type: Number,
            default: null,
        },
    },
    { _id: false },
);

const phaseDefinitionSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        tasks: {
            type: [taskDefinitionSchema],
            required: true,
            default: [],
        },
    },
    { _id: false },
);

const workflowSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        sessionId: {
            type: String,
            default: null,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        phases: {
            type: [phaseDefinitionSchema],
            required: true,
            default: [],
        },
        status: {
            type: String,
            enum: Object.values(WORKFLOW_STATUS),
            default: WORKFLOW_STATUS.DRAFT,
            index: true,
        },
        activePhaseId: {
            type: String,
            default: null,
        },
        activeTaskId: {
            type: String,
            default: null,
        },
        activeCheckpointId: {
            type: String,
            default: null,
        },
        taskStates: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
        },
        checkpoints: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
        },
        version: {
            type: Number,
            required: true,
            default: 0,
        },
    },

    { timestamps: true },
);

export const WorkflowModel =
    mongoose.models.Workflow || mongoose.model("Workflow", workflowSchema);

function toDomain(doc) {
    if (!doc) return null;

    const obj = doc.toObject
        ? doc.toObject({ virtuals: false })
        : { ...doc };

    delete obj._id;
    delete obj.__v;

    return obj;
}

export class MongoWorkflowRepository extends WorkflowRepository {
    async create(workflow) {
        if (!workflow || !workflow.id) {
            throw new Error("A valid workflow with an id is required.");
        }

        const doc = await WorkflowModel.create(workflow);

        return toDomain(doc);
    }

    async getById(workflowId) {
        // Next step
        throw new Error("Not implemented");
    }

    async update(workflow, expectedVersion) {
        // Next step
        throw new Error("Not implemented");
    }
}
