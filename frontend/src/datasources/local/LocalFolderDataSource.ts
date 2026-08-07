import { db } from "@/database/database";
import type { Folder } from "@/store/useFolderStore";

export class LocalFolderDataSource {
    async getAll(): Promise<Folder[]> {
        return db.folders.toArray();
    }

    async save(folder: Folder): Promise<void> {
        await db.folders.put(folder);
    }

    async saveMany(folders: Folder[]): Promise<void> {
        await db.folders.bulkPut(folders);
    }

    async delete(id: string): Promise<void> {
        await db.folders.delete(id);
    }
    
}