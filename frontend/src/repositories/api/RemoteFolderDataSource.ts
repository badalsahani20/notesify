import type { IFolderRepository } from "../interfaces/IFolderRepository";
import type { Folder } from "@/store/useFolderStore";
import * as foldersApi from "@/api/folders";

export class RemoteFolderDataSource implements IFolderRepository {
  async getFolders(): Promise<Folder[]> {
    const res = await foldersApi.getFolders();
    return Array.isArray(res.data) ? res.data : [];
  }

  async createFolder(data: {_id?: string; name: string; color?: string }): Promise<Folder> {
    const res = await foldersApi.createFolder(data);
    return res.data.folder;
  }

  async updateFolder(
    id: string,
    updates: Partial<Folder>,
    version: number
  ): Promise<Folder> {
    const res = await foldersApi.updateFolder(id, updates, version);
    return res.data.folder;
  }

  async deleteFolder(id: string, version: number): Promise<void> {
    await foldersApi.deleteFolder(id, version);
  }
}
