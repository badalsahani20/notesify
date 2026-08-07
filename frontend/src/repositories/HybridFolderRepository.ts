import type { IFolderRepository } from "./interfaces/IFolderRepository";
import type { Folder } from "@/store/useFolderStore";
import type { LocalFolderDataSource } from "@/datasources/local/LocalFolderDataSource";
import type { RemoteFolderDataSource } from "./api/RemoteFolderDataSource";

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

    async createFolder(name: string): Promise<Folder> {
        const newFolder = await this.remoteAPI.createFolder(name);
        await this.localDB.save(newFolder);
        return newFolder;
    }

    async updateFolder(id: string, updates: Partial<Folder>, version: number): Promise<Folder> {
        const updatedFolder = await this.remoteAPI.updateFolder(id, updates, version);
        await this.localDB.save(updatedFolder);
        return updatedFolder;
    }

    async deleteFolder(id: string, version: number): Promise<void> {
        await this.remoteAPI.deleteFolder(id, version);
        await this.localDB.delete(id);
    }
}