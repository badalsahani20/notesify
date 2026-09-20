import { useLocation, useParams } from "react-router-dom";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";

let lazyCreatedNoteId: string | null = null;

export const setLazyCreatedNoteId = (id: string | null) => {
  lazyCreatedNoteId = id;
};

export const useNotesLayout = () => {
  const location = useLocation();
  const { noteId } = useParams();
  const focusParam = new URLSearchParams(location.search).get("focus");
  const isEditorFocusMode = Boolean(noteId) && (focusParam === "1" || focusParam === "2");
  const isNotesHidden = Boolean(noteId) && focusParam === "2";
  const isMobile = useMediaQuery("(max-width: 960px)");
  const isSearchRoute = location.pathname.startsWith("/search");
  const isProfileRoute = location.pathname.startsWith("/profile");
  const isChatRoute = location.pathname.startsWith("/chat");
  const showGlobalHeader = !(isEditorFocusMode || (isMobile && Boolean(noteId)) || isChatRoute);

  if (lazyCreatedNoteId && noteId !== "new" && noteId !== lazyCreatedNoteId) {
    lazyCreatedNoteId = null;
  }

  let animationKey = noteId ? `note-${noteId}` : "empty-state";
  if (noteId && noteId === lazyCreatedNoteId) {
    animationKey = "note-new";
  }

  const isFolderWorkspaceRoute = location.pathname.startsWith("/folders") && !noteId;

  // Desktop: FolderPanel is docked directly in middlePanel, so floating drawer is disabled
  const showFoldersPanel = isMobile
    ? false
    : false;

  const showNotesPanel = isMobile
    ? !noteId && !isSearchRoute && !isProfileRoute && !isChatRoute && !isFolderWorkspaceRoute
    : !isNotesHidden && !isChatRoute;

  const showMainPanel = isMobile
    ? Boolean(noteId) || isSearchRoute || isProfileRoute || isChatRoute || isFolderWorkspaceRoute
    : true;

  return {
    showGlobalHeader,
    showFoldersPanel,
    showNotesPanel,
    showMainPanel,
    isMobile,
    animationKey,
    isNoteEditor: Boolean(noteId),
    isFolderWorkspace: isFolderWorkspaceRoute,
  };
};