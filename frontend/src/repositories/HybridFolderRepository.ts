import type { IFolderRepository } from "./interfaces/IFolderRepository";
import type { Folder } from "@/store/useFolderStore";
import type { LocalFolderDataSource } from "@/datasources/local/LocalFolderDataSource";
import type { RemoteFolderDataSource } from "./api/RemoteFolderDataSource";
import { db } from "@/database/database";
import { generateObjectId } from "@/utils/generateObjectId";


export class HybridFolderRepository implements IFolderRepository {
    //Dependency Injection! We pass the data sources into the constructor.
    private localDB: LocalFolderDataSource;
    private remoteAPI: RemoteFolderDataSource;
    constructor(
        localDB: LocalFolderDataSource,
        remoteApi: RemoteFolderDataSource

    ) {
        this.localDB = localDB;
        this.remoteAPI = remoteApi;
    }

    // READ FLOW: Ask Local -> Empty? -> Ask Remote -> Save Local -> Return
    async getFolders(): Promise<Folder[]> {
        const localFolders = await this.localDB.getAll();

        if(localFolders.length > 0) {
            return localFolders;
        }

        const remoteFolders = await this.remoteAPI.getFolders();
        await this.localDB.saveMany(remoteFolders);
        return remoteFolders;
    }

    async createFolder(data: {_id?: string; name: string; }): Promise<Folder> {
        const tempid = generateObjectId();

        const newFolder: Folder = {
            _id: tempid,
            name: data.name,
            color: "bg-gray-100", // default color
            version: 1,
            isDeleted: false,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        await db.transaction('rw', [db.folders, db.syncQueue], async () => {
            await db.folders.put(newFolder);
            await db.syncQueue.add({
                action: "CREATE",
                entity: "folder",
                entityId: tempid,
                payload: { ...data, tempid },
                timestamp: Date.now(),
            });
        });

        return newFolder;
    }

    async updateFolder(id: string, updates: Partial<Folder>, version: number): Promise<Folder> {
        const current = await this.localDB.getById(id);
        if(!current) throw new Error("Folder not found locally");

        const updatedFolder = {
            ...current,
            ...updates,
            version: version + 1
        };

        await db.transaction('rw', [db.folders, db.syncQueue], async () => {
            await db.folders.put(updatedFolder);
            await db.syncQueue.add({
                action: "UPDATE",
                entity: "folder",
                entityId: id,
                payload: { updates, version },
                timestamp: Date.now(),
            });
        });

        return updatedFolder;
    }

    async deleteFolder(id: string, version: number): Promise<void> {
        await db.transaction('rw', [db.folders, db.syncQueue], async () => {
            await db.folders.delete(id);
            await db.syncQueue.add({
                action: "DELETE",
                entity: "folder",
                entityId: id,
                payload: { version },
                timestamp: Date.now()
            });
        });

    }
}