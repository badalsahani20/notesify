import mongoose, { Schema } from "mongoose";

const learningTaskSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["practice_question", "concept_review", "coding_task", "quiz", "todo"],
      default: "practice_question",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped", "archived"],
      default: "pending",
      index: true,
    },
    topic: {
      type: String,
      default: "General",
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    sourceSessionId: {
      type: Schema.Types.ObjectId,
      ref: "GlobalChatSession",
    },
    completedAt: {
      type: Date,
    },
    skippedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for active tasks and long-term learning history analytics
learningTaskSchema.index({ user: 1, status: 1, updatedAt: -1 });
learningTaskSchema.index({ user: 1, completedAt: -1 });
learningTaskSchema.index({ user: 1, archivedAt: -1 });

const LearningTask = mongoose.model("LearningTask", learningTaskSchema);

export default LearningTask;
