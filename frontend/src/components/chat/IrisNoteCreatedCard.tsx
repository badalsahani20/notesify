import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileEdit, ArrowRight, ExternalLink, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";
import { noteRepository } from "@/repositories";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import type { Note } from "@/store/useNoteStore";

interface IrisNoteCreatedCardProps {
  noteId?: string;
  title?: string;
  content?: string;
  variant?: "created" | "updated";
  state?: "pending" | "running" | "completed" | "error";
  error?: string;
}

export const IrisNoteCreatedCard: React.FC<IrisNoteCreatedCardProps> = ({
  noteId,
  title = "Untitled Note",
  content = "",
  variant = "created",
  state = "completed",
  error,
}) => {
  const navigate = useNavigate();
  const { setActiveArtifact, activeArtifact } = useGlobalChatStore();
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const isUpdate = variant === "updated";

  // Strip HTML or Markdown tags for clean preview snippet
  const previewText = useMemo(() => {
    if (!content) return "Empty document";
    let plain = content
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[#*`_~\s\p{Emoji}]+/u, "")
      .trim();

    // If the note body starts by repeating the title, strip it from the snippet preview
    const cleanTitle = title.replace(/[^\w]/g, "").toLowerCase();
    const cleanLeading = plain
      .slice(0, title.length + 20)
      .replace(/[^\w]/g, "")
      .toLowerCase();
    if (cleanTitle && cleanLeading.startsWith(cleanTitle)) {
      plain = plain.slice(title.length).replace(/^[^\w]+/, "").trim();
    }

    return plain.length > 140 ? plain.slice(0, 140) + "..." : plain;
  }, [content, title]);

  const handleOpenSidePanel = () => {
    setActiveArtifact({
      type: "note",
      id: noteId,
      title,
      content,
    });
  };

  const handleOpenFullEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (noteId) {
      navigate(`/note/${noteId}`);
    }
  };

  const handleDiscard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!noteId || isDiscarding) return;
    setIsDiscarding(true);
    try {
      const cachedNote = queryClient.getQueryData<Note>(["note", noteId]);
      await noteRepository.deleteNote(noteId, cachedNote?.version ?? 1);

      queryClient.removeQueries({ queryKey: ["note", noteId] });
      queryClient.setQueryData<Note[]>(["notes"], (old = []) =>
        old.filter((n) => n._id !== noteId)
      );

      if (activeArtifact?.id === noteId) {
        setActiveArtifact(null);
      }

      setIsDiscarded(true);
      toast.success("Note discarded and moved to trash");
    } catch (err: any) {
      toast.error(err.message || "Failed to discard note");
    } finally {
      setIsDiscarding(false);
    }
  };

  const isOpenInPanel =
    activeArtifact?.type === "note" &&
    ((noteId && activeArtifact.id === noteId) ||
      (!noteId && activeArtifact.title === title));

  // Discarded state
  if (isDiscarded) {
    return (
      <div className="my-2 px-3 py-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/30 text-xs text-[var(--muted-text)] flex items-center justify-between gap-2 max-w-md animate-in fade-in duration-150">
        <span className="line-through opacity-70 truncate">&quot;{title}&quot; was discarded</span>
        <span className="text-[10px] text-[var(--muted-text)] opacity-60 shrink-0">Moved to trash</span>
      </div>
    );
  }

  // 1. Loading / Executing state
  if (state === "running" || state === "pending") {
    return (
      <div className="my-2 px-3 py-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/50 text-xs text-[var(--muted-text)] flex items-center gap-2.5 max-w-md animate-in fade-in duration-150">
        <Loader2 size={13} className="animate-spin text-[var(--accent-strong)] shrink-0" />
        <span className="truncate">
          {isUpdate ? `Updating "${title}"...` : `Creating "${title}"...`}
        </span>
      </div>
    );
  }

  // 2. Error state
  if (state === "error") {
    return (
      <div className="my-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 max-w-md">
        <AlertCircle size={13} className="shrink-0" />
        <span className="truncate">
          Failed to {isUpdate ? "update" : "create"} &quot;{title}&quot;{error ? `: ${error}` : ""}
        </span>
      </div>
    );
  }

  // 3. Completed State: Tactile, clean document tile
  return (
    <div
      onClick={handleOpenSidePanel}
      className={`my-2 p-3 rounded-lg border transition-all cursor-pointer group select-none max-w-md ${
        isOpenInPanel
          ? "border-[var(--accent-strong)]/50 bg-[var(--active-surface)] shadow-2xs"
          : "border-[var(--divider)] bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-ghost)]/60 hover:border-[var(--text-strong)]/20 shadow-2xs"
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-text)]">
          {isUpdate ? (
            <FileEdit size={12} className="opacity-70" />
          ) : (
            <FileText size={12} className="opacity-70" />
          )}
          <span>{isUpdate ? "Note updated" : "Note created"}</span>
        </div>

        <div className="flex items-center gap-1">
          {!isUpdate && noteId && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isDiscarding}
              className="flex items-center gap-1 text-[11px] text-[var(--muted-text)] hover:text-rose-500 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-500/10"
              title="Discard note and move to trash"
            >
              <Trash2 size={10} className="opacity-70" />
              <span>{isDiscarding ? "Discarding..." : "Discard"}</span>
            </button>
          )}

          {noteId && (
            <button
              type="button"
              onClick={handleOpenFullEditor}
              className="flex items-center gap-1 text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--surface-ghost)]"
              title="Open in full editor"
            >
              <span>Editor</span>
              <ExternalLink size={10} className="opacity-70" />
            </button>
          )}
        </div>
      </div>

      {/* Note Title */}
      <h4 className="text-xs font-semibold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)] transition-colors line-clamp-1">
        {title}
      </h4>

      {/* Content Preview Snippet */}
      {previewText && (
        <p className="text-[11px] text-[var(--muted-text)] line-clamp-2 leading-relaxed mt-1">
          {previewText}
        </p>
      )}

      {/* Footer Afordance */}
      <div className="mt-2.5 pt-2 border-t border-[var(--divider)]/50 flex items-center justify-between text-[11px] text-[var(--muted-text)]">
        <span>{isOpenInPanel ? "Viewing in side panel" : "Click to view preview"}</span>
        <div className="flex items-center gap-1 font-medium group-hover:text-[var(--text-strong)] transition-colors">
          <span>{isOpenInPanel ? "Active" : "Open"}</span>
          <ArrowRight
            size={11}
            className={`transition-transform duration-150 ${
              isOpenInPanel ? "" : "group-hover:translate-x-0.5"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default IrisNoteCreatedCard;

