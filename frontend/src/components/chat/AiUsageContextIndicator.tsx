import React from "react";
import { Sparkles, Clock } from "lucide-react";
import { useUserStats } from "@/hooks/user/useUserStats";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AiUsageContextIndicatorProps {
  variant?: "rail" | "badge" | "compact";
  className?: string;
}

export const AiUsageContextIndicator: React.FC<AiUsageContextIndicatorProps> = ({
  variant = "rail",
  className = "",
}) => {
  const { data: stats, isLoading } = useUserStats();

  const tokensUsed = stats?.tokensUsed ?? stats?.aiCount ?? 0;
  const tokensLimit = stats?.tokensLimit ?? 100000;
  const tokensInput = stats?.tokensInput ?? 0;
  const tokensOutput = stats?.tokensOutput ?? 0;
  const tier = (stats?.tier || "free").toUpperCase();

  const usageRatio = tokensLimit > 0 ? tokensUsed / tokensLimit : 0;
  const pct = Math.min(Math.round(usageRatio * 100), 100);

  // Dynamic status color based on saturation
  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return { stroke: "#f43f5e", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };
    if (percentage >= 70) return { stroke: "#f59e0b", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    return { stroke: "#10b981", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  };

  const status = getStatusColor(pct);

  // SVG ring configuration
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {variant === "rail" ? (
            <button
              type="button"
              className={`group flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full border transition-all cursor-pointer hover:scale-105 active:scale-95 ${status.bg} ${status.border} ${className}`}
              style={{ WebkitAppRegion: "no-drag" } as any}
              aria-label={`AI Token Usage: ${pct}%`}
            >
              <svg className="w-3.5 h-3.5 -rotate-90 shrink-0" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className="stroke-white/10"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  stroke={status.stroke}
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className={`text-[10px] font-bold tracking-tighter ${status.text}`}>
                {isLoading ? "…" : `${pct}%`}
              </span>
            </button>
          ) : variant === "badge" ? (
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all hover:bg-white/5 cursor-pointer ${status.bg} ${status.border} ${className}`}
              style={{ WebkitAppRegion: "no-drag" } as any}
            >
              <svg className="w-3.5 h-3.5 -rotate-90 shrink-0" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className="stroke-white/10"
                  strokeWidth="3"
                  fill="transparent"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  stroke={status.stroke}
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className={status.text}>{pct}%</span>
              <span className="text-white/40">quota</span>
            </button>
          ) : (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${status.bg} ${status.border} cursor-pointer ${className}`}
            >
              <span className={`text-[9px] font-bold ${status.text}`}>
                {pct}%
              </span>
            </span>
          )}
        </TooltipTrigger>

        <TooltipContent
          side="right"
          sideOffset={8}
          className="z-50 w-64 p-3.5 rounded-xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl text-zinc-100 shadow-2xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <Sparkles size={13} className="text-amber-400" />
              <span>AI Token Quota</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              {tier}
            </span>
          </div>

          {/* Gauge Summary */}
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xl font-bold tracking-tight text-white">
              {pct}% <span className="text-xs font-normal text-white/50">used</span>
            </span>
            <span className="text-[11px] text-white/60">
              {tokensUsed.toLocaleString()} / {tokensLimit.toLocaleString()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                backgroundColor: status.stroke,
                boxShadow: `0 0 8px ${status.stroke}66`,
              }}
            />
          </div>

          {/* Input vs Output breakdown */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-white/5 border border-white/5 text-[11px] mb-2.5">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Input</p>
              <p className="font-semibold text-white/80">{tokensInput.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Output</p>
              <p className="font-semibold text-white/80">{tokensOutput.toLocaleString()}</p>
            </div>
          </div>

          {/* Reset Schedule */}
          <div className="flex items-center gap-1.5 text-[10px] text-white/45">
            <Clock size={11} className="shrink-0" />
            <span>Resets daily at 00:00 UTC</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AiUsageContextIndicator;
