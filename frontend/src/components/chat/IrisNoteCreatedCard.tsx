import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";

interface IrisNoteCreatedCardProps {
  noteId?: string;
  title?: string;
  content?: string;
  variant?: "created" | "updated";
}

export const IrisNoteCreatedCard: React.FC<IrisNoteCreatedCardProps> = ({
  noteId,
  title = "Untitled Note",
  content = "",
  variant = "created",
}) => {
  const navigate = useNavigate();
  const { setActiveArtifact, activeArtifact } = useGlobalChatStore();

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

    return plain.length > 150 ? plain.slice(0, 150) + "..." : plain;
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

  const isOpenInPanel =
    activeArtifact?.type === "note" &&
    ((noteId && activeArtifact.id === noteId) ||
      (!noteId && activeArtifact.title === title));

  return (
    <div
      onClick={handleOpenSidePanel}
      className={`my-2.5 p-3.5 rounded-xl border transition-all backdrop-blur-md cursor-pointer group select-none max-w-lg ${
        isOpenInPanel
          ? "border-slate-700 bg-slate-850/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)] ring-1 ring-slate-700/60"
          : "border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      }`}
    >
      {/* Tangible Artifact Card Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
          <Sparkles size={11} className="text-slate-400" />
          <span>{variant === "updated" ? "Updated Note" : "Generated Artifact"}</span>
        </div>

        {noteId && (
          <button
            onClick={handleOpenFullEditor}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
            title="Open in full TipTap editor"
          >
            <span>Full Editor</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      {/* Artifact Title & Icon Row */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:text-white transition-colors">
          <FileText size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors line-clamp-1">
            {title}
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Notesify Workspace Note
          </p>
        </div>
      </div>

      {/* Preview Snippet */}
      {previewText && (
        <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed pl-11 mb-2.5">
          {previewText}
        </p>
      )}

      {/* Bottom CTA Bar */}
      <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          {isOpenInPanel ? "Viewing in Side Panel" : "Click to view document"}
        </span>
        <div className="flex items-center gap-1 font-medium text-slate-300 group-hover:text-white transition-colors">
          <span>{isOpenInPanel ? "Active" : "Open Artifact"}</span>
          <ArrowRight
            size={12}
            className={`transition-transform duration-200 ${
              isOpenInPanel ? "" : "group-hover:translate-x-0.5"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default IrisNoteCreatedCard;
