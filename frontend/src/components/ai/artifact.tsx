import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Root Artifact Container ──────────────────────────────────────────────────
export interface ArtifactProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Artifact = React.forwardRef<HTMLDivElement, ArtifactProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col h-full w-full bg-[#0a0b10] border-l border-slate-800/80 select-text overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Artifact.displayName = "Artifact";

// ── Artifact Header ──────────────────────────────────────────────────────────
export interface ArtifactHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const ArtifactHeader = React.forwardRef<
  HTMLDivElement,
  ArtifactHeaderProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0 gap-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
ArtifactHeader.displayName = "ArtifactHeader";

// ── Artifact Title ───────────────────────────────────────────────────────────
export interface ArtifactTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

export const ArtifactTitle = React.forwardRef<
  HTMLHeadingElement,
  ArtifactTitleProps
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-sm font-semibold text-white/90 truncate max-w-[240px] sm:max-w-[340px]",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));
ArtifactTitle.displayName = "ArtifactTitle";

// ── Artifact Description / Badge ─────────────────────────────────────────────
export interface ArtifactDescriptionProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const ArtifactDescription = React.forwardRef<
  HTMLDivElement,
  ArtifactDescriptionProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
ArtifactDescription.displayName = "ArtifactDescription";

// ── Artifact Actions Container ───────────────────────────────────────────────
export interface ArtifactActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const ArtifactActions = React.forwardRef<
  HTMLDivElement,
  ArtifactActionsProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1.5 shrink-0", className)}
    {...props}
  >
    {children}
  </div>
));
ArtifactActions.displayName = "ArtifactActions";

// ── Artifact Single Action Button ────────────────────────────────────────────
export interface ArtifactActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "outline" | "solid";
}

export const ArtifactAction = React.forwardRef<
  HTMLButtonElement,
  ArtifactActionProps
>(({ className, variant = "outline", children, ...props }, ref) => {
  const variantStyles = {
    ghost: "text-neutral-400 hover:text-white hover:bg-white/10",
    outline:
      "text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10",
    solid:
      "text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30",
  }[variant];

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5",
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
ArtifactAction.displayName = "ArtifactAction";

// ── Artifact Close Button ────────────────────────────────────────────────────
export interface ArtifactCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const ArtifactClose = React.forwardRef<
  HTMLButtonElement,
  ArtifactCloseProps
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer",
      className
    )}
    title="Close artifact"
    {...props}
  >
    <X size={14} />
  </button>
));
ArtifactClose.displayName = "ArtifactClose";

// ── Artifact Content Container ───────────────────────────────────────────────
export interface ArtifactContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const ArtifactContent = React.forwardRef<
  HTMLDivElement,
  ArtifactContentProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 pb-32 overscroll-contain",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
ArtifactContent.displayName = "ArtifactContent";
