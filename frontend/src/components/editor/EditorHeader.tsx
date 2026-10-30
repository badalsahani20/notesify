import React from "react";
import type { Editor } from "@tiptap/react";
import { Archive, Star, BookOpen, ChevronLeft, Share2, MoreHorizontal, Loader2, ChevronDown, Check, FileText, Search, X, FileDown } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { PdfExportService } from "@/services/pdf/PdfExportService";
import type { AiAction } from "@/components/ai/types";
import { EditorStats } from "./EditorStats";
import { ShareModal } from "./ShareModal";
import type { Note } from "@/store/useNoteStore";
import type { Folder } from "@/store/useFolderStore";
import { useFolderStore } from "@/store/useFolderStore";
import { useNotesQuery } from "@/hooks/notes/useNotesQuery";
import { useMoveNoteToFolderMutation } from "@/hooks/notes/useNotesMutations";
import { getFolderIcon } from "@/utils/getFolderIcons";
import { getFolderColor } from "@/utils/folderColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDesktopApp } from "@/lib/desktop";

type EditorHeaderProps = {
  note: Note;
  /** Found folder for the note (if any), strictly for displaying its name */
  folder?: Folder;
  folderLabel?: string;
  editor: Editor | null;
  /** The controlled text input value for the title */
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  /** Called on blur to commit the title if changed */
  onCommitTitle: () => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onAskAi?: () => void;
  onAskAiHover?: () => void;
  isAiOpen?: boolean;
  onStudy?: () => void;
  isStudyOpen?: boolean;
  isMobile?: boolean;
  isSaving?: boolean;
  loadingAction?: AiAction | null;
  onRunAction?: (action: AiAction) => Promise<void>;
  onClose?: () => void;
};


/**
 * Top header of the note editor page.
 * Desktop: shows all actions inline.
 * Mobile: collapses Share / Archive / Star into a "⋯" overflow menu.
 */
const EditorHeader = ({
  note,
  folder,
  folderLabel,
  editor,
  draftTitle,
  onDraftTitleChange,
  onCommitTitle,
  onTogglePin,
  onToggleArchive,
  onAskAi,
  onAskAiHover,
  isAiOpen,
  onStudy,
  isStudyOpen,
  isMobile,
  isSaving,
  loadingAction,
  onClose,
}: EditorHeaderProps) => {

  const navigate = useNavigate();
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [searchNoteQuery, setSearchNoteQuery] = React.useState("");
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const [exportProgressText, setExportProgressText] = React.useState("");

  const handleExportPdf = async () => {
    if (isExportingPdf || !note) return;
    setIsExportingPdf(true);
    setExportProgressText("Preparing...");
    const toastId = toast.loading("Generating PDF...");

    try {
      const currentContent = editor ? editor.getHTML() : (note.content || "");
      const currentTitle = draftTitle || note.title || "Untitled Note";

      const result = await PdfExportService.exportNote(
        {
          title: currentTitle,
          content: currentContent,
          updatedAt: note.updatedAt,
        },
        {
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          onProgress: (stage) => setExportProgressText(stage),
        }
      );

      if (result.diagnostics.missingImages.length > 0) {
        toast.warning(
          `PDF exported (${result.diagnostics.missingImages.length} image(s) unavailable offline)`,
          { id: toastId }
        );
      } else {
        toast.success("PDF exported successfully!", { id: toastId });
      }
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to export PDF", { id: toastId });
    } finally {
      setIsExportingPdf(false);
      setExportProgressText("");
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  const { folders } = useFolderStore();
  const { data: allNotes = [] } = useNotesQuery();
  const { mutate: moveNote, isPending: isMovingFolder } = useMoveNoteToFolderMutation();

  const activeNoteId = note?._id ?? null;
  const currentFolderId = note?.folder ?? null;
  const currentFolderName = folderLabel ?? folder?.name ?? (currentFolderId ? "Folder" : "All Notes");

  const inCurrentFolderNotes = React.useMemo(() => {
    if (!currentFolderId) return [];
    return allNotes.filter((n) => n.folder === currentFolderId && n._id !== activeNoteId);
  }, [allNotes, currentFolderId, activeNoteId]);

  const otherNotes = React.useMemo(() => {
    return allNotes.filter((n) => n.folder !== currentFolderId && n._id !== activeNoteId);
  }, [allNotes, currentFolderId, activeNoteId]);

  const filterNotesByQuery = (notesList: Note[]) => {
    if (!searchNoteQuery.trim()) return notesList;
    const q = searchNoteQuery.trim().toLowerCase();
    return notesList.filter((n) => n.title.toLowerCase().includes(q));
  };

  const filteredInFolder = filterNotesByQuery(inCurrentFolderNotes);
  const filteredOther = filterNotesByQuery(otherNotes);

  const handleSelectFolder = (targetFolderId: string | null) => {
    if (!note || note._id === "new") return;
    if (currentFolderId === targetFolderId) return;
    moveNote({ noteId: note._id, folderId: targetFolderId, version: note.version });
  };

  const handleSelectNote = (targetNote: Note) => {
    if (targetNote._id === activeNoteId) return;
    if (targetNote.folder) {
      navigate(`/folders/${targetNote.folder}/note/${targetNote._id}`);
    } else {
      navigate(`/note/${targetNote._id}`);
    }
  };

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const focus = searchParams.get("focus");
  const isFocusMode = focus === "1" || focus === "2";
  const isDesktop = isDesktopApp();
  const needsDesktopTitlebarPadding = isDesktop && isFocusMode;

  return (
    <div 
      className={`desktop-editor-header ${needsDesktopTitlebarPadding && !isAiOpen ? "is-desktop-app" : ""}`}
      style={needsDesktopTitlebarPadding && !isAiOpen ? { paddingRight: "clamp(140px, 9.5rem, 160px)" } : undefined}
    >
      <div className="editor-title-row">
        <div className="flex flex-1 items-center min-w-0 gap-1 group/title-switcher">
          <button
            type="button"
            onClick={handleClose}
            className="mr-1 -ml-1 p-1.5 rounded-lg text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer shrink-0"
            aria-label={folder ? `Back to ${folder.name}` : "Close note"}
            title={folder ? `Back to ${folder.name}` : "Close note"}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            className="editor-title-input min-w-0 flex-1"
            value={draftTitle}
            placeholder="Untitled Note"
            onChange={(e) => onDraftTitleChange(e.target.value)}
            onBlur={onCommitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
          />

          {/* Integrated Title Dropdown Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-white/10 opacity-70 group-hover/title-switcher:opacity-100 transition-all shrink-0 cursor-pointer"
                aria-label="Quick switch note"
                title="Switch note"
              >
                <ChevronDown size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-80 bg-[var(--panel-bg-strong)] border-[var(--divider)] text-[var(--text-strong)] shadow-[0_8px_30px_rgba(0,0,0,0.35)] max-h-96 overflow-y-auto custom-scrollbar p-1"
            >
              {/* Search Filter */}
              <div className="p-1.5 sticky top-0 bg-[var(--panel-bg-strong)] z-10">
                <div className="relative flex items-center">
                  <Search size={13} className="absolute left-2.5 text-[var(--muted-text)] pointer-events-none" />
                  <input
                    type="text"
                    value={searchNoteQuery}
                    onChange={(e) => setSearchNoteQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full bg-[var(--surface-ghost)] border border-[var(--divider)] rounded-md pl-8 pr-7 py-1.5 text-xs text-[var(--text-strong)] placeholder:text-[var(--muted-text)] focus:outline-none focus:border-[var(--accent-strong)] transition-colors"
                  />
                  {searchNoteQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchNoteQuery("")}
                      className="absolute right-2 text-[var(--muted-text)] hover:text-[var(--text-strong)]"
                      aria-label="Clear note search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* CURRENT NOTE SECTION */}
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted-text)] uppercase tracking-wider">
                Current
              </div>
              <DropdownMenuItem
                className="cursor-default bg-[var(--surface-ghost)] text-[13px] text-[var(--text-strong)] font-medium flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <FileText size={14} className="text-[var(--accent-strong)] shrink-0" />
                  <span className="truncate">{draftTitle || note?.title || "Untitled Note"}</span>
                </div>
                <Check size={14} className="text-[var(--accent-strong)] shrink-0" />
              </DropdownMenuItem>

              {/* IN CURRENT FOLDER SECTION */}
              {currentFolderId && (
                <>
                  <DropdownMenuSeparator className="my-1 bg-[var(--divider)]" />
                  <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted-text)] uppercase tracking-wider">
                    In {currentFolderName}
                  </div>
                  {filteredInFolder.length > 0 ? (
                    filteredInFolder.map((n) => (
                      <DropdownMenuItem
                        key={n._id}
                        onSelect={() => handleSelectNote(n)}
                        className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <FileText size={14} className="opacity-50 shrink-0" />
                          <span className="truncate">{n.title || "Untitled Note"}</span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-xs text-[var(--muted-text)] italic">No other notes in folder</div>
                  )}
                </>
              )}

              {/* OTHER NOTES SECTION */}
              <DropdownMenuSeparator className="my-1 bg-[var(--divider)]" />
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted-text)] uppercase tracking-wider">
                {currentFolderId ? "Other Notes" : "All Notes"}
              </div>
              {filteredOther.length > 0 ? (
                filteredOther.map((n) => (
                  <DropdownMenuItem
                    key={n._id}
                    onSelect={() => handleSelectNote(n)}
                    className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md"
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileText size={14} className="opacity-50 shrink-0" />
                      <span className="truncate">{n.title || "Untitled Note"}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-1 text-xs text-[var(--muted-text)] italic">No other notes</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="editor-meta-stack">
          {/* Study button — desktop only */}
          {!isMobile && (
            <button
              type="button"
              onClick={onStudy}
              className={`h-7 px-2.5 text-[0.78rem] font-medium rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                isStudyOpen
                  ? "bg-emerald-500/20 text-emerald-300 dark:text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-emerald-500/10 hover:bg-emerald-500/18 text-black dark:text-white border border-emerald-500/20 hover:border-emerald-500/35"
              }`}
              aria-label="Toggle Study Mode"
              id="study-mode-btn"
            >
              <BookOpen size={13} className="shrink-0 text-black dark:text-white" />
              <span className="hidden sm:inline">Study</span>
            </button>
          )}

          {/* AI button — always visible */}
          {!isMobile && (
            <button
              type="button"
              onClick={onAskAi}
              onMouseEnter={onAskAiHover}
              onFocus={onAskAiHover}
              className={`h-7 px-2.5 text-[0.78rem] font-medium rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                isAiOpen
                  ? "bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-purple-600/30 text-violet-200 dark:text-violet-100 border border-violet-400/50 shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                  : "bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 hover:from-violet-500/18 hover:via-indigo-500/18 hover:to-purple-500/18 text-violet-600 dark:text-violet-300 border border-violet-500/25 hover:border-violet-500/45 shadow-[0_2px_8px_rgba(139,92,246,0.08)]"
              }`}
              aria-label="Toggle Iris AI Assistant"
              title={`Iris AI (${typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘J" : "Ctrl+J"})`}
            >
              {loadingAction ? (
                <Loader2 size={13} className="animate-spin text-violet-500 dark:text-violet-300" />
              ) : (
                <div className="iris-orb shrink-0" style={{ width: "12px", height: "12px", borderWidth: "1px", boxShadow: "none" }} />
              )}
              <span className="hidden sm:inline">{loadingAction ? "Thinking..." : "Iris"}</span>
            </button>
          )}

          {/* Unified expandable menu (Star, Archive, Share) for all screens */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="editor-star-toggle flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 active:bg-white/10 transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[var(--panel-bg-strong)] border-[var(--divider)] text-[var(--text-strong)] shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
              >
                <DropdownMenuItem
                  onSelect={() => setIsShareOpen(true)}
                  onClick={() => setIsShareOpen(true)}
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] gap-2.5"
                >
                  <Share2 size={14} className={note.isShared ? "text-[var(--accent-strong)]" : "opacity-40"} />
                  {note.isShared ? "Sharing (on)" : "Share link"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={isExportingPdf}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleExportPdf();
                  }}
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] gap-2.5"
                >
                  {isExportingPdf ? (
                    <Loader2 size={14} className="animate-spin text-[var(--accent-strong)] shrink-0" />
                  ) : (
                    <FileDown size={14} className="opacity-60 shrink-0" />
                  )}
                  {isExportingPdf ? exportProgressText || "Exporting..." : "Export as PDF"}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[var(--divider)]" />

                <DropdownMenuItem
                  onSelect={() => onTogglePin(note._id)}
                  onClick={() => onTogglePin(note._id)}
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] gap-2.5"
                >
                  <Star
                    size={14}
                    fill={note.pinned ? "currentColor" : "none"}
                    className={note.pinned ? "text-amber-400" : "opacity-40"}
                  />
                  {note.pinned ? "Starred" : "Star note"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => onToggleArchive(note._id)}
                  onClick={() => onToggleArchive(note._id)}
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] gap-2.5"
                >
                  <Archive size={14} className={note.isArchived ? "text-[var(--accent-strong)]" : "opacity-40"} />
                  {note.isArchived ? "Unarchive" : "Archive note"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Close Note Button */}
          <button
            type="button"
            onClick={handleClose}
            className="editor-star-toggle flex items-center justify-center rounded-lg p-1.5 text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close note (Esc)"
            title="Close note (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="editor-title-meta">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!note || note._id === "new" || isMovingFolder}>
            <button
              type="button"
              className="editor-folder-label flex items-center gap-1.5 leading-none px-2 py-1 -ml-2 rounded-md hover:bg-white/5 active:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
              aria-label="Change note folder"
            >
              {currentFolderName === "AI Notes" && (
                <div className="iris-orb shrink-0" style={{ width: "10px", height: "10px", borderWidth: "1px", boxShadow: "none" }} />
              )}
              <span className="truncate max-w-[180px] font-medium text-[var(--muted-text)] hover:text-[var(--text-strong)]">
                {currentFolderName}
              </span>
              {note && note._id !== "new" && (
                <ChevronDown size={13} className="text-[var(--muted-text)] opacity-70 shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 bg-[var(--panel-bg-strong)] border-[var(--divider)] text-[var(--text-strong)] shadow-[0_8px_30px_rgba(0,0,0,0.3)] max-h-64 overflow-y-auto custom-scrollbar"
          >
            <div className="px-2 py-1.5 text-[11px] font-medium text-[var(--muted-text)] uppercase tracking-wider">
              Move to folder
            </div>
            <DropdownMenuItem
              onSelect={() => handleSelectFolder(null)}
              className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText size={14} className="opacity-60 shrink-0" />
                <span className="truncate">All Notes</span>
              </div>
              {!currentFolderId && <Check size={14} className="text-[var(--accent-strong)] shrink-0" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[var(--divider)]" />

            {folders.map((f) => {
              const Icon = getFolderIcon(f.name);
              const isSelected = currentFolderId === f._id;
              return (
                <DropdownMenuItem
                  key={f._id}
                  onSelect={() => handleSelectFolder(f._id)}
                  className="cursor-pointer text-[13px] text-[var(--text-main)] focus:bg-[var(--surface-ghost)] focus:text-[var(--text-strong)] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/10"
                      style={{
                        backgroundColor: `${getFolderColor(f.color)}22`,
                        color: getFolderColor(f.color),
                      }}
                    >
                      <Icon size={12} />
                    </span>
                    <span className="truncate">{f.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--accent-strong)] shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <EditorStats editor={editor} isSaving={isSaving} />
      </div>

      <ShareModal
        note={note}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};

export default React.memo(EditorHeader);
