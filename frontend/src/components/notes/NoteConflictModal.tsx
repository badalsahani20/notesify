import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNoteConflict } from "@/hooks/notes/useNoteConflict";
import { stripHtml } from "@/utils/stripHtml";
import { Check, ArrowRightLeft, Laptop, Cloud, GitMerge, GitCompare } from "lucide-react";
import { NoteDiffViewer } from "./NoteDiffViewer";

interface NoteConflictModalProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NoteConflictModal: React.FC<NoteConflictModalProps> = ({
  noteId,
  isOpen,
  onClose,
}) => {
  const {
    isConflicted,
    localDraft,
    serverState,
    localVersion,
    serverVersion,
    resolveKeepMine,
    resolveKeepServer,
    resolveMerged,
    isResolving,
  } = useNoteConflict(noteId);

  const [activeTab, setActiveTab] = useState<"diff" | "compare" | "merge">("diff");
  const [mergedContent, setMergedContent] = useState("");
  const [mergedTitle, setMergedTitle] = useState("");

  const localText = stripHtml(localDraft?.content || "");
  const serverText = stripHtml(serverState?.content || "");
  const localTitle = localDraft?.title || "Untitled";
  const serverTitle = serverState?.title || "Untitled";

  // Pre-populate merge editor with combined content
  useEffect(() => {
    if (isOpen) {
      setMergedTitle(localTitle || serverTitle);
      const combined = `${localDraft?.content || ""}\n\n<!-- --- Server Content --- -->\n${serverState?.content || ""}`;
      setMergedContent(combined);
      setActiveTab("diff");
    }
  }, [isOpen, localDraft, serverState, localTitle, serverTitle]);

  const handleKeepMine = async () => {
    try {
      await resolveKeepMine();
      onClose();
    } catch {
      // Handled in mutation onError
    }
  };

  const handleKeepServer = async () => {
    try {
      await resolveKeepServer();
      onClose();
    } catch {
      // Handled in mutation onError
    }
  };

  const handleApplyMerged = async () => {
    try {
      await resolveMerged(mergedContent, mergedTitle);
      onClose();
    } catch {
      // Handled in mutation onError
    }
  };

  if (!isConflicted && !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[94vw] max-h-[85vh] h-[85vh] flex flex-col bg-[var(--window-bg)] border-[var(--divider)] text-[var(--text-strong)] p-0 overflow-hidden shadow-2xl sm:max-w-3xl [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div]:min-h-0 [&>div]:gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-[var(--divider)] bg-[var(--surface-muted)]/50 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--text-strong)] flex items-center gap-2">
                Resolve Version Conflict
                <span className="text-[11px] font-mono [font-variant-numeric:tabular-nums] text-[var(--muted-text)] font-normal">
                  (v{localVersion ?? "?"} vs v{serverVersion ?? "?"})
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--muted-text)] mt-0.5">
                This note was modified in another session. Compare versions and choose which to keep.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-3 p-0.5 rounded-lg bg-[var(--surface-ghost)] border border-[var(--divider)] w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("diff")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "diff"
                  ? "bg-[var(--window-bg)] text-[var(--text-strong)] shadow-2xs"
                  : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              }`}
            >
              <GitCompare size={12} className="opacity-70" />
              Changes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "compare"
                  ? "bg-[var(--window-bg)] text-[var(--text-strong)] shadow-2xs"
                  : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              }`}
            >
              <ArrowRightLeft size={12} className="opacity-70" />
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("merge")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "merge"
                  ? "bg-[var(--window-bg)] text-[var(--text-strong)] shadow-2xs"
                  : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              }`}
            >
              <GitMerge size={12} className="opacity-70" />
              Merge Editor
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 bg-[var(--window-bg)]">
          {activeTab === "diff" ? (
            /* Diff View: Shows only changed parts with hunk folding */
            <div className="h-full min-h-0 flex flex-col">
              <NoteDiffViewer
                serverTitle={serverTitle}
                localTitle={localTitle}
                serverContent={serverState?.content || ""}
                localContent={localDraft?.content || ""}
                serverVersion={serverVersion}
                localVersion={localVersion}
              />
            </div>
          ) : activeTab === "compare" ? (
            /* Clean Side-by-Side Comparison */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full min-h-0">
              {/* Server State */}
              <div className="flex flex-col rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/30 overflow-hidden min-h-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--divider)] bg-[var(--surface-muted)]/60 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-strong)]">
                    <Cloud size={13} className="text-rose-600 dark:text-rose-400 opacity-80" />
                    <span>Server Version</span>
                    <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] text-[var(--muted-text)]">
                      v{serverVersion ?? "?"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleKeepServer}
                    disabled={isResolving}
                    className="h-6 px-2 text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)]"
                  >
                    Select this
                  </Button>
                </div>
                <div className="p-3 flex-1 flex flex-col min-h-0">
                  <h4 className="text-xs font-semibold text-[var(--text-strong)] mb-2 truncate">
                    {serverTitle}
                  </h4>
                  <div className="text-xs text-[var(--text-strong)]/85 leading-relaxed font-mono whitespace-pre-wrap flex-1 overflow-y-auto p-2.5 rounded-md bg-[var(--window-bg)] border border-[var(--divider)]">
                    {serverText || "<Empty content>"}
                  </div>
                </div>
              </div>

              {/* Local Draft */}
              <div className="flex flex-col rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/30 overflow-hidden min-h-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--divider)] bg-[var(--surface-muted)]/60 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-strong)]">
                    <Laptop size={13} className="text-emerald-600 dark:text-emerald-400 opacity-80" />
                    <span>Your Local Draft</span>
                    <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] text-[var(--muted-text)]">
                      v{localVersion ?? "?"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleKeepMine}
                    disabled={isResolving}
                    className="h-6 px-2 text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)]"
                  >
                    Select this
                  </Button>
                </div>
                <div className="p-3 flex-1 flex flex-col min-h-0">
                  <h4 className="text-xs font-semibold text-[var(--text-strong)] mb-2 truncate">
                    {localTitle}
                  </h4>
                  <div className="text-xs text-[var(--text-strong)]/85 leading-relaxed font-mono whitespace-pre-wrap flex-1 overflow-y-auto p-2.5 rounded-md bg-[var(--window-bg)] border border-[var(--divider)]">
                    {localText || "<Empty content>"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Custom Merge Mode */
            <div className="flex flex-col h-full gap-3 min-h-0">
              <div className="shrink-0">
                <label className="text-[11px] font-medium text-[var(--muted-text)] mb-1 block">
                  Merged Title
                </label>
                <input
                  type="text"
                  value={mergedTitle}
                  onChange={(e) => setMergedTitle(e.target.value)}
                  className="w-full bg-[var(--surface-muted)]/50 border border-[var(--divider)] rounded-md px-3 py-1.5 text-xs text-[var(--text-strong)] focus:outline-none focus:border-[var(--accent-strong)] transition-colors"
                />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <label className="text-[11px] font-medium text-[var(--muted-text)]">
                    Merged Document Content
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setMergedContent(localDraft?.content || "")}
                      className="text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:underline"
                    >
                      Use local
                    </button>
                    <span className="text-[var(--divider)]">·</span>
                    <button
                      type="button"
                      onClick={() => setMergedContent(serverState?.content || "")}
                      className="text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:underline"
                    >
                      Use server
                    </button>
                  </div>
                </div>
                <textarea
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                  className="w-full flex-1 bg-[var(--surface-muted)]/50 border border-[var(--divider)] rounded-md p-3 text-xs text-[var(--text-strong)] font-mono focus:outline-none focus:border-[var(--accent-strong)] resize-none leading-relaxed min-h-0 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 px-4 border-t border-[var(--divider)] bg-[var(--surface-muted)]/50 shrink-0 flex items-center justify-between gap-2 sm:justify-between sticky bottom-0 z-20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isResolving}
            className="text-[var(--muted-text)] hover:text-[var(--text-strong)] h-8 text-xs hover:bg-[var(--surface-ghost)]"
          >
            Decide later
          </Button>

          <div className="flex items-center gap-2">
            {activeTab !== "merge" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleKeepServer}
                  disabled={isResolving}
                  className="border-[var(--divider)] bg-[var(--window-bg)] hover:bg-[var(--surface-ghost)] text-[var(--text-strong)] h-8 text-xs shadow-2xs"
                >
                  <Cloud size={12} className="mr-1.5 opacity-70" />
                  Keep Server
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleKeepMine}
                  disabled={isResolving}
                  className="bg-[var(--text-strong)] text-[var(--window-bg)] hover:opacity-90 font-medium h-8 text-xs px-3 shadow-2xs transition-opacity"
                >
                  <Check size={12} className="mr-1.5" />
                  Keep Local
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleApplyMerged}
                disabled={isResolving || !mergedContent.trim()}
                className="bg-[var(--text-strong)] text-[var(--window-bg)] hover:opacity-90 font-medium h-8 text-xs px-3.5 shadow-2xs transition-opacity"
              >
                <Check size={12} className="mr-1.5" />
                Apply Merged Note
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
