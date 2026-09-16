import { SyncCoordinator } from "./SyncCoordinator";
import { queryClient } from "@/lib/queryClient";
import { useFolderStore } from "@/store/useFolderStore";

class ElectronSyncTriggersManager {
  private isStarted: boolean = false;

  private invalidateNotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  private runSync = async () => {
    const changed = await SyncCoordinator.triggerSync();
    if (changed) {
      // 1. Invalidate React Query notes cache
      this.invalidateNotes();

      // 2. Refresh Zustand folder store
      await useFolderStore.getState().refreshFolders();
    }
  };

  private handleFocus = () => {
    void this.runSync();
  };

  private handleOnline = () => {
    void this.runSync();
  };

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    // 1. Initial app startup sync
    void this.runSync();

    // 2. Window focus trigger (when Electron app becomes active)
    window.addEventListener("focus", this.handleFocus);

    // 3. Network reconnection trigger (when Wi-Fi / internet comes back)
    window.addEventListener("online", this.handleOnline);
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;

    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener("online", this.handleOnline);
  }
}

export const ElectronSyncTriggers = new ElectronSyncTriggersManager();
