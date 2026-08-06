import type { IFolderRepository } from "../interfaces/IFolderRepository";
import type { Folder } from "@/store/useFolderStore";
import * as foldersApi from "@/api/folders";

export class ApiFolderRepository implements IFolderRepository {
  async getFolders(): Promise<Folder[]> {
    const res = await foldersApi.getFolders();
    return Array.isArray(res.data) ? res.data : [];
  }

  async createFolder(name: string): Promise<Folder> {
    const res = await foldersApi.createFolder(name);
    return res.data;
  }

  async updateFolder(
    id: string,
    updates: Partial<Folder>,
    version: number
  ): Promise<Folder> {
    const res = await foldersApi.updateFolder(id, updates, version);
    return res.data;
  }

  async deleteFolder(id: string, version: number): Promise<void> {
    await foldersApi.deleteFolder(id, version);
  }
}