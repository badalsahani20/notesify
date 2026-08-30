import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { Archive, RotateCcw, Star, Trash2, X, MoreVertical } from "lucide-react";
import { stripHtml } from "@/utils/stripHtml";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Note } from "@/store/useNoteStore";
import { getRelativeUpdatedLabel } from "@/utils/getRelativeUpdatedLabel";
import { fetchNote } from "@/hooks/notes/useNotesQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type NoteCardProps = {
  note: Note;
  isActive: boolean;
  /** When true, shows Restore + Delete Permanently buttons instead of the normal trash icon */
  isTrashView?: boolean;
  isArchiveView?: boolean;
  onClick: () => void;
  onDelete?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  onPermanentDelete?: (noteId: string) => void;
  onTogglePin?: (noteId: string) => void;
  onToggleArchive?: (noteId: string) => void;
  stableNow: number;
};

const NoteCard = ({
  note,
  isActive,
  isTrashView = false,
  isArchiveView = false,
  onClick,
  onDelete,
  onRestore,
  onPermanentDelete,
  onTogglePin,
  onToggleArchive,
  stableNow,
}: NoteCardProps) => {
  const preview = useMemo(() => stripHtml(note.content || ""), [note.content]);
  const queryClient = useQueryClient();

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverStart = useCallback((noteId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["note", noteId],
        queryFn: () => fetchNote(noteId),
      });
    }, 150);
  }, [queryClient]);

  const handleHoverEnd = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on component unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => handleHoverStart(note._id)}
      onMouseLeave={handleHoverEnd}
      draggable={!isTrashView}
      onDragStart={(e: React.DragEvent<HTMLElement>) => {
        if (isTrashView) return;
        e.dataTransfer.setData("application/notesify-note", JSON.stringify({ 
          noteId: note._id, 
          version: note.version 
        }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "note-list-row group",
        !isTrashView && "cursor-grab active:cursor-grabbing",
        isActive && "note-list-row-active",
        isTrashView && "cursor-default opacity-80"
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3 cursor-pointer">
        {/* Star / favorite button — hidden in trash view */}
        {!isTrashView && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin?.(note._id);
            }}
            className="transition focus:outline-none cursor-pointer"
            aria-label={note.pinned ? "Unfavorite note" : "Favorite note"}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full p-1 transition-all duration-300 hover:scale-110 active:scale-90", 
                note.pinned ? "hover:bg-amber-500/20 text-amber-500" : "hover:bg-gray-500/20 text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              )}
            >
              <Star size={16} fill={note.pinned ? "currentColor" : "none"} strokeWidth={note.pinned ? 2 : 1.5} />
            </div>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-sm font-semibold text-[var(--text-strong)]">{note.title || "Untitled note"}</h3>
            <span className="shrink-0 text-xs text-[var(--muted-text)]">{getRelativeUpdatedLabel(note.updatedAt, stableNow)}</span>
          </div>

          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--muted-text)]">
            {preview || "No content yet."}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center">
        {isTrashView ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRestore?.(note._id);
              }}
              className="note-row-delete text-green-500 hover:text-green-400"
              aria-label="Restore note"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPermanentDelete?.(note._id);
              }}
              className="note-row-delete text-red-500 hover:text-red-400"
              aria-label="Permanently delete note"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer note-row-delete opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 hover:bg-[var(--surface-ghost)] rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)]"
                aria-label="More actions"
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem className="cursor-pointer" onClick={() => onToggleArchive?.(note._id)}>
                <Archive size={14} className="mr-2" />
                {isArchiveView ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete?.(note._id)} className="text-red-500 focus:text-red-500 cursor-pointer">
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
};

export default React.memo(NoteCard);

