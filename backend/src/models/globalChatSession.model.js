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


const GlobalChatSession = mongoose.model("GlobalChatSession", globalChatSessionSchema);
export default GlobalChatSession;

