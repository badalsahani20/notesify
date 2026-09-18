import api from "@/lib/api";

export async function getNotes() {
    return api.get("/notes/");
}

export async function getNote(noteId: string) {
    return api.get(`/notes/${noteId}`);
}

export async function getArchivedNotes() {
    return api.get("/notes/archive");
}

export async function createNote(data: {
    _id?: string;
    folderId?: string | null;
    folder?: string | null;
    title?: string;
    content?: string;
    color?: string;
    version?: number;
}) {
    const { _id, folderId = null, folder, title = "Untitled Note", content = "", color, version } = data;
    return api.post("/notes/", {
        ...(_id ? { _id } : {}),
        title,
        content,
        folder: folderId ?? folder ?? null,
        ...(color ? { color } : {}),
        ...(version !== undefined ? { version } : {}),
    });
}

export async function updateNote(noteId: string, updates: any, version: number) {
    return api.put(`/notes/${noteId}`, { ...updates, version });
}

export async function deleteNote(noteId: string, version: number) {
    return api.delete(`/notes/${noteId}`, { data: { version } });
}

export async function togglePin(noteId: string, version: number) {
    return api.patch(`/notes/${noteId}/pin`, { version });
}

export async function toggleArchive(noteId: string, version: number) {
    return api.patch(`/notes/${noteId}/archive`, { version });
}

export async function moveNote(noteId: string, folderId: string | null, version: number) {
    return api.put(`/notes/${noteId}`, { folder: folderId, version });
}

export async function toggleShare(noteId: string, isShared: boolean, expiresAt?: string | null) {
    return api.post(`/notes/${noteId}/share`, { isShared, expiresAt });
}

export async function generateTitle(content: string) {
    return api.post("/notes/generate-title", { content });
}
