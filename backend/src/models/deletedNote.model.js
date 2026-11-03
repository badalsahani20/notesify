import mongoose from "mongoose";

const deletedNoteSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        deletedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { versionKey: false }
);

// A note should only have one active tombstone per user. Re-deleting updates it.
deletedNoteSchema.index({ user: 1, noteId: 1 }, { unique: true });

// Delta sync reads tombstones newer than the client cursor.
deletedNoteSchema.index({ user: 1, deletedAt: 1 });

// Keep tombstones long enough for offline devices to catch up. After this,
// clients with an older cursor are forced into a full resync.
deletedNoteSchema.index(
    { deletedAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const DeletedNote = mongoose.model("DeletedNote", deletedNoteSchema);

export default DeletedNote;
