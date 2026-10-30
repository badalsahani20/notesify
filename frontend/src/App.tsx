import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/MainLayout";
import { Toaster } from "sonner";
import PrivateRoute from "./components/PrivateRoute";
import { WebSyncTriggers } from "./services/WebSyncTriggers";
import { ElectronSyncTriggers } from "./services/ElectronSyncTriggers";
import { useAuthStore } from "./store/useAuthStore";

// Lazy-load auth pages to reduce initial bundle size
const AuthLayout = lazy(() => import("./components/AuthLayout"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

// Core layout components imported directly so offline navigation never fails on dynamic chunk fetching
import NotesListPanel from "./components/notes/NotesListPanel";
import FolderWorkspace from "./components/folders/FolderWorkspace";

// Lazy-loaded routes with speculative preloading
const preloadNoteEditor = () => import("./pages/NoteEditor");
const NoteEditor = lazy(preloadNoteEditor);
const EmptyState = lazy(() => import("./components/editor/EmptyEditorState"));
const OAuthSuccess = lazy(() => import("./pages/OAuthSuccess"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GlobalChatPage = lazy(() => import("./pages/GlobalChatPage"));
const SharedNotePage = lazy(() => import("./pages/SharedNotePage"));

import WelcomeLoader from "./components/ui/WelcomeLoader";
import { useCapacitorApp } from "./hooks/useCapacitorApp";
import { isOnline } from "./lib/connectivity";

const RouteLoader = () => <WelcomeLoader />;

function App() {
  useCapacitorApp();
  const { user, accessToken, authChecked, offlineSession } = useAuthStore();
  const isAuthenticated = Boolean(
    authChecked && user && (accessToken || offlineSession || !isOnline()),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const isElectron = window.location.protocol === "file:";
    const triggers = isElectron ? ElectronSyncTriggers : WebSyncTriggers;
    triggers.start();

    // Preload heavy NoteEditor and TipTap bundle during browser idle time
    let cleanupIdle: (() => void) | undefined;
    if (typeof window !== "undefined" && !(navigator as any).connection?.saveData) {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(() => {
          void preloadNoteEditor();
        }, { timeout: 2500 });
        cleanupIdle = () => window.cancelIdleCallback(idleId);
      } else {
        const timer = setTimeout(() => {
          void preloadNoteEditor();
        }, 1200);
        cleanupIdle = () => clearTimeout(timer);
      }
    }

    return () => {
      triggers.stop();
      cleanupIdle?.();
    };
  }, [isAuthenticated]);

  return (
    <>
      <Toaster position="bottom-right" />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Public routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/oauth-success" element={<OAuthSuccess />} />
          </Route>
          <Route path="/shared/:slug" element={<SharedNotePage />} />

          {/* Protected routes — requires authentication when online, or local workspace offline */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout middlePanel={<NotesListPanel />} />}>
              <Route index element={<EmptyState />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/chat" element={<GlobalChatPage />} />
              <Route path="/chat/:sessionId" element={<GlobalChatPage />} />
              <Route path="/folders" element={<FolderWorkspace />} />
              <Route path="/favorites" element={<EmptyState />} />
              <Route path="/favorites/note/:noteId" element={<NoteEditor />} />
              <Route path="/archive" element={<EmptyState />} />
              <Route path="/archive/note/:noteId" element={<NoteEditor />} />
              <Route path="/trash" element={<EmptyState />} />
              <Route path="/trash/note/:noteId" element={<NoteEditor />} />
              <Route path="/note/:noteId" element={<NoteEditor />} />
              <Route path="/folders/:folderId/note/:noteId" element={<NoteEditor />} />
              <Route path="/folders/:folderId" element={<FolderWorkspace />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
