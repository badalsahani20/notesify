import crypto from "crypto";
import mongoose from "mongoose";

const MESSAGE_CAP = 100;

// Typed subdocument — each message has a strict shape with stable id and monotonic sequence
const chatMessageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    seq: {
      type: Number,
      required: true,
      default: 1,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      default: "",
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
    lastSummarizedMessageId: {
      type: String,
      default: null,
    },
    lastSummarizedSeq: {
      type: Number,
      default: 0,
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
    activeAttachmentBundle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatAttachmentBundle",
      default: null,
    },
    pendingInteraction: {
      type: pendingInteractionSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// Sequence enforcement & rolling cap: ensure every message has an id & monotonic seq, then trim if needed
globalChatSessionSchema.pre("save", function (next) {
  let currentMaxSeq = 0;
  for (let i = 0; i < this.messages.length; i++) {
    const msg = this.messages[i];
    if (!msg.id) {
      msg.id = crypto.randomUUID();
    }
    if (typeof msg.seq !== "number" || msg.seq <= currentMaxSeq) {
      msg.seq = currentMaxSeq + 1;
    }
    currentMaxSeq = msg.seq;
  }

  if (this.messages.length > MESSAGE_CAP) {
    this.messages = this.messages.slice(-MESSAGE_CAP);
  }
  next();
});

// Fetch all sessions for a user, newest first
globalChatSessionSchema.index({ user: 1, createdAt: -1 });
globalChatSessionSchema.index({ user: 1, scope: 1, noteId: 1 });
globalChatSessionSchema.index({ user: 1, scope: 1, updatedAt: -1, _id: -1 });


const GlobalChatSession = mongoose.model("GlobalChatSession", globalChatSessionSchema);
export default GlobalChatSession;
