import { SyncCoordinator } from "./SyncCoordinator";
import { queryClient } from "@/lib/queryClient";
import { useFolderStore } from "@/store/useFolderStore";

class WebSyncTriggersManager {
    private isStarted: boolean = false;
    private broadcastChannel: BroadcastChannel | null = null;

    private invalidateNotes = () => {
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
    };

    private runSync = async () => {
        const changed = await SyncCoordinator.triggerSync();
        if (changed) {
            // 1. Invalidate current tab's React Query cache
            this.invalidateNotes();

            // Folder data lives in Zustand, so refresh it explicitly after
            // the sync engine updates Dexie.
            await useFolderStore.getState().refreshFolders();

            // 2. Broadcast to other open browser tabs
            if (this.broadcastChannel) {
                try {
                    this.broadcastChannel.postMessage({ type: "DEXIE_RECONCILED" });
                } catch (e) {}
            }
        }
    };

    start(): void {
        if (this.isStarted) return;
        this.isStarted = true;

        // 1. Initial startup sync
        void this.runSync();

        // 2. DOM event triggers
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") void this.runSync();
        });
        window.addEventListener("online", () => void this.runSync());

        // 3. Cross-tab BroadcastChannel listener
        try {
            this.broadcastChannel = new BroadcastChannel("notesify-sync-channel");
            this.broadcastChannel.onmessage = (event) => {
                if (event.data?.type === "DEXIE_RECONCILED") {
                    this.invalidateNotes();
                }
            };
        } catch (e) {}
    }

    stop(): void {
        if (!this.isStarted) return;
        this.isStarted = false;

        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
    }
}

export const WebSyncTriggers = new WebSyncTriggersManager();
