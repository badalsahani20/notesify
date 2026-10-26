import React, { useEffect } from "react";
import { Check, X, RotateCcw, Loader2, Sparkles, Square } from "lucide-react";

interface InlineAiReviewBarProps {
  isGenerating: boolean;
  coords: { top: number; left: number; bottom?: number } | null;
  onAccept: () => void;
  onDiscard: () => void;
  onRegenerate?: () => void;
  onStop?: () => void;
}

export const InlineAiReviewBar: React.FC<InlineAiReviewBarProps> = ({
  isGenerating,
  coords,
  onAccept,
  onDiscard,
  onRegenerate,
  onStop,
}) => {
  // Global keyboard shortcuts while review bar is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or textarea inside a modal is focused
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        if (isGenerating && onStop) {
          onStop();
        } else {
          onDiscard();
        }
      } else if (e.key === "Tab" && !isGenerating) {
        e.preventDefault();
        onAccept();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, onAccept, onDiscard, onStop]);

  if (!coords) return null;

  const cursorBottom = coords.bottom ?? coords.top + 24;
  const spaceBelow = window.innerHeight - cursorBottom - 16;
  const shouldFlipAbove = spaceBelow < 50;

  const calculatedTop = shouldFlipAbove
    ? Math.max(16, coords.top - 46)
    : Math.min(cursorBottom + 8, window.innerHeight - 56);
  const calculatedLeft = Math.max(16, Math.min(coords.left, window.innerWidth - 320));

  return (
    <div
      data-inline-review-bar="true"
      style={{
        position: "fixed",
        top: `${calculatedTop}px`,
        left: `${calculatedLeft}px`,
      }}
      className="z-[9999] flex items-center gap-1.5 rounded-xl border border-[var(--divider)] bg-[var(--panel-bg-strong)] p-1 px-2 text-xs text-[var(--text-main)] shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-120"
    >
      <div className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] font-semibold text-[var(--text-strong)] mr-1">
        {isGenerating ? (
          <>
            <Loader2 size={13} className="animate-spin text-[var(--accent-strong)]" />
            <span>Drafting...</span>
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-[var(--accent-strong)]" />
            <span>AI Draft</span>
          </>
        )}
      </div>

      {isGenerating ? (
        <button
          type="button"
          onClick={onStop}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(239,68,68,0.1)] text-[rgb(220,38,38)] dark:text-[rgb(248,113,113)] hover:bg-[rgba(239,68,68,0.18)] font-medium text-xs transition-colors duration-120"
        >
          <Square size={11} className="fill-current" /> Stop
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(34,197,94,0.12)] text-[rgb(22,163,74)] dark:text-[rgb(74,222,128)] hover:bg-[rgba(34,197,94,0.2)] font-medium text-xs transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-emerald-500"
            title="Accept (Tab)"
          >
            <Check size={13} />
            <span>Accept</span>
            <kbd className="text-[10px] opacity-60 ml-0.5 px-1 py-0.2 rounded bg-black/20">Tab</kbd>
          </button>

          <button
            type="button"
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(239,68,68,0.1)] text-[rgb(220,38,38)] dark:text-[rgb(248,113,113)] hover:bg-[rgba(239,68,68,0.18)] font-medium text-xs transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-rose-500"
            title="Discard (Esc)"
          >
            <X size={13} />
            <span>Discard</span>
            <kbd className="text-[10px] opacity-60 ml-0.5 px-1 py-0.2 rounded bg-black/20">Esc</kbd>
          </button>

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="p-1 px-1.5 rounded-lg text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors duration-120"
              title="Regenerate"
              aria-label="Regenerate"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </>
      )}
    </div>
  );
};
