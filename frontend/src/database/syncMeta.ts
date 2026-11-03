import { db } from "./database";

const NOTE_SYNC_CURSOR_KEY = "notes.cursor";

/**
 * The cursor is the server's high-water mark from the last fully applied sync.
 * It is stored in Dexie, not memory, so a reload or a second tab resumes from
 * the same point instead of re-downloading the whole collection.
 */
export const getNoteSyncCursor = async (): Promise<string | null> => {
    const row = await db.syncMeta.get(NOTE_SYNC_CURSOR_KEY);
    return row?.value ?? null;
};

export const setNoteSyncCursor = async (cursor: string): Promise<void> => {
    await db.syncMeta.put({ key: NOTE_SYNC_CURSOR_KEY, value: cursor });
};

export const clearNoteSyncCursor = async (): Promise<void> => {
    await db.syncMeta.delete(NOTE_SYNC_CURSOR_KEY);
};
