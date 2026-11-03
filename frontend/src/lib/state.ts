import { useAuthStore } from "../store/useAuthStore";
import { useNoteStore } from "../store/useNoteStore";
import { useFolderStore } from "../store/useFolderStore";
import { useGlobalChatStore } from "../store/useGlobalChatStore";
import { useNotificationStore } from "../store/useNotificationStore";
import { queryClient } from "./queryClient";
import { db } from "@/database/database";
import { clearStoredRefreshToken } from "./refreshTokenStorage";

 // Completely wipes all local application state when user logs out or session expires.

export const clearAllLocalState = ({ clearLocalDatabase = true }: { clearLocalDatabase?: boolean } = {}) => {
  // 1. Clear Zustand stores
  useAuthStore.getState().clearAuth();
  useNoteStore.getState().reset();
  useFolderStore.getState().reset();
  useGlobalChatStore.getState().reset();
  useNotificationStore.getState().reset();
  
  if (clearLocalDatabase) {
    db.notes.clear().catch(console.error);
    db.folders.clear().catch(console.error);
    // The sync cursor is user-specific. Keeping it across logout would make
    // the next user skip their initial full snapshot. Queued operations and
    // conflicts are also user data and must not leak across accounts.
    db.syncMeta.clear().catch(console.error);
    db.syncQueue.clear().catch(console.error);
    db.conflictLog.clear().catch(console.error);
  }

  // 2. Clear React Query cache
  queryClient.clear();

  // 3. Clear Desktop / Mobile Tokens
  clearStoredRefreshToken().catch(console.error);
};
