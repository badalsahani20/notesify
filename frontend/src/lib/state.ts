import { useAuthStore } from "../store/useAuthStore";
import { useNoteStore } from "../store/useNoteStore";
import { useFolderStore } from "../store/useFolderStore";
import { useGlobalChatStore } from "../store/useGlobalChatStore";
import { useNotificationStore } from "../store/useNotificationStore";
import { queryClient } from "./queryClient";
import { db } from "@/database/database"

 // Completely wipes all local application state when user logs out or session expires.

export const clearAllLocalState = () => {
  // 1. Clear Zustand stores
  useAuthStore.getState().clearAuth();
  useNoteStore.getState().reset();
  useFolderStore.getState().reset();
  useGlobalChatStore.getState().reset();
  useNotificationStore.getState().reset();
  db.notes.clear().catch(console.error);
  db.folders.clear().catch(console.error);

  // 2. Clear React Query cache
  queryClient.clear();

  // 3. Clear Desktop IPC Tokens
  if (!!(window as any).electronAPI?.auth) {
    (window as any).electronAPI.auth.clearRefreshToken().catch(console.error);
  }
};
