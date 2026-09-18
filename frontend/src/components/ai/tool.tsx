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
        "my-2 rounded-xl border px-3 py-2 text-xs backdrop-blur-sm transition-all flex items-center justify-between gap-2.5 max-w-sm",
        {
          "border-slate-800 bg-slate-900/30 text-slate-400": state === "pending",
          "border-slate-700 bg-slate-900/60 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]":
            state === "running",
          "border-slate-800/80 bg-slate-900/40 text-slate-300":
            state === "completed",
          "border-red-900/40 bg-red-950/20 text-red-400": state === "error",
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
    <Wrench size={13} className="shrink-0 text-slate-400" />
    <div className="min-w-0 truncate">
      <span className="font-mono font-medium text-slate-300">{name}</span>
      {argsSummary && (
        <span className="ml-1.5 text-slate-400 truncate font-sans">
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
        <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-medium shrink-0">
          <Loader2 size={12} className="animate-spin" />
          <span>Running</span>
        </span>
      );
    case "completed":
      return (
        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium shrink-0">
          <Check size={12} className="text-emerald-400/90" />
          <span>Done</span>
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium shrink-0">
          <AlertCircle size={12} />
          <span>Failed</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="text-[11px] text-slate-500 font-medium shrink-0">
          Queued
        </span>
      );
  }
};
