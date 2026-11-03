import type { Note } from "@/store/useNoteStore";

export interface INoteRepository {
    getNotes(): Promise<Note[]>;
    getNote(id:string): Promise<Note>;
    createNote(data: {_id?: string; folderId?: string | null; title?: string; content?: string }): Promise<Note>;
    updateNote(id: string, updates: Partial<Note>, version: number): Promise<Note>;
    deleteNote(id: string, version: number): Promise<void>;
    getArchivedNotes(): Promise<Note[]>;
    getTrashedNotes(): Promise<Note[]>;
    togglePin(id: string, version: number): Promise<Note>;
    permanentlyDeleteNote(id: string): Promise<void>;
    restoreNote(id: string): Promise<Note>;
    toggleArchive(id: string, version: number): Promise<Note>;
    /**
     * Persist a note that was already created/updated server-side (e.g. by an
     * AI server tool) into the local Dexie store without enqueueing a sync
     * operation — the server write already happened. Optional: only the
     * hybrid repository implements adoption.
     */
    applyRemoteNote?(note: Note): Promise<void>;
}
