import React, { useState } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNoteConflict } from "@/hooks/notes/useNoteConflict";
import { NoteConflictModal } from "./NoteConflictModal";

interface NoteConflictBannerProps {
  noteId: string;
}

export const NoteConflictBanner: React.FC<NoteConflictBannerProps> = ({ noteId }) => {
  const { isConflicted, serverVersion, localVersion, resolveKeepMine, resolveKeepServer, isResolving } =
    useNoteConflict(noteId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isConflicted) return null;

  return (
    <>
      <div className="mx-8 mt-3 mb-1 p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-amber-200 text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle size={15} />
          </div>
          <div className="truncate">
            <p className="font-semibold text-white truncate">
              Version conflict detected
            </p>
            <p className="text-[11px] text-amber-300/80 truncate">
              Server has version {serverVersion ?? "?"}, your local draft is version {localVersion ?? "?"}. Local edits are preserved.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => resolveKeepServer()}
            disabled={isResolving}
            className="h-7 px-2.5 text-xs text-amber-300 hover:text-white hover:bg-white/10"
            title="Discard local changes and load server copy"
          >
            <Cloud size={12} className="mr-1" />
            Keep Server
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => resolveKeepMine()}
            disabled={isResolving}
            className="h-7 px-2.5 text-xs border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-white"
            title="Rebase local draft onto server version"
          >
            <Check size={12} className="mr-1" />
            Keep Mine
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={isResolving}
            className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-sm"
          >
            <ArrowRightLeft size={12} className="mr-1" />
            Review & Diff
          </Button>
        </div>
      </div>

      <NoteConflictModal
        noteId={noteId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
