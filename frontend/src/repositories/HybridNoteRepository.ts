import type { INoteRepository } from "./interfaces/INoteRepository";
import type { Note } from "@/store/useNoteStore";
import type { LocalNoteDataSource } from "@/datasources/local/LocalNoteDataSource";
import type { RemoteNoteDataSource } from "./api/RemoteNoteDataSource";
import { db } from "@/database/database";
import { isOnline } from "@/lib/connectivity";
import { generateObjectId } from "@/utils/generateObjectId";

export class HybridNoteRepository implements INoteRepository {
    private localDB: LocalNoteDataSource;
    private remoteAPI: RemoteNoteDataSource;

    constructor(
        localDB: LocalNoteDataSource,
        remoteAPI: RemoteNoteDataSource
    ) {
        this.localDB = localDB;
        this.remoteAPI = remoteAPI;
    }

    async restoreNote(id: string): Promise<Note> {
        const current = await this.localDB.getById(id);
        if(!current) {
            throw new Error("Note not found");
        }

        const restoredNote: Note = {
            ...current,
            isDeleted: false,
            version: current.version + 1,
            updatedAt: new Date().toISOString(),
        };

        await db.transaction("rw", [db.notes, db.syncQueue], async () => {
            await db.notes.put(restoredNote);

            await db.syncQueue.add({
                action: "UPDATE",
                entity: "note",
                entityId: id,
                payload: {
                    updates: { isDeleted: false },
                    version: current.version,
                },
                timestamp: Date.now(),
            });
        });
        return restoredNote;
    }

    async permanentlyDeleteNote(id: string): Promise<void> {
        await db.transaction("rw", [db.notes, db.syncQueue], async () => {
            await db.notes.delete(id);


            await db.syncQueue.add({
                action: "HARD_DELETE_NOTE",
                entity: "note",
                entityId: id,
                payload: {},
                timestamp: Date.now(),
            });
        });
    }

    async getNotes(): Promise<Note[]> {
        const allNotes = await this.localDB.getAll();

        const activeNotes = allNotes.filter(
            note => !note.isDeleted && !note.isArchived,
        );

        if (allNotes.length > 0) {
            return activeNotes;
        }

        if (!isOnline()) return [];

        const remoteNotes = await this.remoteAPI.getNotes();
        await this.localDB.saveMany(remoteNotes);
        return remoteNotes;
    }

    async getNote(noteId: string): Promise<Note> {
        const localNote = await this.localDB.getById(noteId);

        // 1. If present in local Dexie, return immediately for instant (<2ms) local-first load
        if (localNote) {
            return localNote;
        }

        // 2. If missing locally and offline, throw error
        if (!isOnline()) {
            throw new Error("No note found locally");
        }

        // 3. Fall back to remote API only if the note is not cached locally (e.g. direct URL on new device)
        try {
            const remoteNote = await this.remoteAPI.getNote(noteId);
            if (remoteNote) {
                await this.localDB.save(remoteNote);
                return remoteNote;
            }
        } catch (err) {
            console.warn("[HybridNoteRepository] Remote fetch failed:", err);
        }

        throw new Error("No note found locally or remotely");
    }

    async createNote(data: { _id?: string; folderId?: string | null; title?: string; content?: string }): Promise<Note> {
        const tempId = generateObjectId();
                const newNote: Note = {
                    _id: tempId,
                    title: data.title || "Untitled Note",
                    content: data.content || "",
                    folder: data.folderId || null,
                    color: "bg-white",
                    pinned: false,
                    isArchived: false,
                    isDeleted: false,
                    version: 1,
                    updatedAt: new Date().toISOString(),
                    lastAccessedAt: new Date().toISOString(),
                }
        
                await db.transaction('rw', [db.notes, db.syncQueue], async () => {
                    await db.notes.put(newNote);
                    await db.syncQueue.add({
                        action: "CREATE",
                        entity: "note",
                        entityId: tempId,
                        payload: { ...data, _id: tempId, version: 1 },
                        timestamp: Date.now()
                    });
                });
        
                return newNote;
    }

    async updateNote(id: string, updates: Partial<Note>, version: number): Promise<Note> {
        const current = await this.localDB.getById(id);
        if(!current) throw new Error("Note not found locally");

        const updatedNote = {
            ...current,
            ...updates,
            version: version + 1,
            updatedAt: new Date().toISOString()
        };

        await db.transaction('rw', [db.notes, db.syncQueue], async () => {
            await db.notes.put(updatedNote);
            await db.syncQueue.add({
                action: "UPDATE",
                entity: "note",
                entityId: id,
                payload: { updates, version },
                timestamp: Date.now()
            });
        });
        return updatedNote;
    }

    async getArchivedNotes(): Promise<Note[]> {
        const allNotes = await this.localDB.getAll();

        const archivedNotes = allNotes.filter(
            note => !note.isDeleted && note.isArchived,
        );

        if (allNotes.length > 0 || !isOnline()) {
            return archivedNotes;
        }

        const remoteNotes = await this.remoteAPI.getArchivedNotes();
        await this.localDB.saveMany(remoteNotes);
        return remoteNotes;
    }

    async getTrashedNotes(): Promise<Note[]> {
        const allNotes = await this.localDB.getAll();
        const trashedNotes = allNotes.filter(note => note.isDeleted);

        if (allNotes.length > 0 || !isOnline()) {
            return trashedNotes;
        }

        const remoteNotes = await this.remoteAPI.getTrashedNotes();
        await this.localDB.saveMany(remoteNotes);
        return remoteNotes;
    }


    async togglePin(id: string, version: number): Promise<Note> {
        const current = await this.localDB.getById(id);
        if(!current) throw new Error("Note not found locally");

        return this.updateNote(id, { pinned: !current.pinned}, version);
    }

    async toggleArchive(id: string, version: number): Promise<Note> {
        const current = await this.localDB.getById(id);
        if(!current) throw new Error("Note not found locally");

        return this.updateNote(id, { isArchived: !current.isArchived }, version);
    }

    async deleteNote(id: string, version: number): Promise<void> {
        const current = await this.localDB.getById(id);
        if(!current) throw new Error("Note not found locally");

        const trashedNote: Note = {
            ...current,
            isDeleted: true,
            version: current.version + 1,
            updatedAt: new Date().toISOString()
        };

        await db.transaction('rw', [db.notes, db.syncQueue], async () => {
            await db.notes.put(trashedNote);
            await db.syncQueue.add({
                action: "DELETE",
                entity: "note",
                entityId: id,
                payload: { version },
                timestamp: Date.now(),
            });
        });
    }
}
