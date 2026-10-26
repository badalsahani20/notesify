import mongoose from "mongoose";

const aiAssistCacheSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notes",
      required: false,
      index: true,
    },
    action: {
      type: String,
      enum: ["grammar", "summarize", "explain", "rewrite", "continue", "noteCreation"],
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["selection", "note"],
      required: true,
      index: true,
    },
    inputHash: {
      type: String,
      required: true,
      index: true,
    },
    noteUpdatedAt: {
      type: Date,
      required: true,
      index: true,
    },
    response: {
      action: {
        type: String,
        required: true,
      },
      suggestion: {
        type: String,
        required: true,
      },
      errors: {
        type: [
          {
            start: Number,
            end: Number,
            original: String,
            suggestion: String,
          },
        ],
        default: [],
      },
      original: {
        type: String,
        default: "",
      },
    },
    createdAt: { type: Date, default: Date.now, expires: 86400}
  },
  { timestamps: true, versionKey: false }
);

aiAssistCacheSchema.index(
  { user: 1, note: 1, action: 1, sourceType: 1, inputHash: 1 },
  { unique: true }
);

const AiAssistCache = mongoose.model("AiAssistCache", aiAssistCacheSchema);
export default AiAssistCache;
