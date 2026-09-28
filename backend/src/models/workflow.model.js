import mongoose from "mongoose";
import {
    WORKFLOW_STATUS,
    TASK_STATUS,
    CHECKPOINT_STATUS,
    VERDICT,
} from "../services/ai/workflow/domain/workflowConstants.js";

const taskSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        title: { type: String, required: true },
        concept: { type: String, required: true },
        order: { type: Number, required: true },
    },
    { _id: false },
);

const phaseSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        title: { type: String, required: true },
        tasks: { type: [taskSchema], default: [] },
    },
    { _id: false },
)

const taskStateSchema = new mongoose.Schema(
    {
        status: { type: String, enum: Object.values(TASK_STATUS), required: true },
        attempts: { type: Number, default: 0, min: 0 },
        completedAt: { type: Date, default: null },
    },
    { _id: false }
);  

const rubricCriterionSchema = new mongoose.Schema(
    {
        criterion: {
            type: String,
            required: true,
        },
        weight: {
            type: Number,
            min: 0,
            max: 1,
            required: true,
        },
    },
    { _id: false }
);

const evaluationSpecSchema = new mongoose.Schema(
    {
        expectedAnswer: {
            type: String,
            required: true,
        },
        keyConcepts: {
            type: [String],
            default: [],
        },
        rubric: {
            type: [rubricCriterionSchema],
            default: [],
        },
        commonMisconceptions: {
            type: [String],
            default: [],
        },
    },
    { _id: false }
);

const criterionResultSchema = new mongoose.Schema(
    {
        criterion: { type: String, required: true },
        passed: { type: Boolean, required: true },
        notes: { type: String, default: "" },
    },
    { _id: false }
);

const evaluationSchema = new mongoose.Schema(
    {
        verdict: { type: String, enum: Object.values(VERDICT), required: true },
        confidence: { type: Number, min: 0, max: 1, required: true },
        feedback: { type: String, default: null },
        misconceptions: { type: [String], default: [] },
        criterionResults: { type: [criterionResultSchema], default: [] },
        evaluatedAt: { type: Date, required: true },
    },
    { _id: false }
);

const checkpointSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        taskId: { type: String, required: true },
        question: { type: String, required: true },
        evaluationSpec: { type: evaluationSpecSchema, default: null },
        status: { type: String, enum: Object.values(CHECKPOINT_STATUS), required: true },
        userAnswer: { type: String, default: null },
        evaluation: { type: evaluationSchema, default: null },
        presentedAt: { type: Date, default: null },
        answeredAt: { type: Date, default: null },
    },
    { _id: false }
);

const workflowSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.ObjectId,
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
            type: [phaseSchema],
            default: [],
        },

        status: {
            type: String,
            enum: Object.values(WORKFLOW_STATUS),
            default: WORKFLOW_STATUS.DRAFT,
            required: true,
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
            type: Map,
            of: taskStateSchema,
            default: {},
        },

        checkpoints: {
            type: Map,
            of: checkpointSchema,
            default: {},
        },

        version: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

workflowSchema.index({ user: 1, createdAt: -1 });
workflowSchema.index({ user: 1, status: 1, updatedAt: -1 });

const Workflow = mongoose.model("Workflow", workflowSchema);

export default Workflow;