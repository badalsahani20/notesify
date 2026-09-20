import { useState } from "react";
import {
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Folder as FolderType } from "@/store/useFolderStore";
import { useFolderTree } from "@/hooks/notes/useFolderTree";
import { useFolderStore } from "@/store/useFolderStore";
import { useQueryClient } from "@tanstack/react-query";
import { useMoveNoteToFolderMutation } from "@/hooks/notes/useNotesMutations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FolderPanelSkeleton } from "@/components/ui/folderPanelSkeleton";
import { getFolderColor, type FolderColor } from "@/utils/folderColors";


const FolderRow = ({
  folder,
  count,
  active,
  onClick,
  onRename,
  onDelete,
  onDrop,
}: {
  folder: FolderType;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDrop: (noteId: string, version: number) => void;
}) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13.5px] cursor-pointer transition-colors relative",
        active
          ? "bg-white/[0.07] text-white font-medium shadow-sm"
          : "text-zinc-300 hover:text-white hover:bg-white/[0.04]",
        isOver && "bg-blue-500/20 ring-1 ring-blue-500/40"
      )}
      onClick={onClick}
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
          // Ignore malformed drag payloads
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-1">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: getFolderColor(folder.color) }}
        />
        <span className="truncate text-[13.5px] tracking-[-0.01em]">{folder.name}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {count > 0 && (
          <span className="text-xs text-zinc-500 group-hover:hidden transition-all tabular-nums">
            {count}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 focus:text-red-400">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
  const navigate = useNavigate();
  const { addFolder, updateFolder, deleteFolder, loading: foldersLoading } = useFolderStore();

  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderType | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const { mutate: moveNote } = useMoveNoteToFolderMutation();

  const {
    sortedFolders,
    countsByFolder,
    isNotesLoading,
  } = useFolderTree();

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
          <div className="sidebar-folders px-2">
            <div className="flex items-center justify-between py-1.5 px-1 mb-0.5">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                Notebooks
              </span>
              <button
                type="button"
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                onClick={() => setIsCreateDialogOpen(true)}
                aria-label="Create notebook"
                title="Create notebook"
              >
                <Plus size={14} />
              </button>
            </div>

            {(foldersLoading && sortedFolders.length === 0) || isNotesLoading ? (
              <div className="mt-3">
                <FolderPanelSkeleton />
              </div>
            ) : (
              <div className="mt-1 space-y-0.5">
                {sortedFolders.length > 0 ? (
                  sortedFolders.map((folder) => (
                    <FolderRow
                      key={folder._id}
                      folder={folder}
                      count={countsByFolder.get(folder._id) ?? 0}
                      active={folderId === folder._id}
                      onClick={() => navigate(`/folders/${folder._id}`)}
                      onRename={() => void handleRenameFolder(folder)}
                      onDelete={() => void handleDeleteFolder(folder)}
                      onDrop={(id, ver) => moveNote({ noteId: id, folderId: folder._id, version: ver })}
                    />
                  ))
                ) : (
                  <div className="text-xs text-zinc-500 px-3 py-2 text-center">No notebooks yet</div>
                )}

                <button
                  type="button"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1.5 mt-2 text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors w-full rounded-md hover:bg-white/[0.04]"
                >
                  <Plus size={14} className="text-zinc-500" />
                  <span>New Notebook</span>
                </button>
              </div>
            )}
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
