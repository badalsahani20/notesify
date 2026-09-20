import React from "react";
import { ArrowLeft, Folder as FolderIcon, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFolderColor } from "@/utils/folderColors";
import type { Folder } from "@/store/useFolderStore";

interface FolderHeaderProps {
  folder?: Folder | null;
  isRoot?: boolean;
  folderCount?: number;
  noteCount: number;
  onNewNote?: () => void;
  onNewFolder?: () => void;
  onMoreActions?: () => void;
  onNavigateRoot?: () => void;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
  folder,
  isRoot = false,
  folderCount = 0,
  noteCount,
  onNewNote,
  onNewFolder,
  onMoreActions,
  onNavigateRoot,
}) => {
  const folderColor = isRoot ? "#3b82f6" : getFolderColor(folder?.color);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Breadcrumbs / Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {isRoot ? (
          <span className="flex items-center gap-1.5 text-zinc-300">
            <FolderIcon className="h-3.5 w-3.5 text-blue-400" />
            <span>Notebooks</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onNavigateRoot}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer group py-0.5"
            title="Back to All Notebooks"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-white shrink-0" />
            <span>All Notebooks</span>
          </button>
        )}
      </nav>

      {/* 2. Folder Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors"
            style={{
              backgroundColor: `${folderColor}1a`,
              borderColor: `${folderColor}33`,
            }}
          >
            <FolderIcon className="h-6 w-6" style={{ color: folderColor }} />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              {isRoot ? "All Notebooks" : (folder?.name || "Untitled Notebook")}
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
              {isRoot ? (
                <>
                  {folderCount} {folderCount === 1 ? "notebook" : "notebooks"} · {noteCount} {noteCount === 1 ? "note" : "notes"}
                </>
              ) : (
                <>
                  {noteCount} {noteCount === 1 ? "note" : "notes"}
                  {folder?.updatedAt && ` · Updated ${formatRelativeTime(folder.updatedAt)}`}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isRoot && onMoreActions && (
            <Button
              variant="outline"
              size="icon"
              onClick={onMoreActions}
              className="h-9 w-9 rounded-lg border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Notebook options</span>
            </Button>
          )}

          {isRoot ? (
            <Button
              onClick={onNewFolder}
              className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs sm:text-sm font-medium text-white shadow hover:bg-blue-500 transition-all active:scale-[0.98]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Notebook
            </Button>
          ) : (
            <Button
              onClick={onNewNote}
              className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs sm:text-sm font-medium text-white shadow hover:bg-blue-500 transition-all active:scale-[0.98]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Note
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderHeader;
