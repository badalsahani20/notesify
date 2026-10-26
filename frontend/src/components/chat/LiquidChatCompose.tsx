import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { createPortal } from "react-dom";
import {
  IconPaperclip,
  IconArrowUp,
  IconX,
  IconRocket,
  IconBulb,
  IconSparkles,
  IconCheck,
  IconChevronDown,
  IconFileDescription,
  IconSquare,
} from "@tabler/icons-react";
import { Globe, FileText, BrainCircuit, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserStats } from "@/hooks/user/useUserStats";
import { VoiceDictationButton } from "./VoiceDictationButton";
import { AiUsageContextIndicator } from "./AiUsageContextIndicator";
import type { ChatAttachmentBundle } from "@/components/ai/types";

export type LiquidModelType = "pro" | "thinking" | "fast";

export interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
  onSelect?: () => void;
}

const DEFAULT_COMMANDS: CommandSuggestion[] = [
  {
    icon: <FileText className="w-4 h-4" />,
    label: "Summarize",
    description: "Summarize the current note",
    prefix: "/summarize",
  },
  {
    icon: <BrainCircuit className="w-4 h-4" />,
    label: "Create Quiz",
    description: "Generate a quiz from your notes",
    prefix: "/quiz",
  },
  {
    icon: <Search className="w-4 h-4" />,
    label: "Search",
    description: "Search globally across all notes",
    prefix: "/search",
  },
];

const LIQUID_MATTE_NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.65 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

const MODELS: ReadonlyArray<{
  id: LiquidModelType;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    id: "fast",
    label: "Fast",
    blurb: "Quick answers for everyday questions.",
    icon: IconRocket,
  },
  {
    id: "thinking",
    label: "Thinking",
    blurb: "More careful answers for difficult questions.",
    icon: IconBulb,
  },
  {
    id: "pro",
    label: "Pro",
    blurb: "Our best answers for complex questions and tasks.",
    icon: IconSparkles,
  },
];

export interface LiquidChatComposeProps {
  input: string;
  setInput: (val: string) => void;
  attachedImage: string | null;
  setAttachedImage: (val: string | null) => void;
  attachedDoc?: ChatAttachmentBundle | null;
  onDocUpload?: (files: File[]) => Promise<void> | void;
  onClearDoc?: () => void;
  isSending: boolean;
  imageDisabled: boolean;
  handleSend: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  topSlot?: React.ReactNode;
  placeholder?: string;
  onStop?: () => void;
  modelTier?: LiquidModelType;
  setModelTier?: (tier: LiquidModelType) => void;
  useReasoning?: boolean;
  setUseReasoning?: (val: boolean) => void;
  useWebSearch?: boolean;
  setUseWebSearch?: (val: boolean) => void;
  minHeight?: number;
  maxHeight?: number;
  compact?: boolean;
}

export const LiquidChatCompose = ({
  input,
  setInput,
  attachedImage,
  setAttachedImage,
  attachedDoc = null,
  onDocUpload,
  onClearDoc,
  isSending,
  imageDisabled,
  handleSend,
  textareaRef: externalTextareaRef,
  fileRef,
  topSlot,
  placeholder = "Ask Iris anything...",
  onStop,
  modelTier = "fast",
  setModelTier,
  useReasoning = false,
  setUseReasoning,
  useWebSearch = false,
  setUseWebSearch,
  minHeight = 44,
  maxHeight = 220,
  compact,
}: LiquidChatComposeProps) => {
  const composeContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  useEffect(() => {
    const el = composeContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCompact = compact ?? containerWidth < 460;
  const { data: userStats } = useUserStats();
  const tokensUsed = userStats?.tokensUsed ?? userStats?.aiCount ?? 0;
  const tokensLimit = userStats?.tokensLimit ?? userStats?.limit ?? 100000;
  const isLimitReached = Boolean(userStats && tokensLimit > 0 && tokensUsed >= tokensLimit);

  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;

  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [userDismissedCommands, setUserDismissedCommands] = useState(false);
  const commandPaletteRef = useRef<HTMLDivElement>(null);

  // Model selection state: defaults to "fast" (Ling 3.0 Flash)
  const selectedModel: LiquidModelType =
    modelTier || (useReasoning ? "thinking" : "fast");

  const handleModelSelect = (m: LiquidModelType) => {
    setModelTier?.(m);
    if (m === "fast") {
      setUseReasoning?.(false);
    } else {
      setUseReasoning?.(true);
    }
  };

  // ── Auto-Resize Optimization ────────────────────────────────────────────────
  // Keeps the compose box sleek when short/empty, and smoothly expands up to maxHeight
  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset || !textarea.value) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const scrollHeight = textarea.scrollHeight;
      const targetHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

      textarea.style.height = `${targetHeight}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
    },
    [minHeight, maxHeight, textareaRef]
  );

  useLayoutEffect(() => {
    adjustHeight();
  }, [adjustHeight, input]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  // ── Clipboard Paste Handler ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: Event) => {
      const clipboardEvent = e as ClipboardEvent;
      const clipboardItems = clipboardEvent.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          if (file.size > 15 * 1024 * 1024) {
            toast.error("Pasted image must be less than 15 MB");
            continue;
          }

          clipboardEvent.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setAttachedImage(event.target.result as string);
              toast.success("Image attached from clipboard!");
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) textarea.addEventListener("paste", handlePaste);
    return () => {
      if (textarea) textarea.removeEventListener("paste", handlePaste);
    };
  }, [textareaRef, setAttachedImage]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  // ── File Handlers ───────────────────────────────────────────────────────────
  const processUploadedFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File must be less than 15 MB");
      return;
    }
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (!onDocUpload) {
        toast.error("PDF upload is not available in this chat");
        return;
      }
      setIsUploadingDoc(true);
      try {
        await onDocUpload([file]);
        toast.success("PDF uploaded and ready for Iris");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to upload PDF");
      } finally {
        setIsUploadingDoc(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setAttachedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Drag and Drop
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processUploadedFile(files[0]);
    }
  };

  // ── Slash Commands ──────────────────────────────────────────────────────────
  const isCommandQuery = input.startsWith("/") && !input.includes(" ") && !input.includes("\n");
  const filterQuery = isCommandQuery ? input.trim().toLowerCase() : "";
  const filteredSuggestions = DEFAULT_COMMANDS.filter(
    (s) =>
      filterQuery.length <= 1 ||
      s.prefix.toLowerCase().startsWith(filterQuery) ||
      s.label.toLowerCase().includes(filterQuery.slice(1))
  );

  useEffect(() => {
    if (isCommandQuery && !userDismissedCommands && filteredSuggestions.length > 0) {
      setShowCommandPalette(true);
      setActiveSuggestion(0);
    } else {
      setShowCommandPalette(false);
      if (!input.startsWith("/")) {
        setUserDismissedCommands(false);
      }
    }
  }, [isCommandQuery, userDismissedCommands, filteredSuggestions.length, input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && activeSuggestion >= 0)) {
        e.preventDefault();
        const selectedCommand = filteredSuggestions[activeSuggestion];
        if (selectedCommand) {
          if (selectedCommand.onSelect) {
            selectedCommand.onSelect();
            setInput("");
          } else {
            setInput(selectedCommand.prefix + " ");
          }
          setShowCommandPalette(false);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
        setUserDismissedCommands(true);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() && !attachedImage && !attachedDoc) return;
      if (isSending || isLimitReached) return;
      handleSend();
      adjustHeight(true);
    }
  };

  const isPdf = attachedImage?.startsWith("data:application/pdf");

  return (
    <div className="absolute bottom-0 left-0 w-full z-20 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-2 px-2 sm:px-4 flex flex-col justify-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col w-full max-w-3xl mx-auto">
        {topSlot}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileRef}
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Outer Aurora Glow (Drop target) */}
        <div
          ref={composeContainerRef}
          className="relative w-full"
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-[30px] opacity-0 blur-[10px]"
            animate={{ opacity: dragOver ? 0.9 : 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background:
                "conic-gradient(from 0deg, var(--primary, #3b82f6), #93c5fd, var(--primary, #3b82f6), #1d4ed8, var(--primary, #3b82f6))",
              willChange: "opacity",
            }}
          />

          {/* Main Liquid Container */}
          <div
            className={cn(
              "group relative isolate flex w-full flex-col gap-2 overflow-hidden rounded-[26px] p-2.5 sm:p-3 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              // Light Mode
              "border border-black/[0.08] bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffffff_0%,#f4f4f5_72%)] text-base",
              "shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(0,0,0,.08)]",
              "hover:border-black/[0.14] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10",
              // Dark Mode
              "dark:border-white/[0.08] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#15151b_0%,#0a0a0b_72%)]",
              "dark:shadow-[0_1px_2px_rgba(0,0,0,.4),0_8px_24px_-12px_rgba(0,0,0,.6)]",
              "dark:hover:border-white/[0.14] dark:focus-within:border-primary/40 dark:focus-within:ring-2 dark:focus-within:ring-primary/10",
              dragOver && "border-primary/50 dark:border-primary/50"
            )}
          >
            {/* Texture Noise */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.055]"
              style={{
                backgroundImage: LIQUID_MATTE_NOISE,
                backgroundSize: "240px 240px",
              }}
            />

            {/* Inner Border Gradient Accent */}
            <div
              aria-hidden
              className="lmi-border pointer-events-none absolute inset-0 z-10 rounded-[26px] opacity-40 transition-opacity duration-500 group-focus-within:opacity-90 group-hover:opacity-75"
              style={{
                padding: "1px",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                background:
                  "conic-gradient(from var(--lmi-angle, 0deg), transparent 65%, rgba(59,130,246,0.6) 80%, #93c5fd 95%, transparent 100%)",
              }}
            />
            <style>{`
              @property --lmi-angle {
                syntax: '<angle>';
                initial-value: 0deg;
                inherits: false;
              }
              .lmi-border {
                animation: lmi-spin 5s linear infinite;
              }
              @keyframes lmi-spin {
                to { --lmi-angle: 360deg; }
              }
            `}</style>

            {/* Attachments Section */}
            {(attachedImage || attachedDoc) && (
              <div className="relative z-20 flex flex-wrap gap-2.5 px-2 pt-1 pb-2 w-full justify-start">
                {attachedImage && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="group/file relative flex shrink-0 items-center justify-center"
                  >
                    {!isPdf ? (
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="relative h-16 w-16 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 shadow-sm cursor-zoom-in"
                      >
                        <img
                          src={attachedImage}
                          alt="Attached"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover/file:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="flex h-14 max-w-[180px] items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <IconFileDescription size={20} className="shrink-0 text-primary" />
                        <span className="truncate text-xs font-medium text-foreground">
                          PDF Document
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachedImage(null)}
                      aria-label="Remove attachment"
                      className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white shadow-md hover:bg-destructive transition-colors dark:bg-slate-700"
                    >
                      <IconX size={12} stroke={2.5} />
                    </button>
                  </motion.div>
                )}

                {attachedDoc &&
                  attachedDoc.files.map((file, idx) => (
                    <motion.div
                      key={`${attachedDoc.id}-${idx}`}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="group/file relative flex shrink-0 items-center justify-center"
                    >
                      <div className="flex h-14 max-w-[180px] items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <IconFileDescription size={20} className="shrink-0 text-primary" />
                        <span className="truncate text-xs font-medium text-foreground">
                          {file.originalName || "Document.pdf"}
                        </span>
                      </div>
                      {onClearDoc && (
                        <button
                          type="button"
                          onClick={onClearDoc}
                          aria-label="Remove document"
                          className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white shadow-md hover:bg-destructive transition-colors dark:bg-slate-700"
                        >
                          <IconX size={12} stroke={2.5} />
                        </button>
                      )}
                    </motion.div>
                  ))}
              </div>
            )}

            {/* Input Area */}
            <div className="relative z-20 w-full flex flex-col">
              <textarea
                ref={textareaRef as any}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLimitReached
                    ? "Daily AI token limit reached (Resets at 00:00 UTC)"
                    : placeholder
                }
                disabled={isLimitReached || isSending || isUploadingDoc}
                rows={1}
                aria-label="AI message input"
                className="w-full resize-none bg-transparent px-2.5 py-1 text-[15px] sm:text-[15.5px] leading-relaxed text-white outline-none placeholder:text-muted-foreground/60 custom-scrollbar disabled:opacity-50 transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  minHeight: `${minHeight}px`,
                  maxHeight: `${maxHeight}px`,
                }}
              />

              {/* Slash Command Autocomplete Popover */}
              <AnimatePresence>
                {showCommandPalette && (
                  <motion.div
                    ref={commandPaletteRef}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-3 w-72 rounded-2xl border border-black/10 bg-background/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/95 z-50 overflow-hidden"
                  >
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Suggested Actions
                    </div>
                    {filteredSuggestions.map((cmd, idx) => {
                      const isActive = idx === activeSuggestion;
                      return (
                        <button
                          key={cmd.prefix}
                          type="button"
                          onClick={() => {
                            if (cmd.onSelect) {
                              cmd.onSelect();
                              setInput("");
                            } else {
                              setInput(cmd.prefix + " ");
                            }
                            setShowCommandPalette(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span className={cn(isActive ? "text-primary-foreground" : "text-primary")}>
                            {cmd.icon}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold">{cmd.label}</span>
                            <span className={cn("text-[10px] truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              {cmd.description}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Toolbar */}
            <div className="relative z-20 flex items-center justify-between gap-1 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.04]">
              {/* Left Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Attach File Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (imageDisabled) {
                      toast.error("Image analysis is temporarily unavailable.");
                      return;
                    }
                    fileRef.current?.click();
                  }}
                  aria-label="Attach file or image"
                  title="Attach images or PDF files"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 shrink-0"
                >
                  <IconPaperclip size={17} />
                </button>

                {/* Web Search Button */}
                {setUseWebSearch && (
                  <button
                    type="button"
                    onClick={() => setUseWebSearch(!useWebSearch)}
                    className={cn(
                      "rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-xs font-medium shrink-0",
                      isCompact ? "h-8 w-8 justify-center p-0" : "p-1.5 sm:px-2.5 sm:py-1",
                      useWebSearch
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm font-semibold hover:opacity-90"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    title={useWebSearch ? "Web Search Enabled" : "Enable Web Search"}
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    {!isCompact && <span className="hidden sm:inline">Web</span>}
                  </button>
                )}
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Context Token Usage Indicator */}
                <AiUsageContextIndicator variant="rail" />

                {/* Liquid Model Selector with Thinking */}
                <LiquidModelMenu
                  value={selectedModel}
                  onChange={handleModelSelect}
                  compact={isCompact}
                />

                {/* Voice Dictation */}
                <VoiceDictationButton
                  onTranscript={(text) => {
                    setInput(input ? `${input.trim()} ${text}` : text);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 60);
                  }}
                  disabled={isSending || isLimitReached}
                />

                {/* Send / Stop Button */}
                {isSending ? (
                  <motion.button
                    type="button"
                    onClick={onStop}
                    aria-label="Stop generation"
                    title="Stop generation"
                    whileTap={{ scale: 0.92 }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 transition-opacity ml-0.5 shrink-0"
                  >
                    <IconSquare size={14} fill="currentColor" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleSend}
                    disabled={(!input.trim() && !attachedImage && !attachedDoc) || isLimitReached || isUploadingDoc}
                    aria-label="Send prompt"
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full transition-all ml-0.5 shrink-0",
                      "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
                      "disabled:bg-muted disabled:text-muted-foreground/40 disabled:shadow-none"
                    )}
                  >
                    <IconArrowUp size={16} stroke={2.5} />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Drag Overlay */}
            <AnimatePresence>
              {dragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-[26px] bg-background/80 backdrop-blur-[2px]"
                >
                  <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-background px-5 py-2.5 text-sm font-semibold text-primary shadow-xl">
                    <IconPaperclip size={16} />
                    Drop files here
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Lightbox Modal */}
        {lightboxOpen &&
          attachedImage &&
          !isPdf &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="relative max-w-[90vw] max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={attachedImage}
                  alt="Preview"
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                />
                <button
                  type="button"
                  className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
                  onClick={() => setLightboxOpen(false)}
                  title="Close (Esc)"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

/* ───────────────────────── Liquid Model Menu ───────────────────────── */

interface ModelMenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

function LiquidModelMenu({
  value,
  onChange,
  compact = false,
}: {
  value: LiquidModelType;
  onChange: (m: LiquidModelType) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState<LiquidModelType | null>(null);
  const [menuPosition, setMenuPosition] = useState<ModelMenuPosition | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];
  const CurrentIcon = current.icon;

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(270, window.innerWidth - viewportPadding * 2);

    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    // Always prefer opening upwards when in a bottom docked compose bar
    const openUpwards = spaceBelow < 230 || spaceAbove > spaceBelow;

    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );

    if (openUpwards) {
      const bottom = Math.max(8, window.innerHeight - rect.top + 8);
      const maxHeight = Math.min(340, Math.max(160, spaceAbove - 16));
      setMenuPosition({
        bottom,
        left,
        width: menuWidth,
        maxHeight,
        placement: "top",
      });
    } else {
      const top = rect.bottom + 8;
      const maxHeight = Math.min(340, Math.max(160, spaceBelow - 16));
      setMenuPosition({
        top,
        left,
        width: menuWidth,
        maxHeight,
        placement: "bottom",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      setHoverId(null);
      return;
    }

    updateMenuPosition();

    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onViewportChange() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  const menu =
    open && menuPosition
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key={listboxId}
              ref={menuRef}
              role="listbox"
              id={listboxId}
              initial={{
                opacity: 0,
                y: menuPosition.placement === "top" ? 8 : -8,
                scale: 0.94,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: menuPosition.placement === "top" ? 8 : -8,
                scale: 0.96,
              }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className={cn(
                "fixed isolate z-[9999] overflow-hidden rounded-2xl border border-black/[0.08] p-1.5",
                "bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffffff_0%,#f4f4f5_72%)] text-foreground",
                "shadow-[0_4px_24px_-6px_rgba(0,0,0,.15),0_12px_48px_-12px_rgba(0,0,0,.25)]",
                "dark:border-white/[0.08] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#18181f_0%,#0c0c0e_72%)]",
                "dark:shadow-[0_4px_24px_-6px_rgba(0,0,0,.6),0_16px_56px_-12px_rgba(0,0,0,.85)]"
              )}
              style={{
                ...(menuPosition.placement === "top"
                  ? { bottom: menuPosition.bottom }
                  : { top: menuPosition.top }),
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                transformOrigin: menuPosition.placement === "top" ? "bottom right" : "top right",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.06]"
                style={{
                  backgroundImage: LIQUID_MATTE_NOISE,
                  backgroundSize: "240px 240px",
                }}
              />
              <LayoutGroup id="liquid-model-options">
                <div
                  className="relative z-10 flex flex-col gap-1 overflow-hidden"
                  onMouseLeave={() => setHoverId(null)}
                >
                  {MODELS.map((m) => {
                    const Icon = m.icon;
                    const selected = m.id === value;
                    const highlighted = hoverId === m.id || (!hoverId && selected);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setHoverId(m.id)}
                        onFocus={() => setHoverId(m.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(m.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "group/opt relative flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left outline-none transition-colors cursor-pointer",
                          highlighted ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {highlighted && (
                          <motion.span
                            layoutId="liquid-model-opt-highlight"
                            className="absolute inset-0 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 32,
                            }}
                            aria-hidden
                          />
                        )}

                        <span
                          className={cn(
                            "relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                            highlighted && !selected && "bg-muted/80 text-foreground"
                          )}
                        >
                          <Icon size={15} />
                        </span>

                        <span className="relative z-10 min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1.5">
                            <span className="text-[12.5px] font-semibold leading-tight">
                              {m.label}
                            </span>
                            {selected && (
                              <IconCheck size={14} stroke={3} className="text-primary shrink-0" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {m.blurb}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        title={`Model mode: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center rounded-lg transition-all duration-150 cursor-pointer",
          compact ? "gap-1 px-1.5 text-[11.5px]" : "gap-1.5 px-2 text-[12px]",
          "bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
          open && "bg-black/5 text-foreground dark:bg-white/10"
        )}
      >
        <span className="text-inherit">
          <CurrentIcon size={15} />
        </span>
        {!compact && <span className="hidden sm:inline">{current.label}</span>}
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex text-inherit opacity-60"
        >
          <IconChevronDown size={13} />
        </motion.span>
      </button>
      {menu}
    </div>
  );
}
