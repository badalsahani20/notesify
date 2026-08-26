import { db, type SyncOperation } from "@/database/database";
import axios from "axios";


class SyncEngine {
    private isProcessing: boolean = false;
    private isPulling: boolean = false;
    private _remoteNotes?: any;
    private _remoteFolders?: any;

    private async getRemoteNotes() {
        if (!this._remoteNotes) {
            const { RemoteNoteDataSource } = await import("@/repositories/api/RemoteNoteDataSource");
            this._remoteNotes = new RemoteNoteDataSource();
        }
        return this._remoteNotes;
    }

    private async getRemoteFolders() {
        if (!this._remoteFolders) {
            const { RemoteFolderDataSource } = await import("@/repositories/api/RemoteFolderDataSource");
            this._remoteFolders = new RemoteFolderDataSource();
        }
        return this._remoteFolders;
    }

    async processQueue(): Promise<void> {
        // Single-flight guard: don't run if already running or offline
        if (this.isProcessing || !navigator.onLine) {
            return;
        }

        this.isProcessing = true;

        try {
            // Continuous draining loop
            while (true) {
                // Fetch the oldest operation
                const operation = await db.syncQueue.orderBy('timestamp').first();

                if (!operation) {
                    break; // Queue is empty!
                }

                const success = await this.processOperation(operation);

                if (success) {
                    // Success! Remove from queue and continue loop
                    if (operation.id) {
                        await db.syncQueue.delete(operation.id);
                    }
                } else {
                    // The operation hit a transient error (Network/5xx/401). 
                    // We must stop the queue completely to preserve order.
                    break;
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private async processOperation(operation: SyncOperation): Promise<boolean> {
        try {
            if (operation.entity === "note") {
                await this.routeNoteOperation(operation);
            } else if (operation.entity === "folder") {
                await this.routeFolderOperation(operation);
            }
            return true; 
        } catch (error: any) {
            return await this.handleError(error, operation);
        }
    }

    private async routeNoteOperation(operation: SyncOperation): Promise<void> {
        const payload = operation.payload as any;
        const remoteNotes = await this.getRemoteNotes();
        switch (operation.action) {
            case "CREATE":
                await remoteNotes.createNote(payload);
                break;
            case "UPDATE":
                // Requires the version to be in the payload!
                await remoteNotes.updateNote(operation.entityId, payload, payload.version);
                break;
            case "DELETE":
                // Requires the version to be in the payload!
                await remoteNotes.deleteNote(operation.entityId, payload.version);
                break;
        }
    }

    async pullServerChanges(): Promise<boolean> {
        if(this.isPulling || !navigator.onLine) return false;

        this.isPulling = true;
        let hasChanges = false;
        try {
            const remoteNotesApi = await this.getRemoteNotes();
            const remoteNotes = await remoteNotesApi.getNotes();
            if(!Array.isArray(remoteNotes)) return false;

            const pendingOperations = await db.syncQueue.toArray();
            const pendingIds = new Set(pendingOperations.map(op => op.entityId));
            const remoteIds = new Set(remoteNotes.map(note => note._id));

            for(const remoteNote of remoteNotes) {
                if(!remoteNote?._id) continue;
                //Skip if local note has unsynced pending edits/creation/deletion
                if(pendingIds.has(remoteNote._id)) {
                    continue;
                }

                const localNote = await db.notes.get(remoteNote._id);

                //Update Dexie if local note doesn't exist or remote version is newer
                if(!localNote || (remoteNote.version && remoteNote.version > (localNote.version || 0))) {
                    await db.notes.put(remoteNote);
                    hasChanges = true;
                }
            }

            const allLocalNotes = await db.notes.toArray();
            for(const localNote of allLocalNotes) {
                if (!remoteIds.has(localNote._id)) {
                    if(pendingIds.has(localNote._id)) {
                        continue;
                    }
                    
                    await db.notes.delete(localNote._id);
                    hasChanges = true;
                }
            }
            
            return hasChanges;
        } catch (error) {
            console.warn("[SyncEngine] pullServerChanges warning:", error);
            return false;
        } finally {
            this.isPulling = false;
        }
    }

    private async routeFolderOperation(operation: SyncOperation): Promise<void> {
        const payload = operation.payload as any;
        const remoteFolders = await this.getRemoteFolders();
        switch (operation.action) {
            case "CREATE":
                await remoteFolders.createFolder(payload);
                break;
            case "UPDATE":
                await remoteFolders.updateFolder(operation.entityId, payload, payload.version);
                break;
            case "DELETE":
                await remoteFolders.deleteFolder(operation.entityId, payload.version);
                break;
        }
    }

    private async handleError(error: any, operation: SyncOperation): Promise<boolean> {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;

            // 1. Conflict (409) -> Move to Dead-Letter Queue and CONTINUE
            if (status === 409) {
                console.warn("[SyncService] 409 Conflict detected. Moving to Dead-Letter Queue.", operation.entityId);
                const data = error.response?.data;
                
                await db.transaction('rw', [db.syncQueue, db.conflictLog], async () => {
                    await db.conflictLog.add({
                        entity: operation.entity,
                        entityId: operation.entityId,
                        action: operation.action,
                        operation: operation,
                        reason: "VERSION_CONFLICT",
                        localVersion: (operation.payload as any).version || 0,
                        serverVersion: data?.serverVersion,
                        serverState: data?.serverState,
                        timestamp: Date.now()
                    });
                    if (operation.id) await db.syncQueue.delete(operation.id);
                });
                return true; // Return true to CONTINUTE the queue processing
            }

            // 2. Permanent Failure (400, 403, 422) -> Move to Dead-Letter Queue and CONTINUE
            if (status === 400 || status === 403 || status === 422) {
                console.error("[SyncService] Permanent 4xx Failure. Moving to Dead-Letter Queue.", operation.entityId);
                await db.transaction('rw', [db.syncQueue, db.conflictLog], async () => {
                    await db.conflictLog.add({
                        entity: operation.entity,
                        entityId: operation.entityId,
                        action: operation.action,
                        operation: operation,
                        reason: "PERMANENT_FAILURE",
                        localVersion: (operation.payload as any).version || 0,
                        timestamp: Date.now()
                    });
                    if (operation.id) await db.syncQueue.delete(operation.id);
                });
                return true; // Return true to CONTINUE the queue processing
            }

            // 3. Resource Not Found (404)
            if (status === 404) {
                if (operation.action === "DELETE") {
                    // Idempotent DELETE: The resource is already absent on the server.
                    // Desired state "resource absent" is satisfied. Dequeue and continue processing!
                    console.log(`[SyncService] 404 on DELETE for ${operation.entityId}. Resource already absent on server. Dequeuing operation #${operation.id}.`);
                    if (operation.id) {
                        await db.syncQueue.delete(operation.id);
                    }
                    return true; // Continue FIFO queue processing!
                } else {
                    // 404 on UPDATE/CREATE: Resource missing on server. Move to Dead-Letter Queue and continue.
                    console.error(`[SyncService] 404 on ${operation.action} for ${operation.entityId}. Moving to Dead-Letter Queue.`);
                    await db.transaction('rw', [db.syncQueue, db.conflictLog], async () => {
                        await db.conflictLog.add({
                            entity: operation.entity,
                            entityId: operation.entityId,
                            action: operation.action,
                            operation: operation,
                            reason: "PERMANENT_FAILURE",
                            localVersion: (operation.payload as any).version || 0,
                            timestamp: Date.now()
                        });
                        if (operation.id) await db.syncQueue.delete(operation.id);
                    });
                    return true; // Continue FIFO queue processing!
                }
            }

            // 4. Auth Failure (401) -> PAUSE QUEUE
            if (status === 401) {
                console.warn("[SyncService] 401 Unauthorized. Pausing sync queue until auth is restored.");
                return false; 
            }

            // 4. Server Failure (5xx) -> PAUSE QUEUE
            if (status && status >= 500) {
                console.warn(`[SyncService] ${status} Server Error. Pausing sync queue.`);
                return false; 
            }
        }

        // 5. Network Error (DNS/Offline) -> PAUSE QUEUE
        console.warn("[SyncService] Network error. Pausing sync queue.");
        return false;
    }
}

export const SyncService = new SyncEngine();
