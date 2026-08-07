import Dexie from "dexie";
import { dbSchema } from "./tables";
import type { Note } from "@/store/useNoteStore";
import type { Folder } from "@/store/useFolderStore";

export class NotesDatabase extends Dexie {
    notes!: Dexie.Table<Note, string>;
    folders!: Dexie.Table<Folder, string>;
    
    constructor() {
        super("NotesifyDB");
        this.version(1).stores(dbSchema);
    }
}

export const db = new NotesDatabase();