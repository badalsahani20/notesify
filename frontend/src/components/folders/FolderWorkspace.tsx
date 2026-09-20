import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFolderStore, type Folder } from "@/store/useFolderStore";
import { useNotesQuery } from "@/hooks/notes/useNotesQuery";
import { useCreateNoteMutation } from "@/hooks/notes/useNotesMutations";
import FolderHeader from "./FolderHeader";
import FolderToolbar from "./FolderToolbar";
import { Folder as FolderIcon, Plus, FileText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFolderColor, type FolderColor } from "@/utils/folderColors";
import { FolderFormDialog } from "./FolderFormDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatCardDate(dateString?: string): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const FolderWorkspace: React.FC = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const { folders, addFolder, updateFolder, deleteFolder } = useFolderStore();
  const { data: notes = [] } = useNotesQuery();
  const { mutateAsync: createNote } = useCreateNoteMutation();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortOrder, setSortOrder] = useState<"updatedAt" | "title">("updatedAt");
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  // Rename & Delete state
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isRoot = !folderId;

  // Fallback demo folders for offline preview if database hasn't loaded folders yet
  const demoFolders = useMemo(() => [
    {
      _id: "demo-personal",
      name: "Personal & Ideas",
      color: "blue",
      version: 1,
      isDeleted: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      _id: "demo-engineering",
      name: "Frontend Architecture",
      color: "violet",
      version: 1,
      isDeleted: false,
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      _id: "demo-interview",
      name: "Interview Prep",
      color: "emerald",
      version: 1,
      isDeleted: false,
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      _id: "demo-leetcode",
      name: "LeetCode BrainStorm",
      color: "amber",
      version: 1,
      isDeleted: false,
      updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ], []);

  const availableFolders = folders.length > 0 ? folders : demoFolders;

  const currentFolder = useMemo(() => {
    if (isRoot) return null;
    const found = availableFolders.find((f) => f._id === folderId);
    if (found) return found;
    return {
      _id: folderId || "preview",
      name: folderId && folderId !== "preview" ? `Notebook (${folderId})` : "General Notebook",
      color: "blue",
      version: 1,
      isDeleted: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }, [isRoot, availableFolders, folderId]);

  const folderNotes = useMemo(() => {
    if (isRoot) return [];
    const list = notes.filter((n) => n.folder === folderId && !n.isDeleted && !n.isArchived);
    return list.sort((a, b) => {
      if (sortOrder === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [isRoot, notes, folderId, sortOrder]);

  const handleCreateNote = async () => {
    if (!folderId) return;
    try {
      const newNote = await createNote({ folderId });
      if (newNote?._id) {
        navigate(`/folders/${folderId}/note/${newNote._id}`);
      }
    } catch (err) {
      console.error("Failed to create note in notebook:", err);
    }
  };

  const handleCreateFolder = async (name: string, color: FolderColor) => {
    setIsSavingFolder(true);
    try {
      const newFolder = await addFolder(name, color);
      if (newFolder?._id) {
        setIsNewFolderOpen(false);
        navigate(`/folders/${newFolder._id}`);
      }
    } catch (err) {
      console.error("Failed to create notebook:", err);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleRenameFolder = async (name: string, color: FolderColor) => {
    if (!renameTarget) return;
    setIsSavingFolder(true);
    try {
      await updateFolder(renameTarget._id, { name, color });
      setRenameTarget(null);
    } catch (err) {
      console.error("Failed to rename notebook:", err);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteFolder(deleteTarget._id);
      if (folderId === deleteTarget._id) {
        navigate("/folders");
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete notebook:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent px-6 sm:px-8 py-7">
      <div className="mx-auto max-w-[1400px] flex flex-col gap-5">
        {/* 1. Header */}
        <FolderHeader
          isRoot={isRoot}
          folder={currentFolder}
          folderCount={availableFolders.length}
          noteCount={isRoot ? notes.filter((n) => !n.isDeleted && !n.isArchived).length : folderNotes.length}
          onNewNote={handleCreateNote}
          onNewFolder={() => setIsNewFolderOpen(true)}
          onNavigateRoot={() => navigate("/folders")}
          onMoreActions={currentFolder ? () => setRenameTarget(currentFolder) : undefined}
        />

        {/* 2. Content */}
        {isRoot ? (
          /* ── ALL NOTEBOOKS OVERVIEW ── */
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                All Notebooks ({availableFolders.length})
              </span>
            </div>

            {availableFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500">
                  <FolderIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">No notebooks yet</p>
                  <p className="mt-0.5 text-xs text-zinc-500">Create a notebook to organize your workspace.</p>
                </div>
                <Button
                  onClick={() => setIsNewFolderOpen(true)}
                  size="sm"
                  className="mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create Notebook
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                {availableFolders.map((f) => {
                  const color = getFolderColor(f.color);
                  const fNotes = notes.filter((n) => n.folder === f._id && !n.isDeleted && !n.isArchived);
                  const count = fNotes.length;

                  // Derive a clean, meaningful snippet from top notes in this notebook
                  const validTitles = fNotes
                    .slice(0, 3)
                    .map((n) => n.title?.trim())
                    .filter(Boolean) as string[];
                  const previewSnippet = validTitles.length > 0 ? validTitles.join(", ") : null;

                  return (
                    <div
                      key={f._id}
                      onClick={() => navigate(`/folders/${f._id}`)}
                      className="group relative flex h-[155px] flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035] hover:shadow-md"
                    >
                      {/* Top Row: Icon + Count + Menu */}
                      <div className="flex items-start justify-between">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition-transform duration-200 group-hover:scale-105"
                          style={{
                            backgroundColor: `${color}18`,
                            borderColor: `${color}30`,
                          }}
                        >
                          <FolderIcon className="h-4.5 w-4.5" style={{ color }} />
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.06] tabular-nums">
                            {count} {count === 1 ? "note" : "notes"}
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                aria-label="Notebook options"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem onClick={() => navigate(`/folders/${f._id}`)}>
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenameTarget(f)}>
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(f)}
                                className="text-red-400 focus:text-red-400"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Middle: Title & Note Preview */}
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors truncate">
                          {f.name}
                        </h3>
                        {previewSnippet ? (
                          <p className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed mt-1">
                            {previewSnippet}
                          </p>
                        ) : null}
                      </div>

                      {/* Bottom Row: Timestamp */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/[0.03]">
                        <span>Updated {formatCardDate(f.updatedAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── INSIDE SINGLE NOTEBOOK WORKSPACE ── */
          <div className="flex flex-col gap-4 mt-1">
            {/* Toolbar */}
            <FolderToolbar
              noteCount={folderNotes.length}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortLabel={sortOrder === "updatedAt" ? "Last updated" : "Title"}
              onSortChange={() =>
                setSortOrder((prev) => (prev === "updatedAt" ? "title" : "updatedAt"))
              }
            />

            {/* Notes Section */}
            {folderNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500">
                  <FileText className="h-6 w-6 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">No notes in this notebook</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Click &quot;+ New Note&quot; above to create your first note.
                  </p>
                </div>
                <Button
                  onClick={handleCreateNote}
                  size="sm"
                  className="mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create Note
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                {folderNotes.map((note) => {
                  const plainText = note.content?.replace(/<[^>]*>/g, "").trim() || "Empty note";
                  return (
                    <div
                      key={note._id}
                      onClick={() => navigate(`/folders/${folderId}/note/${note._id}`)}
                      className="group flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035] hover:shadow-md min-h-[140px]"
                    >
                      <div className="flex flex-col gap-1.5">
                        <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                          {note.title || "Untitled Note"}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                          {plainText}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-white/[0.03]">
                        <span>Updated {formatCardDate(note.updatedAt)}</span>
                        <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Open ›
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="flex flex-col gap-1.5">
                {folderNotes.map((note) => {
                  const plainText = note.content?.replace(/<[^>]*>/g, "").trim() || "Empty note";
                  return (
                    <div
                      key={note._id}
                      onClick={() => navigate(`/folders/${folderId}/note/${note._id}`)}
                      className="group flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 cursor-pointer transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <FileText className="h-4 w-4 text-zinc-500 group-hover:text-blue-400 shrink-0 transition-colors" />
                        <span className="text-sm font-medium text-zinc-200 group-hover:text-blue-400 transition-colors truncate">
                          {note.title || "Untitled Note"}
                        </span>
                        <span className="hidden sm:inline text-xs text-zinc-500 truncate max-w-md">
                          {plainText}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 shrink-0 tabular-nums">
                        {formatCardDate(note.updatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Notebook Modal */}
      <FolderFormDialog
        open={isNewFolderOpen}
        mode="create"
        isSaving={isSavingFolder}
        onClose={() => setIsNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
      />

      {/* Rename Notebook Modal */}
      {renameTarget && (
        <FolderFormDialog
          open={Boolean(renameTarget)}
          mode="rename"
          initialValue={renameTarget.name}
          initialColor={renameTarget.color}
          isSaving={isSavingFolder}
          onClose={() => setRenameTarget(null)}
          onSubmit={handleRenameFolder}
        />
      )}

      {/* Delete Notebook Dialog */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Notebook</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{deleteTarget.name}&quot;? Notes in this notebook will not be deleted, but will become unassigned.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Notebook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default FolderWorkspace;
