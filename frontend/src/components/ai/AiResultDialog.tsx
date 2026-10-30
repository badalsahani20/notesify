import { useState, useEffect } from "react";
import {
  Check,
  Clipboard,
  CornerDownLeft,
  X,
  Sparkles,
  FileText,
  RotateCw,
  Lightbulb,
  Pencil,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { AssistResult } from "@/components/ai/types";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import "katex/dist/katex.min.css";
import { sanitizeStream } from "@/utils/streamSanitizer";
import IrisMarkdownRenderer from "@/components/chat/IrisMarkdownRenderer";

type AiResultDialogProps = {
  result: AssistResult | null;
  onApply: () => void;
  onClose: () => void;
};

const AiResultDialog = ({ result, onApply, onClose }: AiResultDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const dragControls = useDragControls();

  // On mobile devices, always lock to compact draggable view
  const activeExpanded = !isMobile && isExpanded;

  // Keyboard navigation: Esc to close, Cmd/Ctrl+Enter to insert
  useEffect(() => {
    if (!result) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !result.isStreaming) {
        e.preventDefault();
        onApply();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [result, onApply, onClose]);

  if (!result) return null;

  const isDialogAction = ["summarize", "explain", "rewrite", "noteCreation"].includes(result.action);
  if (!isDialogAction) return null;

  const getActionTitle = () => {
    switch (result.action) {
      case "summarize":
        return "AI Summary";
      case "explain":
        return "AI Explanation";
      case "noteCreation":
        return "AI Note Creator";
      case "rewrite":
        return "AI Polish";
      default:
        return "AI Insight";
    }
  };

  const getActionIcon = () => {
    switch (result.action) {
      case "summarize":
        return <FileText size={15} className="text-blue-400" />;
      case "explain":
        return <Lightbulb size={15} className="text-amber-400" />;
      case "noteCreation":
        return <Pencil size={15} className="text-emerald-400" />;
      case "rewrite":
        return <RotateCw size={15} className="text-emerald-400" />;
      default:
        return <Sparkles size={15} className="text-blue-400" />;
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result.suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      data-ai-result-dialog="true"
      layout
      drag={!activeExpanded}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className={cn(
        "fixed z-[85] rounded-2xl border border-[var(--divider)] bg-[var(--panel-bg-strong)] text-[var(--text-main)] shadow-[0_20px_54px_rgba(0,0,0,0.45)] backdrop-blur-xl overflow-hidden flex flex-col transition-[width,height] duration-200",
        activeExpanded
          ? "top-16 right-6 sm:right-10 w-[820px] max-w-[calc(100vw-32px)]"
          : "top-16 left-3 right-3 sm:left-auto sm:right-8 sm:top-20 w-auto sm:w-[500px] max-w-[calc(100vw-24px)]"
      )}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={(e) => {
          // Allow dragging only when clicking the header chrome, not buttons
          if ((e.target as HTMLElement).closest("button")) return;
          dragControls.start(e);
        }}
        className="cursor-grab active:cursor-grabbing select-none touch-none px-4 py-3 border-b border-[var(--divider)] bg-[var(--surface-ghost)]/50 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          {!activeExpanded && <GripHorizontal size={14} className="text-[var(--muted-text)] opacity-70" />}
          <div className="p-1 rounded-md bg-[var(--surface-ghost)] border border-[var(--divider)]">
            {getActionIcon()}
          </div>
          <span className="text-xs font-semibold text-[var(--text-strong)] tracking-tight">
            {getActionTitle()}
          </span>
          {result.isStreaming && (
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-strong)] animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Expand toggle (desktop only) */}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 rounded-lg text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors"
              title={activeExpanded ? "Compact view" : "Expand view"}
              aria-label={activeExpanded ? "Compact view" : "Expand view"}
            >
              {activeExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}

          {/* Minimize / Collapse toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1.5 rounded-lg text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors"
            title={isMinimized ? "Expand card" : "Collapse card"}
            aria-label={isMinimized ? "Expand card" : "Collapse card"}
          >
            {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors"
            title="Dismiss (Esc)"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Collapsible Content Area */}
      <AnimatePresence initial={false}>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col"
          >
            <div
              className={cn(
                "p-4 sm:p-5 overflow-y-auto custom-scrollbar bg-[var(--panel-bg)]/85 text-[13.5px] leading-[1.7] selection:bg-[var(--accent-strong)]/30",
                activeExpanded ? "max-h-[74vh] min-h-[220px]" : "max-h-[50vh] sm:max-h-[56vh] min-h-[140px]"
              )}
            >
              <div
                className={cn(
                  "gc-markdown text-[var(--text-strong)] text-[13.5px] leading-[1.7]",
                  activeExpanded ? "max-w-[76ch] mx-auto" : "max-w-full"
                )}
              >
                <IrisMarkdownRenderer content={sanitizeStream(result.suggestion)} />
                {result.isStreaming && <span className="gc-cursor" aria-hidden="true" />}
              </div>
            </div>

            {/* Clean Non-Redundant Action Footer */}
            <div className="px-4 py-3 border-t border-[var(--divider)] bg-[var(--surface-ghost)]/40 flex items-center justify-between gap-3 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={result.isStreaming || !result.suggestion}
                className="gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border-[var(--divider)] bg-[var(--surface-muted)] hover:bg-[var(--surface-ghost)] text-[var(--text-strong)] disabled:opacity-50"
                title="Copy text to clipboard"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Clipboard size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  onApply();
                  onClose();
                }}
                disabled={result.isStreaming || !result.suggestion}
                className={cn(
                  "gap-1.5 h-8 px-4 text-xs font-semibold rounded-lg text-white shadow-sm disabled:opacity-50 transition-all",
                  result.action === "rewrite"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-white text-zinc-950 font-semibold hover:bg-zinc-200 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                )}
                title="Insert into document (⌘+Enter)"
              >
                <CornerDownLeft size={13} />
                <span>{result.action === "rewrite" ? "Replace selection" : "Insert at cursor"}</span>
                <kbd className="hidden sm:inline-block text-[10px] opacity-75 ml-1 px-1 py-0.5 rounded bg-black/20 font-mono">
                  ↵
                </kbd>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AiResultDialog;

