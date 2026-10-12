import Dexie from "dexie";
import { dbSchemaV1, dbSchemaV2 } from "./tables";
import type { Note } from "@/store/useNoteStore";
import type { Folder } from "@/store/useFolderStore";

export interface SyncOperation {
    id?: number;
    action: "CREATE" | "UPDATE" | "DELETE" | "HARD_DELETE_NOTE";
    entity: "note" | "folder";
    entityId: string;
    payload: unknown;
    timestamp: number;
}

export interface ConflictRecord {
    id?: number;
    entity: "note" | "folder";
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "HARD_DELETE_NOTE";
    operation: SyncOperation; // The exact failed operation
    reason: "VERSION_CONFLICT" | "PERMANENT_FAILURE";
    status: "UNRESOLVED" | "RESOLVED";
    localVersion: number;
    serverVersion?: number;
    localDraft?: Partial<Note>;
    serverState?: any;
    timestamp: number;
}

export class NotesDatabase extends Dexie {
    notes!: Dexie.Table<Note, string>;
    folders!: Dexie.Table<Folder, string>;
    syncQueue!: Dexie.Table<SyncOperation, number>;
    conflictLog!: Dexie.Table<ConflictRecord, number>;

    constructor() {
        super("NotesifyDB");
        this.version(1).stores(dbSchemaV1);
        this.version(2).stores(dbSchemaV2);
    }
}

export const db = new NotesDatabase();