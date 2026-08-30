import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Folder as FolderType } from "@/store/useFolderStore";
import { useFolderTree } from "@/hooks/notes/useFolderTree";
import { useFolderStore } from "@/store/useFolderStore";
import { useQueryClient } from "@tanstack/react-query";
import { useMoveNoteToFolderMutation, useCreateNoteMutation } from "@/hooks/notes/useNotesMutations";
import { FolderFormDialog } from "./FolderFormDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFolderIcon } from "@/utils/getFolderIcons";
import { type IconComponent } from "@/utils/getFolderIcons";
import { FolderPanelSkeleton } from "@/components/ui/folderPanelSkeleton";
import { getFolderColor, type FolderColor } from "@/utils/folderColors";

const TopLink = ({
  label,
  count,
  active,
  icon: Icon,
  onClick,
  onDrop,
}: {
  label: string;
  count: number;
  active?: boolean;
  icon: IconComponent;
  onClick: () => void;
  onDrop?: (noteId: string, version: number) => void;
}) => {
  const [isOver, setIsOver] = useState(false);

  const readDropPayload = (event: React.DragEvent<HTMLButtonElement>) => {
    const data = event.dataTransfer.getData("application/notesify-note");
    if (!data) return null;

    try {
      const payload = JSON.parse(data) as { noteId?: unknown; version?: unknown };
      if (typeof payload.noteId !== "string" || typeof payload.version !== "number") return null;
      return { noteId: payload.noteId, version: payload.version };
    } catch {
      return null;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        if (onDrop) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        if (!onDrop) return;
        const payload = readDropPayload(e);
        if (payload) onDrop(payload.noteId, payload.version);
      }}
      className={cn(
        "sidebar-link-row cursor-pointer transition-all duration-150",
        active && "sidebar-link-row-active",
        isOver && "bg-indigo-500/15 border border-indigo-500/50 scale-[1.02] shadow-md ring-1 ring-indigo-500/40"
      )}
    >
      <span className="sidebar-link-main" title={label}>
        <Icon size={17} className={`sidebar-link-icon ${active ? "sidebar-link-icon-active" : ""}`} />
        <span className={`sidebar-link-label truncate ${active ? "sidebar-link-label-active" : ""}`}>{label}</span>
      </span>
      <span className="sidebar-count-pill">{count}</span>
    </button>
  );
};

const FolderRow = ({
  folder,
  count,
  active,
  expanded,
  onToggle,
  onClick,
  onRename,
  onDelete,
  onCreateNote,
  onDrop,
}: {
  folder: FolderType;
  count: number;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateNote?: () => void;
  onDrop: (noteId: string, version: number) => void;
}) => {
  const Icon = getFolderIcon(folder.name);
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={cn(
        "sidebar-tree-row sidebar-tree-row-item group transition-all duration-150 relative",
        active && "sidebar-tree-row-active",
        isOver && "bg-indigo-500/15 border border-indigo-500/50 scale-[1.02] shadow-md ring-1 ring-indigo-500/40"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        const data = e.dataTransfer.getData("application/notesify-note");
        if (!data) return;
        try {
          const { noteId, version } = JSON.parse(data);
          if (noteId && typeof version === "number") onDrop(noteId, version);
        } catch {
          // Ignore malformed drag payloads instead of breaking the sidebar.
        }
      }}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center justify-between pr-1">
        <span className="sidebar-link-main cursor-pointer">
          <span
            className="sidebar-folder-chevron cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? <ChevronDown size={15} className="text-[var(--muted-text)]" /> : <ChevronRight size={15} className="text-[var(--muted-text)]" />}
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 transition-transform group-hover:scale-105"
            style={{
              backgroundColor: `${getFolderColor(folder.color)}22`,
              color: getFolderColor(folder.color),
            }}
            title={`Drop notes into ${folder.name}`}
          >
            <Icon
              size={16}
              className={active ? "sidebar-link-icon-active" : "sidebar-link-icon"}
            />
          </span>
          <span title={`Drop notes into ${folder.name}`} className={`sidebar-link-label truncate ${active ? "sidebar-link-label-active" : ""}`}>{folder.name}</span>
        </span>
        <span className="sidebar-count-pill group-hover:hidden transition-all">{count}</span>
      </button>

      {/* Hover Quick Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pl-1">
        {onCreateNote && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateNote();
            }}
            className="p-1 rounded hover:bg-white/10 text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors"
            title="New note in folder"
            aria-label={`Create new note in ${folder.name}`}
          >
            <Plus size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="p-1 rounded hover:bg-white/10 text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors"
          title="Rename folder"
          aria-label={`Rename ${folder.name}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
          title="Delete folder"
          aria-label={`Delete ${folder.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const NoteChildRow = ({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) => {
  return (
    <button type="button" onClick={onClick} className={`sidebar-note-child ${active ? "sidebar-note-child-active" : ""}`}>
      <span className="sidebar-link-main" title={title || "Untitled Note"}>
        <FileText size={16} className={`sidebar-link-icon ${active ? "sidebar-link-icon-active" : ""}`} />
        <span className={`sidebar-link-label truncate ${active ? "sidebar-link-label-active" : ""}`}>{title || "Untitled Note"}</span>
      </span>
    </button>
  );
};


type FolderDeleteDialogProps = {
  folder: FolderType | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

const FolderDeleteDialog = ({ folder, isDeleting, onCancel, onConfirm }: FolderDeleteDialogProps) => (
  <Dialog
    open={folder !== null}
    onOpenChange={(nextOpen) => {
      if (!nextOpen && !isDeleting) onCancel();
    }}
  >
    <DialogContent className="desktop-dialog">
      <DialogHeader>
        <DialogTitle>Delete Notebook?</DialogTitle>
        <DialogDescription className="text-[var(--muted-text)]">
          {folder
            ? `This will move "${folder.name}" and its notes to trash. You can restore them later from Trash.`
            : "This will move the folder and its notes to trash."}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="mt-4 gap-2 sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => void onConfirm()} disabled={isDeleting}>
          {isDeleting ? "Deleting..." : "Delete folder"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const FoldersPanel = () => {
  const { folderId, noteId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addFolder, updateFolder, deleteFolder, loading: foldersLoading } = useFolderStore();

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderType | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const { mutate: moveNote } = useMoveNoteToFolderMutation();
  const { mutateAsync: createNote } = useCreateNoteMutation();

  const {
    allNotes,
    notesByFolder,
    sortedFolders,
    foldersOpen,
    expandedFolders,
    countsByFolder,
    toggleFoldersGroup,
    toggleFolder,
    isNotesLoading,
  } = useFolderTree();

  const filteredFolders = searchQuery.trim()
    ? sortedFolders.filter((f) => f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : sortedFolders;

  const handleCreateNoteInFolder = async (targetFolderId: string) => {
    try {
      const newNote = await createNote({ folderId: targetFolderId });
      if (newNote?._id) {
        navigate(`/folders/${targetFolderId}/note/${newNote._id}`);
      }
    } catch (err) {
      console.error("Failed to create note in folder:", err);
    }
  };

  const isFavoritesRoute = location.pathname.startsWith("/favorites");
  const isArchiveRoute = location.pathname.startsWith("/archive");
  const isTrashRoute = location.pathname.startsWith("/trash");
  const isAllNotesRoute = !folderId && !isFavoritesRoute && !isArchiveRoute && !isTrashRoute;

  const handleCreateFolder = async (name: string, color: FolderColor) => {
    setIsSavingFolder(true);
    try {
      const folder = await addFolder(name, color);
      if (folder?._id) {
        setIsCreateDialogOpen(false);
        navigate(`/folders/${folder._id}`);
      }
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleRenameFolder = async (folder: FolderType) => {
    setRenameTarget(folder);
  };

  const handleDeleteFolder = async (folder: FolderType) => {
    setDeleteTarget(folder);
  };

  const submitRenameFolder = async (name: string, color: FolderColor) => {
    if (!renameTarget || (name === renameTarget.name && color === renameTarget.color)) {
      setRenameTarget(null);
      return;
    }

    setIsSavingFolder(true);
    try {
      await updateFolder(renameTarget._id, { name, color });
      setRenameTarget(null);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deleteTarget) return;

    setIsDeletingFolder(true);
    try {
      await deleteFolder(deleteTarget._id);
      void queryClient.invalidateQueries({ queryKey: ["notes"] });

      if (folderId === deleteTarget._id) {
        navigate(noteId ? `/note/${noteId}` : "/");
      }

      setDeleteTarget(null);
    } finally {
      setIsDeletingFolder(false);
    }
  };



  return (
    <>
      <aside className="desktop-pane sidebar-panel">
        <div className="sidebar-content custom-scrollbar mt-1">
          <div className="hidden-on-mobile">
            <div className="sidebar-static-links">
              <TopLink
                label="All Notes"
                count={allNotes.length}
                active={isAllNotesRoute}
                icon={FileText}
                onClick={() => navigate(noteId ? `/note/${noteId}` : "/")}
                onDrop={(id, ver) => moveNote({ noteId: id, folderId: null, version: ver })}
              />
            </div>

            <div className="sidebar-divider" />
          </div>

          <div className="sidebar-folders">
            <div className="sidebar-folders-header-row">
              <button type="button" className="sidebar-folders-header" onClick={toggleFoldersGroup}>
                <span className="sidebar-section-title">Notebooks</span>
                <ChevronDown size={15} className={`transition-transform ${foldersOpen ? "rotate-0" : "-rotate-90"}`} />
              </button>
              <button
                type="button"
                className="sidebar-create-folder-button"
                onClick={() => setIsCreateDialogOpen(true)}
                aria-label="Create folder"
                title="Create folder"
              >
                <Plus size={15} />
              </button>
            </div>

            {foldersOpen && (
              <div className="px-1 py-1 mt-1">
                <div className="relative flex items-center">
                  <Search size={13} className="absolute left-2 text-[var(--muted-text)] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search folders..."
                    className="w-full bg-[var(--surface-ghost)] border border-[var(--divider)] rounded-md pl-7 pr-6 py-1 text-xs text-[var(--text-strong)] placeholder:text-[var(--muted-text)] focus:outline-none focus:border-[var(--accent-strong)] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 text-[var(--muted-text)] hover:text-[var(--text-strong)]"
                      aria-label="Clear folder search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {(foldersLoading && sortedFolders.length === 0) || isNotesLoading ? (
              <div className="mt-3">
                <FolderPanelSkeleton />
              </div>
            ) : foldersOpen ? (
              <div className="mt-2 space-y-1">
                {filteredFolders.length > 0 ? (
                  filteredFolders.map((folder) => {
                    const expanded = expandedFolders[folder._id] ?? false;
                    const folderNotes = notesByFolder[folder._id] ?? [];

                    return (
                      <div key={folder._id} className="space-y-1">
                        <FolderRow
                          folder={folder}
                          count={countsByFolder.get(folder._id) ?? 0}
                          active={folderId === folder._id}
                          expanded={expanded}
                          onToggle={() => void toggleFolder(folder._id)}
                          onClick={() => navigate(noteId ? `/folders/${folder._id}/note/${noteId}` : `/folders/${folder._id}`)}
                          onRename={() => void handleRenameFolder(folder)}
                          onDelete={() => void handleDeleteFolder(folder)}
                          onCreateNote={() => void handleCreateNoteInFolder(folder._id)}
                          onDrop={(id, ver) => moveNote({ noteId: id, folderId: folder._id, version: ver })}
                        />

                        <div className={`sidebar-folder-children ${expanded ? "sidebar-folder-children-open" : ""}`}>
                          <div className="sidebar-folder-children-inner space-y-1 border-l border-zinc-800/80 hover:border-zinc-700/80 ml-3.5 pl-2 transition-colors">
                            {folderNotes.length > 0 ? (
                              folderNotes.map((note) => (
                                <NoteChildRow
                                  key={note._id}
                                  title={note.title}
                                  active={noteId === note._id}
                                  onClick={() => navigate(`/folders/${folder._id}/note/${note._id}`)}
                                />
                              ))
                            ) : (
                              <div className="sidebar-empty-folder text-xs text-[var(--muted-text)] py-1 pl-2">0 notes</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[var(--muted-text)] px-3 py-2 text-center">No folders found</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <FolderFormDialog
        open={isCreateDialogOpen}
        mode="create"
        isSaving={isSavingFolder}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateFolder}
      />

      <FolderFormDialog
        open={renameTarget !== null}
        mode="rename"
        initialValue={renameTarget?.name ?? ""}
        initialColor={renameTarget?.color}
        isSaving={isSavingFolder}
        onClose={() => setRenameTarget(null)}
        onSubmit={submitRenameFolder}
      />

      <FolderDeleteDialog
        folder={deleteTarget}
        isDeleting={isDeletingFolder}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteFolder}
      />
    </>
  );
};

export default FoldersPanel;
