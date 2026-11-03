import DeletedNote from "../models/deletedNote.model.js";

/**
 * Record tombstones before physically removing notes.
 *
 * Tombstones are what let an offline client discover a hard delete. Without
 * them, a deleted note is simply absent from the server, which is impossible
 * to distinguish from "this page of a delta sync did not include it".
 */
export const recordNoteTombstones = async (userId, noteIds = []) => {
    const ids = [...new Set(noteIds.filter(Boolean).map((id) => String(id)))];
    if (ids.length === 0) return;

    const deletedAt = new Date();

    await DeletedNote.bulkWrite(
        ids.map((noteId) => ({
            updateOne: {
                filter: { user: userId, noteId },
                update: { $set: { deletedAt } },
                upsert: true,
            },
        })),
        { ordered: false }
    );
};

/**
 * A note id can be reused by a client after a hard delete (for example a stale
 * queued CREATE). If the note is recreated, its old tombstone must not delete
 * it again on another device.
 */
export const clearNoteTombstone = async (userId, noteId) => {
    if (!noteId) return;
    await DeletedNote.deleteOne({ user: userId, noteId });
};

export const findNoteTombstonesSince = async (userId, since) => {
    const tombstones = await DeletedNote.find({
        user: userId,
        deletedAt: { $gte: since },
    })
        .select("noteId -_id")
        .lean();

    return tombstones.map((tombstone) => String(tombstone.noteId));
};
