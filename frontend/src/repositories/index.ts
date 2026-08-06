import { ApiNoteRepository } from "./api/ApiNoteRepository";
import { ApiFolderRepository } from "./api/ApiFolderRepository";

const noteRepository = new ApiNoteRepository();
const folderRepository = new ApiFolderRepository();

export { noteRepository, folderRepository };