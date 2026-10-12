import { db, type ConflictRecord } from "@/database/database";
import { SyncService } from "@/services/SyncService";
import type { Note } from "@/store/useNoteStore";

class ConflictResolutionEngine {
  private conflictChannel: BroadcastChannel | null =
    typeof window !== "undefined" && "BroadcastChannel" in window
      ? new BroadcastChannel("notesify_conflicts")
      : null;

  private broadcastResolution(noteId: string, resolution: "KEEP_MINE" | "KEEP_SERVER" | "MERGED") {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("notesify:conflict-resolved", {
            detail: { entityId: noteId, resolution, timestamp: Date.now() },
          })
        );
        this.conflictChannel?.postMessage({
          type: "CONFLICT_RESOLVED",
          entityId: noteId,
          resolution,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn("[ConflictResolution] Failed to broadcast resolution:", err);
    }
  }

  async getUnresolvedConflict(noteId: string): Promise<ConflictRecord | null> {
    if (!noteId) return null;
    const records = await db.conflictLog
      .where("entityId")
      .equals(noteId)
      .toArray();

    const unresolved = records
      .filter((c) => c.status === "UNRESOLVED" && c.entity === "note")
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return unresolved || null;
  }

  async getAllUnresolvedConflicts(): Promise<ConflictRecord[]> {
    const records = await db.conflictLog.where("status").equals("UNRESOLVED").toArray();
    return records.filter((c) => c.entity === "note");
  }

  /**
   * Keep Mine: Rebase local edit onto the latest known server version and queue an update.
   */
  async resolveKeepMine(noteId: string): Promise<Note> {
    const conflict = await this.getUnresolvedConflict(noteId);
    if (!conflict) {
      throw new Error(`No active conflict found for note ${noteId}`);
    }

    const localNote = await db.notes.get(noteId);
    if (!localNote) {
      throw new Error(`Local note ${noteId} not found`);
    }

    // Determine latest server version from conflict log or serverState snapshot
    const targetServerVersion =
      conflict.serverVersion ??
      conflict.serverState?.version ??
      conflict.localVersion;

    const rebasedNote: Note = {
      ...localNote,
      version: targetServerVersion + 1,
      isConflicted: false,
      conflictId: undefined,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction("rw", [db.notes, db.syncQueue, db.conflictLog], async () => {
      // 1. Save rebased note in local Dexie
      await db.notes.put(rebasedNote);

      // 2. Mark conflict as resolved
      if (conflict.id) {
        await db.conflictLog.update(conflict.id, {
          status: "RESOLVED",
        });
      }

      // 3. Purge any stale quarantined queue items for this note
      const oldOps = await db.syncQueue.where("entityId").equals(noteId).toArray();
      for (const op of oldOps) {
        if (op.id) await db.syncQueue.delete(op.id);
      }

      // 4. Enqueue fresh rebased sync operation with latest server version
      await db.syncQueue.add({
        action: "UPDATE",
        entity: "note",
        entityId: noteId,
        payload: {
          updates: {
            title: rebasedNote.title,
            content: rebasedNote.content,
            folder: rebasedNote.folder,
            color: rebasedNote.color,
            pinned: rebasedNote.pinned,
          },
          version: targetServerVersion,
        },
        timestamp: Date.now(),
      });
    });

    // Notify listeners and trigger queue drainage
    this.broadcastResolution(noteId, "KEEP_MINE");
    SyncService.processQueue().catch(console.error);

    return rebasedNote;
  }

  /**
   * Keep Server: Discard local unmerged changes and accept the server's snapshot.
   */
  async resolveKeepServer(noteId: string): Promise<Note> {
    const conflict = await this.getUnresolvedConflict(noteId);
    if (!conflict) {
      throw new Error(`No active conflict found for note ${noteId}`);
    }

    const localNote = await db.notes.get(noteId);
    const serverState = conflict.serverState;

    if (!serverState) {
      throw new Error(`Server snapshot missing in conflict record for note ${noteId}`);
    }

    const acceptedServerNote: Note = {
      ...(localNote || {}),
      ...serverState,
      isConflicted: false,
      conflictId: undefined,
    };

    await db.transaction("rw", [db.notes, db.syncQueue, db.conflictLog], async () => {
      // 1. Replace local copy with server state
      await db.notes.put(acceptedServerNote);

      // 2. Mark conflict as resolved
      if (conflict.id) {
        await db.conflictLog.update(conflict.id, {
          status: "RESOLVED",
        });
      }

      // 3. Purge stale queued operations for this note
      const oldOps = await db.syncQueue.where("entityId").equals(noteId).toArray();
      for (const op of oldOps) {
        if (op.id) await db.syncQueue.delete(op.id);
      }
    });

    // Notify listeners and drain queue for any other notes
    this.broadcastResolution(noteId, "KEEP_SERVER");
    SyncService.processQueue().catch(console.error);

    return acceptedServerNote;
  }

  /**
   * Merge: Save user-inspected merged content and rebase onto server version.
   */
  async resolveWithMergedContent(
    noteId: string,
    mergedContent: string,
    mergedTitle?: string
  ): Promise<Note> {
    const conflict = await this.getUnresolvedConflict(noteId);
    if (!conflict) {
      throw new Error(`No active conflict found for note ${noteId}`);
    }

    const localNote = await db.notes.get(noteId);
    if (!localNote) {
      throw new Error(`Local note ${noteId} not found`);
    }

    const targetServerVersion =
      conflict.serverVersion ??
      conflict.serverState?.version ??
      conflict.localVersion;

    const mergedNote: Note = {
      ...localNote,
      title: mergedTitle !== undefined ? mergedTitle : localNote.title,
      content: mergedContent,
      version: targetServerVersion + 1,
      isConflicted: false,
      conflictId: undefined,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction("rw", [db.notes, db.syncQueue, db.conflictLog], async () => {
      // 1. Put merged note in local Dexie
      await db.notes.put(mergedNote);

      // 2. Mark conflict resolved
      if (conflict.id) {
        await db.conflictLog.update(conflict.id, {
          status: "RESOLVED",
        });
      }

      // 3. Purge stale operations
      const oldOps = await db.syncQueue.where("entityId").equals(noteId).toArray();
      for (const op of oldOps) {
        if (op.id) await db.syncQueue.delete(op.id);
      }

      // 4. Queue update with target server version
      await db.syncQueue.add({
        action: "UPDATE",
        entity: "note",
        entityId: noteId,
        payload: {
          updates: {
            title: mergedNote.title,
            content: mergedNote.content,
            folder: mergedNote.folder,
            color: mergedNote.color,
            pinned: mergedNote.pinned,
          },
          version: targetServerVersion,
        },
        timestamp: Date.now(),
      });
    });

    this.broadcastResolution(noteId, "MERGED");
    SyncService.processQueue().catch(console.error);

    return mergedNote;
  }
}

export const ConflictResolutionService = new ConflictResolutionEngine();
