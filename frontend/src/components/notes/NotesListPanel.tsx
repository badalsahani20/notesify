import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Clock, ArrowDownAz, ListFilter } from "lucide-react";
import NoteCard from "./NoteCard";
import FolderCard from "../folders/FolderCard";
import NoteDeleteDialog, { SKIP_NOTE_DELETE_CONFIRM_KEY } from "@/components/notes/NoteDeleteDialog";
import NotesPanelHeader from "@/components/notes/NotesPanelHeader";
import NotesPanelSearch from "@/components/notes/NotesPanelSearch";
import { useNotesFilter } from "@/hooks/notes/useNotesFilter";
import { useFolderStore } from "@/store/useFolderStore";
import { useNoteStore, type Note, type TrashFolder } from "@/store/useNoteStore";
import { NotesListSkeleton } from "@/components/ui/notesListSkeleton";
import { useNotesQuery, useTrashQuery, useArchivedQuery } from "@/hooks/notes/useNotesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useDeleteNoteMutation,
  usePermanentDeleteNoteMutation,
  useEmptyTrashMutation,
  useRestoreNoteMutation,
  useRestoreFolderMutation,
  usePermanentDeleteFolderMutation,
  useTogglePinMutation,
  useToggleArchiveMutation
} from "@/hooks/notes/useNotesMutations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isRenderableNote = (value: unknown): value is Note => {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Note)._id === "string";
};

// Preserves the rendered list window across navigation so returning to the list
// doesn't flash/collapse back to a small slice of notes.
let rememberedRenderLimit = 35;

const NotesListPanel = () => {
  const { searchQuery, setSearchQuery } = useNoteStore();

  const { mutateAsync : deleteNoteAsync, isPending : isDeleteNotePending } = useDeleteNoteMutation();
  const { mutateAsync : togglePinning } = useTogglePinMutation();
  const { mutateAsync : restoreNote } = useRestoreNoteMutation();
  const { mutateAsync : permanentDeleteNote } = usePermanentDeleteNoteMutation();
  const { mutateAsync : emptyTrash } = useEmptyTrashMutation();
  const { mutateAsync : toggleArchive } = useToggleArchiveMutation();

  const { mutateAsync : restoreFolder } = useRestoreFolderMutation();
  const { mutateAsync : permanentDeleteFolder } = usePermanentDeleteFolderMutation();

  const { folders, hasFetched: hasFetchedFolders } = useFolderStore();
  const queryClient = useQueryClient();
  const { noteId, folderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isFocusMode = searchParams.get("focus") === "1";
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"updatedAt" | "title">("updatedAt");

  const isTrashRoute = location.pathname.startsWith("/trash");
  const isArchiveRoute = location.pathname.startsWith("/archive");

  const { data: queryNotes = [], isLoading: isNotesLoading, isError: isNoteError, error: notesError } = useNotesQuery();
  const { data: trashData, isLoading: isTrashLoading } = useTrashQuery(isTrashRoute);
  const { data: archivedNotes = [], isLoading: isArchiveLoading } = useArchivedQuery(isArchiveRoute);

  const trash = useMemo(() => {
    return Array.isArray(trashData?.notes) ? trashData.notes : [];
  }, [trashData]);

  const trashFolders = useMemo<TrashFolder[]>(() => {
    return Array.isArray(trashData?.folders) ? (trashData.folders as TrashFolder[]) : [];
  }, [trashData]);

  const closeNoteList = () => {
    const next = new URLSearchParams(location.search);
    next.set("focus", "2");
    navigate(`${location.pathname}?${next.toString()}`, { replace: true });
  };

  const safeNotes = queryNotes.filter(isRenderableNote);

  const {
    filteredNotes,
    panelTitle,
    breadcrumbRoot,
    currentFolderName,
    isFavoritesRoute,
  } = useNotesFilter(safeNotes, folders, searchQuery, trash, archivedNotes);

  const processedNotes = useMemo(() => {
    const notes = [...filteredNotes];

    // Favorited first, then by sortOrder
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      if (sortOrder === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return notes;
  }, [filteredNotes, sortOrder]);

  const isInitialNotesLoad = isTrashRoute
    ? isTrashLoading
    : isArchiveRoute
      ? isArchiveLoading
      : isNotesLoading || !hasFetchedFolders;

  const currentSelectedNote = useMemo(
    () => [...safeNotes, ...archivedNotes, ...trash].find((item) => item._id === noteId) ?? null,
    [archivedNotes, noteId, safeNotes, trash]
  );

  const headerBreadcrumbRoot = currentFolderName ?? breadcrumbRoot;

  const headerPanelTitle = currentFolderName && currentSelectedNote?.title
    ? currentSelectedNote.title || "Untitled note"
    : panelTitle;

  const headerShowChevron = Boolean(
    currentFolderName ||
    isFavoritesRoute ||
    isArchiveRoute ||
    isTrashRoute
  );

  const filteredTrashFolders = useMemo(() => {
    if (!isTrashRoute) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return trashFolders;
    return trashFolders.filter((folder: TrashFolder) => folder.name.toLowerCase().includes(normalizedQuery));
  }, [isTrashRoute, searchQuery, trashFolders]);


  const combinedTrashItems = useMemo(() => {
    if (!isTrashRoute) return [];
    return [
      ...filteredNotes.map((note) => ({ type: "note" as const, updatedAt: note.updatedAt, item: note })),
      ...filteredTrashFolders.map((folder: TrashFolder) => ({ type: "folder" as const, updatedAt: folder.updatedAt, item: folder })),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filteredNotes, filteredTrashFolders, isTrashRoute]);

  const totalTrashCount = (trash?.length || 0) + (trashFolders?.length || 0);
  const currentNoteIndex = useMemo(
    () => processedNotes.findIndex((item) => item._id === noteId),
    [processedNotes, noteId]
  );

  const handleCreateNote = () => {
    const basePath = folderId ? `/folders/${folderId}/note/new` : `/note/new`;
    navigate(`${basePath}${location.search}`);
  };

  const stampAccess = (id: string) => {
    const now = new Date().toISOString();
    queryClient.setQueryData<Note[]>(["notes"], (old) =>
      old?.map((n) => (n._id === id ? { ...n, lastAccessedAt: now } : n))
    );
  };

  const performDeleteNote = async (id: string) => {
    const noteToDelete = safeNotes.find((n) => n._id === id);
    if (noteToDelete) {
      await deleteNoteAsync({ noteId: id, version: noteToDelete.version });
    }
    if (noteId === id) {
      navigate(folderId ? `/folders/${folderId}` : isArchiveRoute ? "/archive" : isFavoritesRoute ? "/favorites" : "/");
    }
  };

  const handleDeleteNote = async (id: string) => {
    const skipConfirm = window.localStorage.getItem(SKIP_NOTE_DELETE_CONFIRM_KEY) === "true";
    if (skipConfirm) {
      await performDeleteNote(id);
    } else {
      setPendingDeleteNoteId(id);
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteNoteId) return;
    await performDeleteNote(pendingDeleteNoteId);
    setPendingDeleteNoteId(null);
  }, [pendingDeleteNoteId, performDeleteNote]);

  const [stableNow, setStableNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setStableNow(Date.now());
    }, 30000); // 30s is precise enough for "2h ago"
    return () => clearInterval(interval);
  }, []);

  const [renderLimit, setRenderLimit] = useState(() =>
    Math.max(rememberedRenderLimit, Math.min(processedNotes.length, 50))
  );

  useEffect(() => {
    if (renderLimit < processedNotes.length) {
      const timer = setTimeout(() => {
        setRenderLimit((prev) => {
          const next = Math.min(prev + 20, processedNotes.length);
          rememberedRenderLimit = next;
          return next;
        });
      }, 60);
      return () => clearTimeout(timer);
    } else if (processedNotes.length > 0) {
      rememberedRenderLimit = Math.max(rememberedRenderLimit, processedNotes.length);
    }
  }, [renderLimit, processedNotes.length]);

  const handleNoteClick = useCallback((id: string) => {
    stampAccess(id);
    const targetNote = [...safeNotes, ...archivedNotes, ...trash].find(n => n._id === id);
    if (!targetNote) return;

    const basePath = folderId
      ? `/folders/${folderId}/note/${id}`
      : isArchiveRoute
        ? `/archive/note/${id}`
        : isFavoritesRoute
          ? `/favorites/note/${id}`
          : `/note/${id}`;
    navigate(`${basePath}${location.search}`);
  }, [safeNotes, archivedNotes, trash, folderId, isArchiveRoute, isFavoritesRoute, navigate, location.search]);

  const handleTogglePinStable = useCallback((id: string) => {
    const note = [...safeNotes, ...archivedNotes].find(n => n._id === id);
    if (note) {
      void togglePinning({ noteId: id, version: note.version });
    }
  }, [safeNotes, archivedNotes, togglePinning]);

  const handleToggleArchiveStable = useCallback((id: string) => {
    const note = [...safeNotes, ...archivedNotes].find(n => n._id === id);
    if (note) {
      void toggleArchive({ noteId: id, version: note.version });
    }
  }, [safeNotes, archivedNotes, toggleArchive]);

  const handleRestoreStable = useCallback((id: string) => {
    void restoreNote(id);
  }, [restoreNote]);

  const handlePermanentDeleteStable = useCallback((id: string) => {
    void permanentDeleteNote(id);
  }, [permanentDeleteNote]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, [contenteditable='true'], .ProseMirror"));
    };

    const openNoteAtIndex = (index: number) => {
      const target = processedNotes[index];
      if (!target || isTrashRoute) return;

      const basePath = folderId
        ? `/folders/${folderId}/note/${target._id}`
        : isArchiveRoute
          ? `/archive/note/${target._id}`
          : isFavoritesRoute
            ? `/favorites/note/${target._id}`
            : `/note/${target._id}`;
      navigate(`${basePath}${location.search}`);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (isTypingTarget(event.target) || processedNotes.length === 0 || isTrashRoute) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentNoteIndex >= 0
          ? Math.min(processedNotes.length - 1, Math.max(0, currentNoteIndex + delta))
          : delta > 0
            ? 0
            : processedNotes.length - 1;
        openNoteAtIndex(nextIndex);
        return;
      }

      if (event.key === "Enter" && currentNoteIndex >= 0) {
        event.preventDefault();
        openNoteAtIndex(currentNoteIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentNoteIndex,
    filteredNotes,
    folderId,
    isArchiveRoute,
    isFavoritesRoute,
    isTrashRoute,
    location.search,
    navigate,
    processedNotes,
  ]);

  const shouldShowNotesError = isNoteError && !isTrashRoute && !isArchiveRoute && !isFavoritesRoute;
  const notesErrorMessage = notesError instanceof Error ? notesError.message : "Failed to load notes";
  return (
    <>
      <aside className="desktop-pane mobile-notes-pane">
        <NotesPanelHeader
          breadcrumbRoot={headerBreadcrumbRoot}
          panelTitle={headerPanelTitle}
          showChevron={headerShowChevron}
          isFocusMode={isFocusMode}
          actionLabel={isTrashRoute && totalTrashCount > 0 ? "Clear All" : undefined}
          onAction={isTrashRoute && totalTrashCount > 0 ? () => void emptyTrash() : undefined}
          onClose={closeNoteList}
          onBack={folderId ? () => navigate(`/folders/${folderId}`) : undefined}
        />

        <NotesPanelSearch
          ref={searchInputRef}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onCreateNote={handleCreateNote}
          isPending={false}
          onOpenFavorites={() => navigate(isFavoritesRoute ? "/" : "/favorites")}
          isFavoritesView={isFavoritesRoute}
        />

        <div className="px-4 mb-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-text)]">
            {isTrashRoute 
               ? `Trash (${combinedTrashItems?.length || 0})` 
               : `Notes (${processedNotes?.length || 0})`}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-1.5 p-1.5 cursor-pointer rounded-md transition-colors text-xs font-medium ${
                  sortOrder === "title"
                    ? "text-[var(--accent-strong)] bg-[var(--accent-strong)]/8"
                    : "text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)]"
                }`}
                title="Sort notes"
              >
                <ListFilter size={14} />
                <span className="hidden sm:inline">{sortOrder === "title" ? "Alphabetical" : "Last Updated"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-[var(--panel-bg-strong)] border-[var(--divider)] text-[var(--text-strong)] shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
            >
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-text)] pb-1">Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--divider)]" />
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                <DropdownMenuRadioItem
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] data-[state=checked]:text-[var(--accent-strong)]"
                  value="updatedAt"
                >
                  <Clock size={13} className="mr-2 opacity-60" />
                  Last Updated
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] data-[state=checked]:text-[var(--accent-strong)]"
                  value="title"
                >
                  <ArrowDownAz size={13} className="mr-2 opacity-60" />
                  Alphabetical
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="custom-scrollbar mobile-notes-scroll flex-1 space-y-3 overflow-y-auto px-3 pb-4">
          {isInitialNotesLoad ? (
            <NotesListSkeleton />
          ) : shouldShowNotesError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {notesErrorMessage}
            </motion.div>
          ) : (isTrashRoute ? combinedTrashItems.length === 0 : processedNotes.length === 0) ? (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="empty-pane-message"
            >
              {location.pathname === "/favorites"
                ? "Star a note to keep it here."
                : location.pathname === "/archive"
                  ? "Archive a note to keep it out of your main workspace."
                  : "No notes match this view yet. Create one to start filling the workspace."}
            </motion.div>
          ) : (
            <div key={`${location.pathname}-${sortOrder}`} className="flex flex-col gap-3">
              {isTrashRoute
                ? combinedTrashItems.map((entry) =>
                  entry.type === "note" ? (
                    <NoteCard
                      key={`trash-note-${entry.item._id}`}
                      note={entry.item}
                      isActive={false}
                      isTrashView
                      isArchiveView={false}
                      stableNow={stableNow}
                      onClick={() => { }}
                      onRestore={(id: string) => restoreNote(id)}
                      onPermanentDelete={(id: string) => permanentDeleteNote(id)}
                    />
                  ) : (
                    <FolderCard
                      key={`trash-folder-${entry.item._id}`}
                      folder={entry.item as TrashFolder}
                      isActive={false}
                      isTrashView
                      onClick={() => { }}
                      onRestore={() => void restoreFolder(entry.item._id)}
                      onPermanentDelete={() => void permanentDeleteFolder(entry.item._id)}
                    />
                  )
                )
                : processedNotes.slice(0, renderLimit).map((note) => (
                    <NoteCard
                      key={note._id}
                      note={note}
                      isActive={noteId === note._id}
                      isTrashView={false}
                      isArchiveView={isArchiveRoute}
                      stableNow={stableNow}
                      onClick={() => handleNoteClick(note._id)}
                      onDelete={handleDeleteNote}
                      onRestore={handleRestoreStable}
                      onPermanentDelete={handlePermanentDeleteStable}
                      onTogglePin={handleTogglePinStable}
                      onToggleArchive={handleToggleArchiveStable}
                    />
                ))}
            </div>
          )}
        </div>
      </aside>

      <NoteDeleteDialog
        noteId={pendingDeleteNoteId}
        noteTitle={processedNotes.find((n) => n._id === pendingDeleteNoteId)?.title || "this note"}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteNoteId(null)}
        isPending={isDeleteNotePending}
      />
    </>
  );
};

export default NotesListPanel;
