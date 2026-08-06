import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Note } from "@/store/useNoteStore";
import { toast } from "sonner";
import { noteRepository } from "@/repositories";
import api from "@/lib/api";

// Tracks pending title-refresh timers per noteId so autosave doesn't stack them
const titleRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEFAULT_TITLES = new Set(["Untitled Note", "Untitled"]);
const AUTO_TITLE_POLL_INTERVAL_MS = 2000;
const AUTO_TITLE_POLL_MAX_ATTEMPTS = 6;

// --- NORMALIZED UPDATE HELPERS ---
const sortNotes = (notes: Note[]) => {
    return [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt || Date.now()).getTime() - new Date(a.updatedAt || Date.now()).getTime();
    });
};

const updateNoteInList = (list: Note[], updated: Partial<Note> & { _id: string }) =>
    sortNotes(list.map((n) => (n._id === updated._id ? { ...n, ...updated } as Note : n)));

const removeNoteFromList = (list: Note[], noteId: string) =>
    list.filter((n) => n._id !== noteId);

const addNoteToList = (list: Note[], note: Note) =>
    sortNotes([note, ...removeNoteFromList(list, note._id)]);

const scheduleAutoTitleSync = (
    queryClient: ReturnType<typeof useQueryClient>,
    noteId: string,
    attempt = 0
) => {
    const existing = titleRefreshTimers.get(noteId);
    if (existing) clearTimeout(existing);

    if (attempt >= AUTO_TITLE_POLL_MAX_ATTEMPTS) {
        titleRefreshTimers.delete(noteId);
        return;
    }

    const timer = setTimeout(async () => {
        try {
            const note = await noteRepository.getNote(noteId);

            if (!note?._id) {
                titleRefreshTimers.delete(noteId);
                return;
            }

            queryClient.setQueryData(["note", noteId], note);
            queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, note));

            if (DEFAULT_TITLES.has(note.title)) {
                scheduleAutoTitleSync(queryClient, noteId, attempt + 1);
                return;
            }

            titleRefreshTimers.delete(noteId);
        } catch (error) {
            console.error("Failed to sync AI title:", error);
            titleRefreshTimers.delete(noteId);
        }
    }, AUTO_TITLE_POLL_INTERVAL_MS);

    titleRefreshTimers.set(noteId, timer);
};

export const useCreateNoteMutation = () => {
    const queryClient = useQueryClient();


    return useMutation({
        mutationFn: async (params: { folderId?: string | null; title?: string; content?: string } = {}) => {
            const { folderId = null, title = "Untitled Note", content = "" } = params;
            const note = await noteRepository.createNote({ folderId, title, content });
            return note;
        },

        onSuccess: (newNote) => {
            queryClient.setQueryData(["notes"], (old: Note[] = []) => addNoteToList(old, newNote));
            queryClient.setQueryData(["note", newNote._id], newNote); //Single note cache

            if (DEFAULT_TITLES.has(newNote?.title)) {
                scheduleAutoTitleSync(queryClient, newNote._id);
            }
        },
        onError: (error) => {
            console.error("Failed to create note: ", error);
            toast.error("Failed to create note");
        }
    })
}

export const useDeleteNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, version }: { noteId: string, version: number }) => {
            await noteRepository.deleteNote(noteId, version);
        },
        onMutate: async ({ noteId }) => {
            await queryClient.cancelQueries({ queryKey: ["notes"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "archive"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });
            const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);
            
            // Remove from UI instantly
            queryClient.setQueryData(["notes"], (old: Note[] = []) => removeNoteFromList(old, noteId));
            
            
            return { previousNotes };
        },
        onSuccess: (_, variables) => {
            queryClient.removeQueries({ queryKey: ["note", variables.noteId] }); //Remove from cache

            // Invalidate the trash query so it refetches
            queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
        },
        onError: (error: any, _vars, context) => {
            if (error?.response?.status === 404) {
               // Note is already gone on the server. Dont rollback optimistic UI.
               queryClient.invalidateQueries({ queryKey: ["notes"] });
               return;
            }
            queryClient.setQueryData(["notes"], context?.previousNotes);
            console.error("Failed to delete note: ", error);
            toast.error("Failed to delete note");
        }
    });
};

export const useUpdateNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, updates, version }: { noteId: string, updates: Partial<Note>, version: number }) => {
            return await noteRepository.updateNote(noteId, updates, version);
        },
        onMutate: async ({ noteId, updates }) => {
            await queryClient.cancelQueries({ queryKey: ["notes"] });
            await queryClient.cancelQueries({ queryKey: ["note", noteId] });

            const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);
            const previousNote = queryClient.getQueryData<Note>(["note", noteId]);

            queryClient.setQueryData(["notes"], (old: Note[] = []) =>
                updateNoteInList(old, { _id: noteId, ...updates })
            );
            
            if (previousNote) {
                queryClient.setQueryData(["note", noteId], { ...previousNote, ...updates });
            }

            return { previousNotes, previousNote };
        },
        onSuccess: (updatedNote, variables) => {
            queryClient.setQueryData(["note", variables.noteId], updatedNote);
            queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, updatedNote));

            if (DEFAULT_TITLES.has(updatedNote?.title)) {
                scheduleAutoTitleSync(queryClient, variables.noteId);
            }
        },
        onError: (error, { noteId }, context) => {
            queryClient.setQueryData(["notes"], context?.previousNotes);
            if (context?.previousNote) {
                queryClient.setQueryData(["note", noteId], context.previousNote);
            }
            console.error("Failed to update note: ", error);
            toast.error("Failed to save changes");
        }
    });
};

export const useTogglePinMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, version }: { noteId: string, version: number }) => {
            return await noteRepository.togglePin(noteId, version);
        },
        onMutate: async ({ noteId }) => {
            await queryClient.cancelQueries({ queryKey: ["notes"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "archive"] });
            await queryClient.cancelQueries({ queryKey: ["note", noteId] });

            const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);
            const previousArchive = queryClient.getQueryData<Note[]>(["notes", "archive"]);
            const previousNote = queryClient.getQueryData<Note>(["note", noteId]);

            const target = previousNotes?.find(n => n._id === noteId) || 
                           previousArchive?.find(n => n._id === noteId) || 
                           previousNote;

            if (target) {
                const updated = { ...target, pinned: !target.pinned };
                queryClient.setQueryData(["note", noteId], updated);
                queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, updated));
                queryClient.setQueryData(["notes", "archive"], (old: Note[] = []) => updateNoteInList(old, updated));
            }

            return { previousNotes, previousArchive, previousNote };
        },
        onSuccess: (updatedNote, variables) => {
            queryClient.setQueryData(["note", variables.noteId], updatedNote);
            queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, updatedNote));
            queryClient.setQueryData(["notes", "archive"], (old: Note[] = []) => updateNoteInList(old, updatedNote));
        },
        onError: (error: any, { noteId }, context) => {
            if (error?.response?.status === 404) {
               queryClient.invalidateQueries({ queryKey: ["notes"] });
               queryClient.invalidateQueries({ queryKey: ["notes", "archive"] });
               return;
            }
            queryClient.setQueryData(["notes"], context?.previousNotes);
            queryClient.setQueryData(["notes", "archive"], context?.previousArchive);
            if (context?.previousNote) {
                queryClient.setQueryData(["note", noteId], context.previousNote);
            }
            console.error("Failed to favorite note: ", error);
            toast.error("Failed to update favorites");
        },
    });
}

export const useToggleArchiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, version }: { noteId: string; version: number }) => {
            return await noteRepository.toggleArchive(noteId, version);
        },
        onMutate: async ({ noteId }) => {
            await queryClient.cancelQueries({ queryKey: ["notes"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "archive"] });
            await queryClient.cancelQueries({ queryKey: ["note", noteId] });

            const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);
            const previousArchive = queryClient.getQueryData<Note[]>(["notes", "archive"]);
            const previousNote = queryClient.getQueryData<Note>(["note", noteId]);

            const targetNote = previousNotes?.find(n => n._id === noteId) || 
                              previousArchive?.find(n => n._id === noteId) || 
                              previousNote;

            if (targetNote) {
                const isArchived = !targetNote.isArchived;
                const optimisticallyUpdatedNote = { ...targetNote, isArchived };

                queryClient.setQueryData(["note", noteId], optimisticallyUpdatedNote);

                queryClient.setQueryData(["notes"], (old: Note[] = []) => {
                    if (!isArchived) return addNoteToList(old, optimisticallyUpdatedNote);
                    return removeNoteFromList(old, noteId);
                });

                queryClient.setQueryData(["notes", "archive"], (old: Note[] = []) => {
                    if (isArchived) return addNoteToList(old, optimisticallyUpdatedNote);
                    return removeNoteFromList(old, noteId);
                });
            }

            return { previousNotes, previousArchive, previousNote };
        },
        onSuccess: (updatedNote, { noteId }) => {
            queryClient.setQueryData(["note", noteId], updatedNote);
            
            // Re-sync both lists based on the new archival status
            queryClient.setQueryData(["notes"], (old: Note[] = []) => {
                if (!updatedNote.isArchived) return addNoteToList(old, updatedNote);
                return removeNoteFromList(old, noteId);
            });

            queryClient.setQueryData(["notes", "archive"], (old: Note[] = []) => {
                if (updatedNote.isArchived) return addNoteToList(old, updatedNote);
                return removeNoteFromList(old, noteId);
            });
        },
        onError: (error: any, { noteId }, context) => {
            if (error?.response?.status === 404) {
               queryClient.invalidateQueries({ queryKey: ["notes"] });
               queryClient.invalidateQueries({ queryKey: ["notes", "archive"] });
               return;
            }
            queryClient.setQueryData(["notes"], context?.previousNotes);
            queryClient.setQueryData(["notes", "archive"], context?.previousArchive);
            if (context?.previousNote) {
                queryClient.setQueryData(["note", noteId], context.previousNote);
            }
            console.error("Failed to toggle archive status:", error);
            toast.error("Failed to update archive status");
        }
    });
};

export const useRestoreNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteId: string) => {
            const res = await api.patch(`/trash/restore/note/${noteId}`);
            return res.data.note || res.data;
        },

        onMutate: async (noteId) => {
            await queryClient.cancelQueries({ queryKey: ["notes"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });

            const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);
            // Trash cache holds { notes: Note[], folders: [...] }
            const previousTrash = queryClient.getQueryData<{ notes: Note[]; folders: any[] }>(["notes", "trash"]);
            
            const noteToRestore = previousTrash?.notes?.find(n => n._id === noteId);

            if (noteToRestore) {
                const restoredPlaceholder = { ...noteToRestore, isArchived: false, isTrashed: false };

                // remove from trash optimistically
                queryClient.setQueryData(["notes", "trash"], (old: { notes: Note[]; folders: any[] }) => ({
                    ...old,
                    notes: removeNoteFromList(old?.notes ?? [], noteId),
                }));
                
                // add to active notes optimistically
                queryClient.setQueryData(["notes"], (old: Note[] = []) => addNoteToList(old, restoredPlaceholder));
                
                // update single note
                queryClient.setQueryData(["note", noteId], restoredPlaceholder);
            }

            return { previousNotes, previousTrash };
        },
        onSuccess: (restoredNote, noteId) => {
            // Minimal correction: Just replace the data with server's truth wherever it exists
            queryClient.setQueryData(["note", noteId], restoredNote);
            queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, restoredNote));
            queryClient.setQueryData(["notes", "trash"], (old: Note[] = []) => updateNoteInList(old, restoredNote));
        },
        onError: (error: any, _noteId, context) => {
            if (error?.response?.status === 404) {
               queryClient.invalidateQueries({ queryKey: ["notes"] });
               queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
               return;
            }
            queryClient.setQueryData(["notes"], context?.previousNotes);
            queryClient.setQueryData(["notes", "trash"], context?.previousTrash);
            toast.error("Failed to restore note");
        }
    });
};

export const usePermanentDeleteNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteId: string) => {
            await api.delete(`/trash/note/${noteId}`);
        },
        onMutate: async (noteId) => {
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });

            // The trash cache holds { notes: Note[], folders: [...] }, not a flat array
            const previousTrash = queryClient.getQueryData<{ notes: Note[]; folders: any[] }>(["notes", "trash"]);

            if (previousTrash) {
                queryClient.setQueryData(["notes", "trash"], (old: { notes: Note[]; folders: any[] }) => ({
                    ...old,
                    notes: removeNoteFromList(old?.notes ?? [], noteId),
                }));
            }

            return { previousTrash };
        },
        onError: (error: any, _noteId, context) => {
            if (error?.response?.status === 404) {
               queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
               return; 
            }
            queryClient.setQueryData(["notes", "trash"], context?.previousTrash);
            toast.error("Failed to permanently delete note");
        }
    });
};

export const useEmptyTrashMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await api.delete(`/trash/empty`);
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });

            const previousTrash = queryClient.getQueryData<Note[]>(["notes", "trash"]);

            queryClient.setQueryData(["notes", "trash"], []);

            return { previousTrash };
        },
        onError: (_error, _variables, context) => {
            queryClient.setQueryData(["notes", "trash"], context?.previousTrash);
            toast.error("Failed to empty trash");
        }
    });
};

export const useRestoreFolderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (folderId: string) => {
            const res = await api.patch(`/trash/restore/folder/${folderId}`);
            return res.data.folder || res.data;
        },
        onMutate: async () => {
             // Invalidate to refresh both folders and trash
            await queryClient.cancelQueries({ queryKey: ["folders"] });
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["folders"] });
            queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
            toast.success("Folder and its notes restored");
        },
        onError: (error) => {
            console.error("Failed to restore folder:", error);
            toast.error("Failed to restore folder");
        }
    });
};

export const usePermanentDeleteFolderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (folderId: string) => {
            await api.delete(`/trash/folder/${folderId}`);
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["notes", "trash"] });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
            toast.success("Folder permanently deleted");
        },
        onError: (error) => {
            console.error("Failed to permanently delete folder:", error);
            toast.error("Failed to permanently delete folder");
        }
    });
};

export const useMoveNoteToFolderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, folderId, version }: { noteId: string; folderId: string | null; version: number }) => {
            const res = await api.put(`/notes/${noteId}`, {
                folder: folderId,
                version,
            });
            return res.data.updatedNote || res.data.note || res.data;
        },
        onSuccess: (updatedNote, { noteId }) => {
            queryClient.setQueryData(["note", noteId], updatedNote);
            queryClient.invalidateQueries({ queryKey: ["notes"] });
            toast.success(updatedNote.folder ? "Note moved to folder" : "Note moved to All Notes");
        },
        onError: (error) => {
            console.error("Failed to move note:", error);
            toast.error("Failed to move note");
        }
    });
};

export const useToggleShareMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ noteId, isShared, expiresAt }: { noteId: string, isShared: boolean, expiresAt?: string | null }) => {
            const res = await api.post(`/notes/${noteId}/share`, { isShared, expiresAt });
            return res.data.note || res.data;
        },
        onSuccess: (updatedNote, { noteId }) => {
            queryClient.setQueryData(["note", noteId], updatedNote);
            queryClient.setQueryData(["notes"], (old: Note[] = []) => updateNoteInList(old, updatedNote));
            toast.success(updatedNote.isShared ? "Public link enabled" : "Public link disabled");
        },
        onError: (error: any) => {
            console.error("Failed to toggle share status:", error);
            toast.error(error?.response?.data?.message || "Failed to update sharing settings");
        }
    });
};

