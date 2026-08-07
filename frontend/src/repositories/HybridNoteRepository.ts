import type { INoteRepository } from "./interfaces/INoteRepository";
import type { Note } from "@/store/useNoteStore";
import type { LocalNoteDataSource } from "@/datasources/local/LocalNoteDataSource";
import type { RemoteNoteDataSource } from "./api/RemoteNoteDataSource";

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

    async getNotes(): Promise<Note[]> {
        const localNotes = await this.localDB.getAll();

        if (localNotes.length > 0) {
            return localNotes;
        }

        const remoteNotes = await this.remoteAPI.getNotes();
        await this.localDB.saveMany(remoteNotes);
        return remoteNotes;
    }

    async getNote(noteId: string): Promise<Note> {
        const localNote = await this.localDB.getById(noteId);

        if (localNote) {
            return localNote;
        }

        const remoteNote = await this.remoteAPI.getNote(noteId);
        await this.localDB.save(remoteNote);
        return remoteNote;
    }

    async createNote(data: {folderId?: string | null; title?: string; content?: string }): Promise<Note>{
        const newNote = await this.remoteAPI.createNote(data);
        await this.localDB.save(newNote);
        return newNote;
    }

    async updateNote(id: string, updates: Partial<Note>, version: number): Promise<Note> {
        const updatedNote = await this.remoteAPI.updateNote(id, updates, version);
        await this.localDB.save(updatedNote);
        return updatedNote;
    }

    async getArchivedNotes(): Promise<Note[]> {
        const remoteNotes = await this.remoteAPI.getArchivedNotes();
        await this.localDB.saveMany(remoteNotes);
        return remoteNotes;
    }

    async togglePin(id: string, version: number): Promise<Note> {
        const updatedNote = await this.remoteAPI.togglePin(id, version);
        await this.localDB.save(updatedNote);
        return updatedNote;
    }

    async toggleArchive(id: string, version: number): Promise<Note> {
        const updatedNote = await this.remoteAPI.toggleArchive(id, version);
        await this.localDB.save(updatedNote);
        return updatedNote;
    }

    async deleteNote(id: string, version: number): Promise<void> {
        await this.remoteAPI.deleteNote(id, version);
        await this.localDB.delete(id);
    }
}