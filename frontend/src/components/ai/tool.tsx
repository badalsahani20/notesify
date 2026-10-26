import * as React from "react";
import { Check, Loader2, AlertCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolState = "pending" | "running" | "completed" | "error";

export interface ToolProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: ToolState;
}

export const Tool = React.forwardRef<HTMLDivElement, ToolProps>(
  ({ state = "completed", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "my-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-xs transition-all flex items-center justify-between gap-2.5 max-w-sm",
        {
          "border-[var(--divider)] bg-[var(--surface-muted)]/40 text-[var(--muted-text)]": state === "pending",
          "border-[var(--accent-strong)]/40 bg-[var(--active-surface)] text-[var(--text-strong)]":
            state === "running",
          "border-[var(--divider)] bg-[var(--surface-muted)]/60 text-[var(--text-strong)]":
            state === "completed",
          "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400": state === "error",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Tool.displayName = "Tool";

export interface ToolCallProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  argsSummary?: string;
}

export const ToolCall: React.FC<ToolCallProps> = ({
  name,
  argsSummary,
  className,
}) => (
  <div className={cn("flex items-center gap-2 min-w-0", className)}>
    <Wrench size={13} className="shrink-0 text-[var(--muted-text)]" />
    <div className="min-w-0 truncate">
      <span className="font-mono font-medium text-[var(--text-strong)]">{name}</span>
      {argsSummary && (
        <span className="ml-1.5 text-[var(--muted-text)] truncate font-sans">
          ({argsSummary})
        </span>
      )}
    </div>
  </div>
);

export interface ToolStatusProps {
  state: ToolState;
}

export const ToolStatus: React.FC<ToolStatusProps> = ({ state }) => {
  switch (state) {
    case "running":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[var(--accent-strong)] font-medium shrink-0">
          <Loader2 size={12} className="animate-spin" />
          <span>Running</span>
        </span>
      );
    case "completed":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[var(--muted-text)] font-medium shrink-0">
          <Check size={12} className="text-emerald-500" />
          <span>Done</span>
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[11px] text-rose-500 font-medium shrink-0">
          <AlertCircle size={12} />
          <span>Failed</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="text-[11px] text-[var(--muted-text)] opacity-70 font-medium shrink-0">
          Queued
        </span>
      );
  }
};
