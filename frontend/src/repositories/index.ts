import { RemoteNoteDataSource } from "./api/RemoteNoteDataSource";
import { LocalNoteDataSource } from "@/datasources/local/LocalNoteDataSource";
import { RemoteFolderDataSource } from "./api/RemoteFolderDataSource";
import { LocalFolderDataSource } from "@/datasources/local/LocalFolderDataSource";
import { HybridNoteRepository } from "./HybridNoteRepository";
import { HybridFolderRepository } from "./HybridFolderRepository";

const noteRepository = new HybridNoteRepository(
    new LocalNoteDataSource(),
    new RemoteNoteDataSource()
);

const folderRepository = new HybridFolderRepository(
    new LocalFolderDataSource(),
    new RemoteFolderDataSource()
);

export { noteRepository, folderRepository };