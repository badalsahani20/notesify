import mongoose from "mongoose";
import Notes from "../models/notes.model.js";
import { findNoteTombstonesSince } from "./tombstone.service.js";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const SYNC_OVERLAP_MS = 10 * 1000;
// Keep this below the tombstone TTL so a client is forced into a full resync
// before the tombstones it needs can be expired by MongoDB.
export const TOMBSTONE_RETENTION_MS = 80 * 24 * 60 * 60 * 1000;

const badRequest = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
};

// The pagination cursor carries the sync session's high-water mark so every
// page reports the same one. If each page computed its own "now", a note
// updated while page 2 was being read would fall behind the page-2 keyset and
// behind the final high-water mark, and would never be downloaded.
const encodeCursor = (note, highWaterMark) => {
    const updatedAt =
        note.updatedAt instanceof Date
            ? note.updatedAt
            : new Date(note.updatedAt);

    return Buffer.from(
        JSON.stringify({
            updatedAt: updatedAt.toISOString(),
            id: String(note._id),
            highWaterMark: highWaterMark.toISOString(),
        })
    ).toString("base64url");
};

const decodeCursor = (cursor) => {
    try {
        const decoded = JSON.parse(
            Buffer.from(cursor, "base64url").toString("utf8")
        );
        const updatedAt = new Date(decoded.updatedAt);
        const highWaterMark = new Date(decoded.highWaterMark);

        if (
            Number.isNaN(updatedAt.getTime()) ||
            Number.isNaN(highWaterMark.getTime()) ||
            !mongoose.Types.ObjectId.isValid(decoded.id)
        ) {
            throw new Error("Invalid cursor payload");
        }

        return {
            updatedAt,
            id: new mongoose.Types.ObjectId(decoded.id),
            highWaterMark,
        };
    } catch {
        throw badRequest("Invalid sync cursor");
    }
};

/**
 * Return note changes after a cursor, including archived and trashed notes.
 *
 * The cursor is a keyset pair of (updatedAt, _id), not a bare timestamp. The
 * _id tiebreaker prevents pagination from skipping or looping when many notes
 * share the same millisecond (for example a bulk folder delete).
 */
export const getNoteChanges = async ({ userId, since, page, limit }) => {
    const requestedLimit = Number(limit);
    const pageSize = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const sinceMs = since ? Date.parse(since) : null;
    if (since && Number.isNaN(sinceMs)) {
        throw badRequest("Invalid since value");
    }

    const highWaterMark = new Date();

    if (
        !page &&
        sinceMs !== null &&
        sinceMs < highWaterMark.getTime() - TOMBSTONE_RETENTION_MS
    ) {
        const error = new Error(
            "Sync cursor expired. A full resync is required."
        );
        error.statusCode = 410;
        throw error;
    }

    const cursor = page
        ? decodeCursor(page)
        : {
              // Re-read a short overlap window so a write that raced with the
              // previous sync is not lost because of timestamp precision.
              updatedAt:
                  sinceMs === null
                      ? new Date(0)
                      : new Date(sinceMs - SYNC_OVERLAP_MS),
              id: new mongoose.Types.ObjectId("000000000000000000000000"),
              highWaterMark,
          };

    const rows = await Notes.find({
        user: userId,
        // The model has a pre("find") hook that hides archived and deleted
        // notes unless these fields are explicitly present in the query.
        // `$in: [null]` also matches legacy documents where the flag is absent.
        isDeleted: { $in: [true, false, null] },
        isArchived: { $in: [true, false, null] },
        $or: [
            { updatedAt: { $gt: cursor.updatedAt } },
            {
                updatedAt: cursor.updatedAt,
                _id: { $gt: cursor.id },
            },
        ],
    })
        // Embeddings are large and are not needed by the sync client.
        .select("-embedding")
        .sort({ updatedAt: 1, _id: 1 })
        .limit(pageSize + 1)
        .lean();

    const hasMore = rows.length > pageSize;
    const notes = hasMore ? rows.slice(0, pageSize) : rows;
    const lastNote = notes[notes.length - 1];
    const nextPage =
        hasMore && lastNote
            ? encodeCursor(lastNote, cursor.highWaterMark)
            : null;

    // Tombstones only need to be sent on the first page. The client applies
    // them before advancing its cursor, and the overlap window catches any
    // tombstone created while pagination was in progress.
    const deletedIds = page
        ? []
        : await findNoteTombstonesSince(userId, cursor.updatedAt);

    return {
        notes,
        deletedIds,
        nextPage,
        highWaterMark: cursor.highWaterMark.toISOString(),
        hasMore,
    };
};
