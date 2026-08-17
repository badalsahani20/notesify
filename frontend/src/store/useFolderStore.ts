import { create  } from "zustand";
import type { AxiosError } from "axios";
import { folderRepository } from "@/repositories";

export interface Folder {
    _id: string;
    name: string;
    color?: string;
    version: number;
    pinned?: boolean;
    isDeleted: boolean;
    updatedAt: string;
    createdAt: string;
}

interface FolderState {
    folders: Folder[];
    fetchedAt: number;
    hasFetched: boolean;
    loading: boolean;
    error: string | null;
    activeFolderId: string | null;
    fetchFolders: () => Promise<void>;
    addFolder: (name: string) => Promise<Folder | null>;
    updateFolder: (id: string, updates: Partial<Pick<Folder, "name" | "color">>) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    setActiveFolder: (id: string | null) => void;
    reset: () => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
    folders: [],
    fetchedAt: 0,
    hasFetched: false,
    loading: false,
    error: null,
    activeFolderId: null,

    fetchFolders: async () => {
        if (get().fetchedAt > 0) {
            return;
        }
        set({ loading: true, error: null });
        try {
            const folders = await folderRepository.getFolders();
            set({ folders, fetchedAt: Date.now(), hasFetched: true });
        } catch (err) {
            set({ error: "Failed to fetch folders", hasFetched: true });
            console.error("Failed to fetch folders", err);
        }finally{
            set({ loading: false });
        }
    },

    addFolder: async (name: string) => {
        try {
            set({ error: null });
            const folder = await folderRepository.createFolder({ name });
            if (!folder) {
                set({ error: "Error creating folder" });
                return null;
            }
            set({ folders: [...get().folders, folder ] });
            return folder;
        } catch (error) {
            set({ error: "Error creating folder" });
            console.log("Error creating folder", error);
            return null;
        }
    },

    updateFolder: async (id, updates) => {
        const currentFolder = get().folders.find((folder) => folder._id === id);
        if (!currentFolder) return;

        try {
            set({ error: null });
            const updatedFolder = await folderRepository.updateFolder(id, updates, currentFolder.version);
            if (!updatedFolder) return;

            set({
                folders: get().folders.map((folder) => (folder._id === id ? updatedFolder : folder)),
                activeFolderId: get().activeFolderId === id ? updatedFolder._id : get().activeFolderId,
            });
        } catch (error) {
            if ((error as AxiosError)?.response?.status === 409) {
                set({ error: "Conflict detected: folder was updated elsewhere. Refresh and try again." });
                return;
            }
            set({ error: "Error updating folder" });
            console.log("Error updating folder", error);
        }
    },

    deleteFolder: async (id) => {
        const folderToDelete = get().folders.find((folder) => folder._id === id);
        if (!folderToDelete) return;

        try {
            set({ error: null });
            await folderRepository.deleteFolder(id, folderToDelete.version);

            set({
                folders: get().folders.filter((folder) => folder._id !== id),
                activeFolderId: get().activeFolderId === id ? null : get().activeFolderId,
            });
        } catch (error) {
            if ((error as AxiosError)?.response?.status === 409) {
                set({ error: "Conflict detected: folder changed on another device. Refresh and try delete again." });
                return;
            }
            set({ error: "Error deleting folder" });
            console.log("Error deleting folder", error);
        }
    },

    setActiveFolder: (_id) => set({ activeFolderId:_id}),
    reset: () => set({ 
        folders: [], 
        fetchedAt: 0, 
        hasFetched: false, 
        loading: false, 
        error: null, 
        activeFolderId: null 
    }),
}))
