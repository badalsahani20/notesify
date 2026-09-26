import{ useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Share2,
  Copy,
  Check,
  Globe,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useToggleShareMutation } from "@/hooks/notes/useNotesMutations";
import type { Note } from "@/store/useNoteStore";
import { getNoteShareUrl } from "@/utils/shareUtils";
import { toast } from "sonner";

interface ShareModalProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
}

const EXPIRATION_OPTIONS = [
  { label: "1 Hour", value: 1 * 60 * 60 * 1000 },
  { label: "1 Day", value: 24 * 60 * 60 * 1000 },
  { label: "7 Days", value: 7 * 24 * 60 * 60 * 1000 },
];

export const ShareModal = ({ note, isOpen, onClose }: ShareModalProps) => {
  const { mutate: toggleShare, isPending } = useToggleShareMutation();
  const [hasCopied, setHasCopied] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<number>(24 * 60 * 60 * 1000);

  // Generate absolute public HTTPS link (handles desktop/Electron and web)
  const shareUrl = getNoteShareUrl(note.shareSlug);

  const handleToggle = () => {
    const isEnabling = !note.isShared;
    let expiresAt: string | null = null;

    if (isEnabling && selectedExpiry) {
      expiresAt = new Date(Date.now() + selectedExpiry).toISOString();
    }

    toggleShare({
      noteId: note._id,
      isShared: isEnabling,
      expiresAt,
    });
  };

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
    toast.success("Link copied to clipboard");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white/90 dark:bg-zinc-950/80 backdrop-blur-xl border-zinc-200 dark:border-white/10 text-[var(--text-strong)] shadow-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Share2 className="text-[var(--accent-strong)]" size={20} />
            Share Note
          </DialogTitle>
          <DialogDescription className="text-[var(--muted-text)]">
            Create a public link to share this note with others.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${note.isShared ? 'bg-green-500/10 text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                <Globe size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Public Access</p>
                <p className="text-[11px] text-[var(--muted-text)] font-medium">
                  {note.isShared ? "Anyone with the link can view" : "Only you can see this note"}
                </p>
              </div>
            </div>
            <Button
              variant={note.isShared ? "destructive" : "default"}
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
              className={!note.isShared ? "ignite-button !h-8 font-bold bg-purple-500/20 border-purple-500/30 text-purple-400 group" : "h-8 font-bold"}
            >
              {isPending && <Loader2 size={14} className="mr-2 animate-spin relative z-10 group-hover:!text-white" />}
              <span className="relative z-10 group-hover:!text-white">
                {note.isShared ? "Revoke" : "Enable"}
              </span>
            </Button>
          </div>

          {note.isShared && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-400 ease-out">
              {/* Expiration Preview */}
              {note.shareExpiresAt && (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-500/80 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/10">
                  <Clock size={12} />
                  Expires: {new Date(note.shareExpiresAt).toLocaleString()}
                </div>
              )}

              {/* Link Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted-text)] uppercase tracking-[0.1em]">
                  Public Link
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="bg-zinc-100/50 dark:bg-black/40 border-zinc-200 dark:border-white/10 font-mono text-[13px] h-10 select-all rounded-lg focus-visible:ring-[var(--accent-strong)]"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyToClipboard}
                    className="h-10 w-10 shrink-0 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all rounded-lg"
                  >
                    {hasCopied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    asChild
                    className="h-10 w-10 shrink-0 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all rounded-lg"
                  >
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if ((window as any).electronAPI?.auth?.openExternal) {
                          e.preventDefault();
                          (window as any).electronAPI.auth.openExternal(shareUrl);
                        }
                      }}
                    >
                      <ExternalLink size={16} />
                    </a>
                  </Button>
                </div>
              </div>

              {/* View Count */}
              {note.shareViews !== undefined && (
                <p className="text-[10px] font-semibold text-[var(--muted-text)] flex items-center gap-1.5 px-1 uppercase tracking-wide">
                   <Globe size={11} className="opacity-50" /> {note.shareViews} total views
                </p>
              )}
            </div>
          )}

          {!note.isShared && (
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[var(--muted-text)] uppercase tracking-[0.1em]">
                Link Expiration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedExpiry(opt.value)}
                    className={`text-[11px] font-bold p-2.5 rounded-lg border transition-all ${
                      selectedExpiry === opt.value
                        ? "bg-[var(--accent-strong)]/10 border-[var(--accent-strong)]/40 text-[var(--accent-strong)] shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                        : "bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-[var(--muted-text)] hover:bg-zinc-100 dark:hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-zinc-50/50 dark:bg-black/20 border-t border-zinc-200 dark:border-white/5 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs font-bold text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-transparent transition-colors">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
