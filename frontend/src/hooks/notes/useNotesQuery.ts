import { useQuery } from "@tanstack/react-query";
import type { Note } from "@/store/useNoteStore";
import { useQueryClient } from "@tanstack/react-query";
import { noteRepository } from "@/repositories";
import api from "@/lib/api";
import { db } from "@/database/database";

{/* ["notes"] → active notes
["notes", "archive"] → archived
["notes", "trash"] → deleted */}

const fetchNotes = async (): Promise<Note[]> => {
    const notes = await noteRepository.getNotes();
    return notes;
}

export const useNotesQuery = () => {
    return useQuery({
        queryKey: ["notes"], //All notes
        queryFn: fetchNotes,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    });
};

export const fetchNote = async (noteId: string): Promise<Note> => {
    const note = await noteRepository.getNote(noteId);
    return note;
}

export const useNoteQuery = (noteId: string) => {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: ["note", noteId],
        queryFn: () => fetchNote(noteId),
        enabled: !!noteId,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,

        initialData: () => {
            const notes = queryClient.getQueryData<Note[]>(["notes"])
            return notes?.find((note) => note._id === noteId);
        }
    });
}



export const useTrashQuery = (enabled = true) => {
    return useQuery({
        queryKey: ["notes", "trash"],
        queryFn: async () => {
            if (navigator.onLine) {
                const res = await api.get("/trash/");
                return res.data;
            }

            const notes = await noteRepository.getTrashedNotes();
            const folders = (await db.folders.toArray()).filter(folder => folder.isDeleted);
            return { notes, folders };
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    });
}


export const useArchivedQuery = (enabled = true) => {
    return useQuery({
        queryKey: ["notes", "archive"],
        queryFn: async () => {
            const notes = await noteRepository.getArchivedNotes();
            return notes;
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    });
}


// future usage:["notes"] // all notes
// ["notes", "folder", folderId]
// ["notes", "search", query]
// ["notes", "archive"]
