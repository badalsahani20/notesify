import { SyncService } from "./SyncService";

class SyncCoordinatorEngine {
    private isSyncing: boolean = false;

    async triggerSync(): Promise<boolean> {
        if (this.isSyncing || !navigator.onLine) {
            return false;
        }

        this.isSyncing = true;

        try {
            // 1. Flush local queued changes to server first (Outbound)
            await SyncService.processQueue();

            // 2. Pull remote changes from server into Dexie (Inbound)
            const changed = await SyncService.pullServerChanges();
            return changed;
        } catch (error) {
            console.warn("[SyncCoordinator] triggerSync warning:", error);
            return false;
        } finally {
            this.isSyncing = false;
        }
    }
}

export const SyncCoordinator = new SyncCoordinatorEngine();
