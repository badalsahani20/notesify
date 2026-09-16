import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.ts";
import App from "./App.tsx";
import "./index.css";
import { SessionProvider } from "./providers/SessionProvider.tsx";

import { db } from "./database/database";

const isFileProtocol = window.location.protocol === "file:";
const Router = isFileProtocol ? HashRouter : BrowserRouter;

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
