import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/MainLayout";
import { Toaster } from "sonner";
import PrivateRoute from "./components/PrivateRoute";
import AuthLayout from "./components/AuthLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { WebSyncTriggers } from "./services/WebSyncTriggers";
import { useAuthStore } from "./store/useAuthStore";

// Lazy-loaded components
const NoteEditor = lazy(() => import("./pages/NoteEditor"));
const EmptyState = lazy(() => import("./components/editor/EmptyEditorState"));
const OAuthSuccess = lazy(() => import("./pages/OAuthSuccess"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotesListPanel = lazy(() => import("./components/notes/NotesListPanel"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GlobalChatPage = lazy(() => import("./pages/GlobalChatPage"));
const SharedNotePage = lazy(() => import("./pages/SharedNotePage"));

import WelcomeLoader from "./components/ui/WelcomeLoader";

const RouteLoader = () => <WelcomeLoader />;

function App() {
  const authChecked = useAuthStore((state) => state.authChecked);

  useEffect(() => {
    if (!authChecked) return;
    WebSyncTriggers.start();
    return () => WebSyncTriggers.stop();
  }, [authChecked]);


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

          {/* Protected routes — redirect to /login if not authenticated */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout middlePanel={<NotesListPanel />} />}>
              <Route index element={<EmptyState />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/chat" element={<GlobalChatPage />} />
              <Route path="/folders" element={<EmptyState />} />
              <Route path="/favorites" element={<EmptyState />} />
              <Route path="/favorites/note/:noteId" element={<NoteEditor />} />
              <Route path="/archive" element={<EmptyState />} />
              <Route path="/archive/note/:noteId" element={<NoteEditor />} />
              <Route path="/trash" element={<EmptyState />} />
              <Route path="/trash/note/:noteId" element={<NoteEditor />} />
              <Route path="/note/:noteId" element={<NoteEditor />} />
              <Route path="/folders/:folderId/note/:noteId" element={<NoteEditor />} />
              <Route path="/folders/:folderId" element={<NoteEditor />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
