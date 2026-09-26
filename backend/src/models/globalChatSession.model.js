import mongoose from "mongoose";

const MESSAGE_CAP = 100;

// Typed subdocument — each message has a strict shape
const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    toolCalls: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const interactionQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["single_select", "multi_select", "rank_priority"],
      default: "single_select",
    },
    options: { type: [String], default: [] },
    allowOther: { type: Boolean, default: true },
  },
  { _id: false }
);

const pendingInteractionSchema = new mongoose.Schema(
  {
    interactionId: { type: String, required: true },
    runId: { type: String, required: true },
    type: {
      type: String,
      enum: ["ask_question"],
      required: true,
    },
    question: { type: String, required: true, trim: true },
    options: { type: [String], default: [] },
    questions: { type: [interactionQuestionSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "resuming", "answered", "cancelled", "expired"],
      default: "pending",
    },
    answer: { type: mongoose.Schema.Types.Mixed, default: null },
    checkpointId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const globalChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Chat", // gets replaced by AI-generated title after first message
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
    summary: {
      type: String,
      default: "",
    },
    chatMode: {
      type: String,
      enum: ["study", "casual"],
      default: "casual",
    },
    scope: {
      type: String,
      enum: ["global", "note"],
      default: "global",
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notes",
      default: null,
    },
    pendingInteraction: {
      type: pendingInteractionSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// Rolling cap: before every save, trim to the last MESSAGE_CAP entries
globalChatSessionSchema.pre("save", function (next) {
  if (this.messages.length > MESSAGE_CAP) {
    this.messages = this.messages.slice(-MESSAGE_CAP);
  }
  next();
});

// Fetch all sessions for a user, newest first
globalChatSessionSchema.index({ user: 1, createdAt: -1 });
globalChatSessionSchema.index({ user: 1, scope: 1, noteId: 1 });


const GlobalChatSession = mongoose.model("GlobalChatSession", globalChatSessionSchema);
export default GlobalChatSession;
