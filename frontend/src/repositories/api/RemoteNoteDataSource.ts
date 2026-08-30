import type { INoteRepository } from "@/repositories/interfaces/INoteRepository";
import type { Note } from "@/store/useNoteStore";
import * as notesApi from "@/api/notes";
import api from "@/lib/api";

const withVersionRetry = async (
    requestFn: (version: number) => Promise<any>,
    initialVersion: number,
    maxRetries = 3
) => {
    let currentVersion = initialVersion;
    let retries = 0;
    
    while (true) {
        try {
            const res = await requestFn(currentVersion);
            return res.data?.updatedNote || res.data?.note || res.data || res;
        } catch (error: any) {
            if (error?.response?.status === 409 && error?.response?.data?.serverVersion && retries < maxRetries) {
                currentVersion = error.response.data.serverVersion.version;
                retries++;
                continue;
            }
            throw error;
        }
    }
};

export class RemoteNoteDataSource implements INoteRepository {
    async getNotes(): Promise<Note[]> {
        const res = await notesApi.getNotes();
        const data = res.data.notes || res.data;

        return Array.isArray(data) ? data : [];
    }

    async getNote(noteId: string): Promise<Note> {
        const res = await notesApi.getNote(noteId);
        return res.data.note || res.data;
    }

    async createNote(data: {_id?: string; folderId?: string | null; title?: string; content?: string }): Promise<Note>{
        const res = await notesApi.createNote(data);
        return res.data.note || res.data;
    }
    
    async updateNote(id: string, updates: Partial<Note>, version: number): Promise<Note> {
        return withVersionRetry(
            async (v) => {
                const res = await notesApi.updateNote(id, updates, v);
                return res.data.updatedNote || res.data.note || res.data;
            },
            version
        );
    }

  async getArchivedNotes(): Promise<Note[]> {
        const res = await notesApi.getArchivedNotes();
        const data = res.data.notes || res.data;
    return Array.isArray(data) ? data : [];
  }

  async getTrashedNotes(): Promise<Note[]> {
    const res = await api.get("/trash/");
    const data = res.data;
    return Array.isArray(data?.notes) ? data.notes : [];
  }

  async permanentlyDeleteNote(id: string): Promise<void> {
    await api.delete(`/trash/note/${id}`);
  }

  async restoreNote(id: string): Promise<Note> {
        const res = await api.patch(`/trash/restore/note/${id}`);
        return res.data.note || res.data;
    }

    async togglePin(id: string, version: number) : Promise<Note> {
        return withVersionRetry(
            async (v) => {
                const res = await notesApi.togglePin(id, v);
                return res.data.updatedNote || res.data.note || res.data;
            },
            version
        )
    }

    async deleteNote(id: string, version: number): Promise<void> {
        const res = await notesApi.deleteNote(id, version);
        return res.data.updatedNote || res.data.note || res.data;
    }

    async toggleArchive(id: string, version: number): Promise<Note> {
        return withVersionRetry(
            async (v) => {
                const res = await notesApi.toggleArchive(id, v);
                return res.data.updatedNote || res.data.note || res.data;
            },
            version
        )
    }
}
