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
import { AlertTriangle, Check, ArrowRightLeft, Laptop, Cloud, GitMerge } from "lucide-react";

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

  const [activeTab, setActiveTab] = useState<"compare" | "merge">("compare");
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
      const combined = `${localDraft?.content || ""}\n\n<!-- Server Content Below -->\n${serverState?.content || ""}`;
      setMergedContent(combined);
      setActiveTab("compare");
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-neutral-950 border-white/10 text-neutral-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-white/10 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                Resolve Version Conflict
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal">
                  409 Conflict
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 mt-1">
                This note was modified in another session or device. Choose how to reconcile your changes.
              </DialogDescription>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "compare"
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <ArrowRightLeft size={13} /> Side-by-Side Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("merge")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "merge"
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <GitMerge size={13} /> Custom Merge Editor
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 min-h-[320px]">
          {activeTab === "compare" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Local Draft */}
              <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/40 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                    <Laptop size={14} />
                    <span>Your Local Draft</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      v{localVersion ?? "?"}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500">Unsaved locally</span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-white mb-2">{localTitle}</h4>
                  <div className="text-xs text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto p-3 rounded-lg bg-black/40 border border-white/5">
                    {localText || "<Empty content>"}
                  </div>
                </div>
              </div>

              {/* Server State */}
              <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/40 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-indigo-400">
                    <Cloud size={14} />
                    <span>Server Version</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                      v{serverVersion ?? "?"}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500">On server</span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-white mb-2">{serverTitle}</h4>
                  <div className="text-xs text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto p-3 rounded-lg bg-black/40 border border-white/5">
                    {serverText || "<Empty content>"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Custom Merge Mode */
            <div className="flex flex-col h-full gap-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Merged Title</label>
                <input
                  type="text"
                  value={mergedTitle}
                  onChange={(e) => setMergedTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs text-neutral-400 mb-1 block">
                  Merged Document Content (HTML / Text)
                </label>
                <textarea
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                  rows={12}
                  className="w-full flex-1 bg-neutral-900 border border-white/10 rounded-lg p-3 text-xs text-neutral-200 font-mono focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-white/10 bg-neutral-900/60 flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isResolving}
            className="text-neutral-400 hover:text-white"
          >
            Decide Later
          </Button>

          <div className="flex items-center gap-2">
            {activeTab === "compare" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleKeepServer}
                  disabled={isResolving}
                  className="border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10 hover:text-white"
                >
                  Keep Server
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleKeepMine}
                  disabled={isResolving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  <Check size={14} className="mr-1" />
                  Keep Mine (Rebase)
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleApplyMerged}
                disabled={isResolving || !mergedContent.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                <Check size={14} className="mr-1" />
                Apply Merged Note
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
