import mongoose from "mongoose";
import { generateSoftColor } from "../utils/colorUtils.js";

const irisSegmentSchema = new mongoose.Schema(
    {
        kind: { type: String },
        type: { type: String },
        title: { type: String },
        data: { type: String },
        content: { type: String }
    },
    { _id: false }
);

const chatHistoryEntrySchema = new mongoose.Schema(
    {
        id: { type: String },
        role: { type: String },
        content: { type: String },
        segments: {
            type: [irisSegmentSchema],
            default: undefined
        },
        toolCalls: {
            type: [mongoose.Schema.Types.Mixed],
            default: undefined
        }
    },
    { _id: false }
);

const notesSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        default: "Untitled"
    },
    content: {
        type:String,
        default: ""
    },
    folder:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        default: null
    },

    pinned: {
        type: Boolean,
        default: false
    },
    color: {
        type: String,
        default: "#ffffff"
    },
    version: {
        type: Number,
        default: 1
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    lastAccessedAt: {
        type: Date,
        default: null
    },
    grammarErrors: [{
        start: Number,
        end: Number,
        original: String,
        suggestion: String
    }],
    embedding: {
        type: [Number],
        default: []
    },
    lastEmbeddedAt: {
        type: Date,
        default: null
    },
    chatHistory: {
        type: [chatHistoryEntrySchema],
        default: []
    },
    // Sharing
    isShared: {
        type: Boolean,
        default: false
    },
    shareSlug: {
        type: String,
        unique: true,
        sparse: true
    },
    shareExpiresAt: {
        type: Date,
        default: null
    },
    shareViews: {
        type: Number,
        default: 0
    }
},{timestamps: true, versionKey: false});

notesSchema.index({ user: 1, pinned: -1, updatedAt: -1 });
notesSchema.index({ user: 1, folder: 1, updatedAt: -1 });
notesSchema.index({ user: 1, isDeleted: 1, title: "text", content: "text"},
    {
        weights: {
            title: 5,
            content: 1
        }
    }
);
// Compound index for public share slug lookups: GET /api/public/notes/:slug
notesSchema.index({ shareSlug: 1, isShared: 1, isDeleted: 1 });

    // Pre-save hook to assign soft random color if not provided
notesSchema.pre("save", function (next) {
    if(this.isNew && (!this.color || this.color === "#ffffff")) {
        this.color = generateSoftColor();
    }
    next();
});

notesSchema.pre(/^find/, function(next) {
    if (this.getQuery().isDeleted === undefined) {
        this.where({ isDeleted: {$ne: true} });
    }
    if (this.getQuery().isArchived === undefined) {
        this.where({ isArchived: {$ne: true} });
    }
    next();
})


const Notes = mongoose.model("Notes", notesSchema);
export default Notes;
