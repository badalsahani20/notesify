import mongoose from "mongoose";

const chatAttachmentFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    relativePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    resourceType: { type: String, default: "raw" },
    extractedText: { type: String, default: "" },
    extractedCharacters: { type: Number, default: 0 },
  },
  { _id: false },
);

const chatAttachmentBundleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["folder", "file"], default: "folder" },
    files: { type: [chatAttachmentFileSchema], default: [] },
    totalBytes: { type: Number, default: 0 },
    extractedCharacters: { type: Number, default: 0 },
  },
  { timestamps: true },
);

chatAttachmentBundleSchema.index({ user: 1, createdAt: -1 });

const ChatAttachmentBundle = mongoose.model(
  "ChatAttachmentBundle",
  chatAttachmentBundleSchema,
);

export default ChatAttachmentBundle;
