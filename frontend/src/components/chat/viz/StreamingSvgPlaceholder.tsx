import React from "react";
import { Loader2, Sparkles } from "lucide-react";

interface StreamingSvgPlaceholderProps {
  aspectRatio?: number;
  minHeight?: number;
}

export const StreamingSvgPlaceholder: React.FC<StreamingSvgPlaceholderProps> = ({
  aspectRatio = 16 / 9,
  minHeight = 220,
}) => {
  // Clamp aspect ratio to reasonable limits so extreme values don't break layout
  const clampedRatio = Math.max(0.6, Math.min(3.0, aspectRatio));

  return (
    <div
      className="my-3 w-full rounded-xl border border-dashed border-[var(--divider)] bg-[var(--surface-muted)]/35 overflow-hidden transition-all duration-300 relative select-none"
      style={{
        aspectRatio: `${clampedRatio}`,
        minHeight: `${minHeight}px`,
        maxHeight: "480px",
      }}
    >
      {/* Ambient background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2s_infinite]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="relative mb-3 flex items-center justify-center">
          <div className="size-10 rounded-xl bg-[var(--accent-strong)]/10 border border-[var(--accent-strong)]/20 flex items-center justify-center">
            <Sparkles className="size-5 text-[var(--accent-strong)] animate-pulse" />
          </div>
          <Loader2 className="size-12 animate-spin text-[var(--accent-strong)]/40 absolute -inset-1" />
        </div>

        <p className="text-xs font-semibold text-[var(--text-strong)] tracking-wide">
          generating diagram...
        </p>
        <p className="text-[11px] text-[var(--muted-text)] mt-1 opacity-70">
          Preserving dimensions to prevent layout shifts
        </p>
      </div>
    </div>
  );
};

export default StreamingSvgPlaceholder;
