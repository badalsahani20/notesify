import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/MainLayout";
import { Toaster } from "sonner";
// import PrivateRoute from "./components/PrivateRoute";
import AuthLayout from "./components/AuthLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { WebSyncTriggers } from "./services/WebSyncTriggers";
import { ElectronSyncTriggers } from "./services/ElectronSyncTriggers";
import { useAuthStore } from "./store/useAuthStore";

// Core layout components imported directly so offline navigation never fails on dynamic chunk fetching
import NotesListPanel from "./components/notes/NotesListPanel";
import FolderWorkspace from "./components/folders/FolderWorkspace";

// Lazy-loaded routes
const NoteEditor = lazy(() => import("./pages/NoteEditor"));
const EmptyState = lazy(() => import("./components/editor/EmptyEditorState"));
const OAuthSuccess = lazy(() => import("./pages/OAuthSuccess"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GlobalChatPage = lazy(() => import("./pages/GlobalChatPage"));
const SharedNotePage = lazy(() => import("./pages/SharedNotePage"));

import WelcomeLoader from "./components/ui/WelcomeLoader";

const RouteLoader = () => <WelcomeLoader />;

function App() {
  const { user, accessToken, authChecked } = useAuthStore();
  const isAuthenticated = Boolean(authChecked && user && (accessToken || !navigator.onLine));

  useEffect(() => {
    if (!isAuthenticated) return;
    const isElectron = window.location.protocol === "file:";
    const triggers = isElectron ? ElectronSyncTriggers : WebSyncTriggers;
    triggers.start();
    return () => triggers.stop();
  }, [isAuthenticated]);

  return (
    <>
      <Toaster position="bottom-right" />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Public routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/signup" element={<Register />} />
          <Route path="/oauth-success" element={<OAuthSuccess />} />
          <Route path="/shared/:slug" element={<SharedNotePage />} />

          {/* Protected routes — temporarily commented out PrivateRoute for UI preview */}
          {/* <Route element={<PrivateRoute />}> */}
            <Route element={<MainLayout middlePanel={<NotesListPanel />} />}>
              <Route index element={<EmptyState />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/chat" element={<GlobalChatPage />} />
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
          {/* </Route> */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
