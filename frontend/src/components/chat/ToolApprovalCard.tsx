import React, { useState } from "react";
import { FilePlus, Trash2, XCircle } from "lucide-react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";

export interface ToolApprovalCardProps {
  toolCallId?: string;
  tool: "create_note" | "delete_note" | string;
  args: Record<string, any>;
  state?: "approval-requested" | "executing" | "success" | "denied" | "error" | string;
  onApprove: () => Promise<void> | void;
  onDeny: () => void;
  error?: string;
}

export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  tool,
  args,
  state = "approval-requested",
  onApprove,
  onDeny,
  error,
}) => {
  const [busy, setBusy] = useState(false);
  const isDelete = tool === "delete_note";

  const title = args?.title || (isDelete ? "this note" : "Untitled Note");
  const rawContent = typeof args?.content === "string" ? args.content : "";

  // Content preview snippet for create
  const preview = rawContent
    ? rawContent.slice(0, 100).replace(/[#*`_~\n]+/g, " ").trim() + (rawContent.length > 100 ? "..." : "")
    : isDelete
      ? "This note will be moved to your workspace trash."
      : "Creates a new Markdown note in your workspace.";

  const handleApprove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
    }
  };

  const handleDeny = () => {
    if (busy) return;
    onDeny();
  };

  // Denied state display
  if (state === "denied") {
    return (
      <div className="my-2 p-2.5 rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/30 text-xs text-[var(--muted-text)] flex items-center justify-between gap-2 max-w-md animate-in fade-in duration-150">
        <div className="flex items-center gap-2">
          <XCircle className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-[var(--text-strong)]/80">
            {isDelete ? `Denied deleting "${title}"` : `Denied creating "${title}"`}
          </span>
        </div>
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
          Denied
        </span>
      </div>
    );
  }

  // Error state display
  if (state === "error") {
    return (
      <div className="my-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-500 flex items-center justify-between gap-2 max-w-md">
        <span>Failed to {isDelete ? "delete" : "create"} &quot;{title}&quot;{error ? `: ${error}` : ""}</span>
      </div>
    );
  }

  return (
    <Item
      variant="outline"
      size="sm"
      className={`my-2 max-w-md animate-in fade-in duration-150 ${
        isDelete ? "border-rose-500/30" : ""
      }`}
    >
      <ItemMedia
        variant="icon"
        className={isDelete ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"}
      >
        {isDelete ? <Trash2 className="size-4" /> : <FilePlus className="size-4" />}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {isDelete ? `Move "${title}" to trash?` : `Create note "${title}"?`}
        </ItemTitle>
        <ItemDescription>{preview}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs touch-manipulation"
          onPress={handleDeny}
          disabled={busy}
        >
          Deny
        </Button>
        <Button
          size="sm"
          variant={isDelete ? "destructive" : "default"}
          className="h-8 px-3 text-xs touch-manipulation"
          onPress={handleApprove}
          disabled={busy}
        >
          {busy ? (isDelete ? "Deleting..." : "Creating...") : "Approve"}
        </Button>
      </ItemActions>
    </Item>
  );
};

export default ToolApprovalCard;

