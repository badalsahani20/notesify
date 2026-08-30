import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { FolderOpen, Loader2 } from "lucide-react";
import { FOLDER_COLORS, type FolderColor } from "@/utils/folderColors";

type FolderFormDialogProps = {
  open: boolean;
  mode: "create" | "rename";
  initialValue?: string;
  initialColor?: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: FolderColor) => Promise<void>;
};

export const FolderFormDialog = ({
  open,
  mode,
  initialValue = "",
  initialColor = "slate",
  isSaving,
  onClose,
  onSubmit,
}: FolderFormDialogProps) => {
  const [name, setName] = useState(initialValue);
  const [color, setColor] = useState<FolderColor>(
    (FOLDER_COLORS.some((item) => item.value === initialColor) ? initialColor : "slate") as FolderColor,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialValue);
      setColor(
        (FOLDER_COLORS.some((item) => item.value === initialColor) ? initialColor : "slate") as FolderColor,
      );
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [initialValue, open]);

  const trimmedName = name.trim();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!trimmedName || isSaving) return;
    await onSubmit(trimmedName, color);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving) onClose();
      }}
    >
      <DialogContent 
        className="p-0 gap-0 max-w-sm bg-[var(--panel-bg-strong)] border-[var(--divider)] text-[var(--text-strong)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden"
      >
        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <FolderOpen size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-strong)]">
                {mode === "create" ? "New Notebook" : "Rename Notebook"}
              </h2>
              <p className="text-[11px] text-[var(--muted-text)] mt-0.5">
                {mode === "create"
                  ? "Organise your notes into a focused workspace."
                  : "Update the notebook name across all your notes."}
              </p>
            </div>
          </div>
        </div>

        {/* Input */}
        <form id="folder-form" name="folder" onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="folder-name"
              className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-text)]"
            >
              Notebook name
            </label>
            <input
              ref={inputRef}
              id="folder-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design ideas, Research..."
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void handleSubmit(); }
                if (e.key === "Escape") onClose();
              }}
              className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-ghost)] border border-[var(--divider)] text-[13px] text-[var(--text-strong)] placeholder-[var(--muted-text)] outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-text)]">
              Notebook color
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Notebook color">
              {FOLDER_COLORS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={color === item.value}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => setColor(item.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${color === item.value ? "border-white scale-110 ring-2 ring-indigo-400/50" : "border-white/10"}`}
                  style={{ backgroundColor: item.hex }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl text-[12px] font-semibold text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmedName || isSaving}
              className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-bold flex items-center gap-2 transition-all"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              {isSaving
                ? mode === "create" ? "Creating…" : "Saving…"
                : mode === "create" ? "Create" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
