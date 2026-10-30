import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.ts";
import App from "./App.tsx";
import "./index.css";
import { SessionProvider } from "./providers/SessionProvider.tsx";

import { db } from "./database/database";
import { Capacitor } from "@capacitor/core";
import { initializeConnectivity } from "./lib/connectivity";

// Start native connectivity detection before the auth bootstrap runs.
void initializeConnectivity();

const isFileProtocol = window.location.protocol === "file:";
const Router = isFileProtocol ? HashRouter : BrowserRouter;

if (
  typeof window !== "undefined" &&
  (Boolean((window as any).electronAPI) ||
    navigator.userAgent.toLowerCase().includes("electron") ||
    isFileProtocol)
) {
  document.documentElement.classList.add("is-electron");
}

if (typeof window !== "undefined") {
  const savedTheme = localStorage.getItem("notesify_theme");
  if (savedTheme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}

if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("is-capacitor");
}

// Debug helper to inspect Dexie sync queue from browser/Electron console
(window as any).debugSyncQueue = async () => {
  const queue = await db.syncQueue.toArray();
  console.table(queue);
  return queue;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Router>
          <App />
        </Router>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>
);
