import type { Folder } from "@/store/useFolderStore";

export interface IFolderRepository {
    getFolders(): Promise<Folder[]>;
    createFolder(name: string): Promise<Folder>;
    updateFolder(id: string, updates: Partial<Folder>, version: number): Promise<Folder>;
    deleteFolder(id: string, version: number): Promise<void>;
}
