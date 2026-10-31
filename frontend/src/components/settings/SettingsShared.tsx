import React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3 mt-6 first:mt-0">
    {children}
  </p>
);

export const ToggleRow = ({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
    <div>
      <p className="text-sm text-zinc-200 font-medium">{label}</p>
      {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        value ? "bg-indigo-500" : "bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-lg transition-transform duration-200",
          value ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  </div>
);

export function OptionChip<T extends string>({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: T;
  current: T;
  onSelect: (v: T) => void;
}) {
  const isSelected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "relative flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer",
        isSelected
          ? "border-white bg-white text-zinc-950 font-semibold shadow-sm"
          : "border-white/8 bg-white/4 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
      )}
    >
      {isSelected && <CheckCircle2 size={13} className="text-zinc-950 shrink-0" />}
      {label}
    </button>
  );
}
