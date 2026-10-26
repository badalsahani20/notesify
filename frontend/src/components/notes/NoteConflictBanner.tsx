import React, { useState } from "react";
import { ArrowRightLeft, Check, Cloud, GitFork } from "lucide-react";
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
      <aside
        aria-label="Version conflict status"
        className="mx-8 mt-2.5 mb-1 px-4 py-2.5 rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/90 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-[var(--text-strong)] text-xs shadow-xs transition-all duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)] shrink-0">
            <GitFork size={13} className="shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-strong)] truncate">
                Simultaneous edits detected
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono [font-variant-numeric:tabular-nums] text-[var(--muted-text)]">
                <span>local v{localVersion ?? "?"}</span>
                <span className="text-[var(--divider)]">/</span>
                <span>server v{serverVersion ?? "?"}</span>
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-text)] truncate mt-0.5">
              Changes were made elsewhere. Your local edits remain intact until resolved.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => resolveKeepServer()}
            disabled={isResolving}
            className="h-7 px-2.5 text-xs text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)]"
            title="Discard local changes and load server copy"
          >
            <Cloud size={12} className="mr-1.5 opacity-70" />
            Keep Server
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => resolveKeepMine()}
            disabled={isResolving}
            className="h-7 px-2.5 text-xs border-[var(--divider)] bg-[var(--window-bg)] hover:bg-[var(--surface-ghost)] text-[var(--text-strong)] shadow-2xs"
            title="Overwrite server with your local draft"
          >
            <Check size={12} className="mr-1.5 opacity-70" />
            Keep Local
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={isResolving}
            className="h-7 px-3 text-xs bg-[var(--text-strong)] text-[var(--window-bg)] hover:opacity-90 font-medium rounded-md shadow-2xs flex items-center gap-1.5 transition-opacity"
          >
            <ArrowRightLeft size={12} />
            Review &amp; Diff
          </Button>
        </div>
      </aside>

      <NoteConflictModal
        noteId={noteId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
