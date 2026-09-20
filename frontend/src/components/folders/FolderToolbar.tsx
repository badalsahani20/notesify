import React from "react";
import { LayoutGrid, List, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderToolbarProps {
  noteCount?: number;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  sortLabel?: string;
  onSortChange?: () => void;
}

export const FolderToolbar: React.FC<FolderToolbarProps> = ({
  noteCount,
  viewMode = "grid",
  onViewModeChange,
  sortLabel = "Last updated",
  onSortChange,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 pt-1">
      {/* Section Label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Notes
        </span>
        {typeof noteCount === "number" && (
          <span className="text-xs text-zinc-500 font-medium">({noteCount})</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSortChange}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]"
        >
          <span>{sortLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>

        <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange?.("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors cursor-pointer",
              viewMode === "grid" ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
            title="Grid view"
            aria-label="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors cursor-pointer",
              viewMode === "list" ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
            title="List view"
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderToolbar;
