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
                await remoteNotes.updateNote(
                    operation.entityId,
                    payload.updates ?? payload,
                    payload.version,
                );
                break;
            case "DELETE":
                // Requires the version to be in the payload!
                await remoteNotes.deleteNote(operation.entityId, payload.version);
                break;

            case "HARD_DELETE_NOTE":
                await remoteNotes.permanentlyDeleteNote(operation.entityId);
                break;
        }
    }

    async pullServerChanges(): Promise<boolean> {
        if(this.isPulling || !navigator.onLine) return false;

        this.isPulling = true;
        let hasChanges = false;
        try {
            const pendingOperations = await db.syncQueue.toArray();
            const pendingNoteIds = new Set(
                pendingOperations.filter(op => op.entity === "note").map(op => op.entityId),
            );
            const pendingFolderIds = new Set(
                pendingOperations.filter(op => op.entity === "folder").map(op => op.entityId),
            );

            const remoteNotesApi = await this.getRemoteNotes();
            const remoteNotes = await remoteNotesApi.getNotes();
            const archivedNotes = await remoteNotesApi.getArchivedNotes();
            const trashedNotes = await remoteNotesApi.getTrashedNotes();
            if(Array.isArray(remoteNotes)) {
                const allRemoteNotes = [
                    ...remoteNotes,
                    ...(Array.isArray(archivedNotes) ? archivedNotes : []),
                    ...(Array.isArray(trashedNotes) ? trashedNotes : []),
                ];
                const remoteNoteIds = new Set(allRemoteNotes.map(note => note._id));

                for(const remoteNote of allRemoteNotes) {
                    if(!remoteNote?._id || pendingNoteIds.has(remoteNote._id)) continue;

                    const localNote = await db.notes.get(remoteNote._id);
                    if(!localNote || (remoteNote.version && remoteNote.version > (localNote.version || 0))) {
                        await db.notes.put(remoteNote);
                        hasChanges = true;
                    }
                }

                const allLocalNotes = await db.notes.toArray();
                for(const localNote of allLocalNotes) {
                    if (!remoteNoteIds.has(localNote._id) && !pendingNoteIds.has(localNote._id)) {
                        await db.notes.delete(localNote._id);
                        hasChanges = true;
                    }
                }
            }

            const remoteFoldersApi = await this.getRemoteFolders();
            const remoteFolders = await remoteFoldersApi.getFolders();
            if(Array.isArray(remoteFolders)) {
                const remoteFolderIds = new Set(remoteFolders.map(folder => folder._id));

                for(const remoteFolder of remoteFolders) {
                    if(!remoteFolder?._id || pendingFolderIds.has(remoteFolder._id)) continue;

                    const localFolder = await db.folders.get(remoteFolder._id);
                    if(!localFolder || (remoteFolder.version && remoteFolder.version > (localFolder.version || 0))) {
                        await db.folders.put(remoteFolder);
                        hasChanges = true;
                    }
                }

                const allLocalFolders = await db.folders.toArray();
                for(const localFolder of allLocalFolders) {
                    if (!remoteFolderIds.has(localFolder._id) && !pendingFolderIds.has(localFolder._id)) {
                        await db.folders.delete(localFolder._id);
                        hasChanges = true;
                    }
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
                await remoteFolders.updateFolder(
                    operation.entityId,
                    payload.updates ?? payload,
                    payload.version,
                );
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
