import Dexie from "dexie";
import { dbSchema } from "./tables";
import type { Note } from "@/store/useNoteStore";
import type { Folder } from "@/store/useFolderStore";


export interface SyncOperation {
    id?: number;
    action: "CREATE" | "UPDATE" | "DELETE";
    entity: "note" | "folder";
    entityId: string;
    payload: unknown;
    timestamp: number;
}

export interface ConflictLog {
    id?: number;
    entity: "note" | "folder";
    action: "UPDATE" | "DELETE";
    entityId: string;
    localVersion: number;
    remoteVersion: number;
    localState: unknown;
    serverState: unknown;
    timestamp: number;
    resolved: boolean;
}

export class NotesDatabase extends Dexie {
    notes!: Dexie.Table<Note, string>;
    folders!: Dexie.Table<Folder, string>;
    syncQueue!: Dexie.Table<SyncOperation, number>;
    conflictLog!: Dexie.Table<ConflictLog, number>;

    constructor() {
        super("NotesifyDB");
        this.version(1).stores(dbSchema);
    }
}

export const db = new NotesDatabase();