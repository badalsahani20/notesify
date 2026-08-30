import type { Folder } from "@/store/useFolderStore";
import { cn } from "@/lib/utils";
import { Notebook, RotateCcw, Trash2, X } from "lucide-react";
import { getFolderColor } from "@/utils/folderColors";

type FolderCardProps = {
  folder?: Folder;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  isTrashView?: boolean;
};

const FolderCard = ({ folder, isActive, onClick, onDelete, onRestore, onPermanentDelete, isTrashView = false }: FolderCardProps) => {
  if (!folder) return null;

  const initial = folder.name?.charAt(0)?.toUpperCase() ?? "N";
  const folderColor = getFolderColor(folder.color);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer rounded-xl border bg-white/[0.02] p-4 transition cursor-pointer",
        isActive
          ? "border-primary/50 shadow-[0_10px_24px_rgba(8,24,20,0.28)]"
          : "border-white/8 hover:border-white/20 hover:bg-white/[0.05]",
        isTrashView && "cursor-default opacity-80 border-dashed"
      )}
    >
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-200 shadow-inner"
        style={{ backgroundColor: `${folderColor}22`, color: folderColor }}
      >
        <span className="text-sm font-bold opacity-90 tracking-tighter">{initial}</span>
      </div>
      <div className="flex items-center gap-2">
        <Notebook size={14} style={{ color: folderColor }} className={cn(isTrashView && "opacity-60")} />
        <h3 className={cn("truncate text-sm font-semibold text-zinc-100", isTrashView && "text-zinc-400")}>{folder.name || "Untitled"}</h3>
      </div>
      {isTrashView ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRestore?.();
            }}
            className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"
            title="Restore"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPermanentDelete?.();
            }}
            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
            title="Delete permanently"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
          className="absolute right-3 top-3 rounded-md border border-transparent p-1 text-zinc-400 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 opacity-0 group-hover:opacity-100"
          aria-label={`Delete ${folder.name || "folder"}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

export default FolderCard;
