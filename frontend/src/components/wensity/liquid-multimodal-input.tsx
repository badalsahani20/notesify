"use client";

import * as React from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { createPortal } from "react-dom";
import {
  IconPaperclip,
  IconPhoto,
  IconArrowUp,
  IconX,
  IconRocket,
  IconBulb,
  IconSparkles,
  IconCheck,
  IconChevronDown,
  IconFileDescription,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type LiquidModel = "fast" | "thinking" | "pro";

export interface LiquidMultimodalInputProps {
  /** Placeholder text when empty */
  placeholder?: string;
  /** Maximum height in px before scrolling */
  maxHeight?: number;
  /** Accepted file MIME types */
  accept?: string;
  /** Initial selected model (default "pro") */
  defaultModel?: LiquidModel;
  /** Fired when user submits (Enter without Shift, or click) */
  onSubmit?: (value: string, files: File[], model: LiquidModel) => void;
  /** Fired on every text change */
  onChange?: (value: string) => void;
  /** Fired when the model selection changes */
  onModelChange?: (model: LiquidModel) => void;
  /** Hide the built-in model selector (e.g. when the host app owns model state) */
  hideModel?: boolean;
  /** Optional className for the outer container */
  className?: string;
}

type AttachedFile = { id: string; file: File; preview?: string };

const LIQUID_MATTE_NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.65 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

export function LiquidMultimodalInput({
  placeholder = "Ask anything, or drop files…",
  maxHeight = 250,
  accept = "image/*,application/pdf,text/*",
  defaultModel = "pro",
  onSubmit,
  onChange,
  onModelChange,
  hideModel = false,
  className,
}: LiquidMultimodalInputProps) {
  const [value, setValue] = React.useState("");
  const [files, setFiles] = React.useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [model, setModel] = React.useState<LiquidModel>(defaultModel);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounter = React.useRef(0);

  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 80), maxHeight) + "px";
  }, [value, maxHeight]);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.id !== id);
    });
  }

  function submit() {
    if (!value.trim() && files.length === 0) return;
    onSubmit?.(value, files.map((f) => f.file), model);
    setValue("");
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
    if (taRef.current) taRef.current.style.height = "80px";
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div
      className={cn("w-full max-w-3xl", className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{ willChange: "transform" }}
    >
      <div className="relative w-full flex flex-col items-center">
        {/* Outer Aurora Glow (Drop target) */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[2px] rounded-[30px] opacity-0 blur-[10px]"
          animate={{ opacity: dragOver ? 0.9 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background:
              "conic-gradient(from 0deg, #cd1c18, #ffa896, #cd1c18, #9b1313, #cd1c18)",
            willChange: "opacity",
          }}
        />

        {/* Main Form Container (Exact structural styling from snippet) */}
        <div
          className={cn(
            "group relative isolate flex w-full flex-col gap-2 overflow-hidden rounded-[28px] p-3 transition-all duration-150 ease-in-out",
            // Light Mode Styles
            "border border-black/[0.08] bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffffff_0%,#f4f4f5_72%)] text-base",
            "shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(0,0,0,.08)]",
            "hover:border-black/[0.12] focus-within:border-black/[0.14]",
            // Dark Mode Styles
            "dark:border-white/[0.06] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#15151b_0%,#0a0a0b_72%)]",
            "dark:shadow-[0_1px_2px_rgba(0,0,0,.4),0_8px_24px_-12px_rgba(0,0,0,.6)]",
            "dark:hover:border-white/[0.12] dark:focus-within:border-white/[0.16]",
            // Active Drop Override
            dragOver && "border-chili-500/45 dark:border-chili-500/45"
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.055]"
            style={{
              backgroundImage: LIQUID_MATTE_NOISE,
              backgroundSize: "240px 240px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.035)_0%,transparent_30%,transparent_72%,rgba(0,0,0,0.055)_100%)] dark:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,transparent_28%,transparent_72%,rgba(0,0,0,0.22)_100%)]"
          />

          {/* Animated Gradient Thin Inner Edge (1px) */}
          <div
            aria-hidden
            className="lmi-border pointer-events-none absolute inset-0 z-10 rounded-[28px] opacity-50 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100"
            style={{
              padding: "1px",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              background:
                "conic-gradient(from var(--lmi-angle, 0deg), transparent 65%, rgba(205,28,24,0.6) 80%, #ffa896 95%, transparent 100%)",
            }}
          />
          <style>{`
            @property --lmi-angle {
              syntax: '<angle>';
              initial-value: 0deg;
              inherits: false;
            }
            .lmi-border {
              animation: lmi-spin 4s linear infinite;
            }
            @keyframes lmi-spin {
              to { --lmi-angle: 360deg; }
            }
          `}</style>

          <div className="w-full min-w-0 relative z-20">
            <div className="relative grid w-full flex-1">
              
              {/* Attachments Gallery (No bottom border, uses natural gap) */}
              <AnimatePresence initial={false}>
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap gap-3 px-2 pt-1 pb-4"
                  >
                    {files.map((f) => (
                      <motion.div
                        key={f.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="group/file relative flex shrink-0 items-center justify-center"
                      >
                        {f.preview ? (
                          // 1:1 Image Preview Card (Click to preview)
                          <button
                            type="button"
                            onClick={() => window.open(f.preview, "_blank")}
                            className="relative h-20 w-20 overflow-hidden rounded-xl border border-black/5 shadow-sm dark:border-white/10 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-chili-500/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={f.preview}
                              alt={f.file.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover/file:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-200 group-hover/file:opacity-100" />
                          </button>
                        ) : (
                          // File Preview Card
                          <div className="flex h-14 max-w-[160px] items-center gap-2 rounded-xl border border-black/5 bg-black/5 px-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                            <IconFileDescription
                              size={20}
                              className="shrink-0 text-slate-400 dark:text-muted-foreground"
                            />
                            <span className="truncate text-xs font-medium text-slate-700 dark:text-foreground">
                              {f.file.name}
                            </span>
                          </div>
                        )}

                        {/* Floating Remove Button (Always slightly visible, pops on hover) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(f.id);
                          }}
                          aria-label={`Remove ${f.file.name}`}
                          className={cn(
                            "absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-white shadow-md transition-all duration-200",
                            "opacity-70 hover:bg-chili-500 hover:opacity-100 focus:opacity-100",
                            "dark:bg-slate-700 dark:hover:bg-chili-500"
                          )}
                        >
                          <IconX size={14} stroke={2.5} />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea */}
              <textarea
                ref={taRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  onChange?.(e.target.value);
                }}
                onKeyDown={handleKey}
                placeholder={placeholder}
                aria-label="Chat input"
                className="w-full resize-none bg-transparent px-3 py-1 text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground md:text-base"
                style={{ minHeight: "80px", maxHeight }}
              />
            </div>
          </div>

          {/* Toolbar Container */}
          <div className="relative z-20 flex flex-wrap items-center gap-1 mt-auto w-full px-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-black/5 hover:text-foreground dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-foreground"
              >
                <IconPaperclip size={18} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach images"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-black/5 hover:text-foreground dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-foreground"
              >
                <IconPhoto size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!hideModel && (
                <ModelSelector
                  value={model}
                  onChange={(m) => {
                    setModel(m);
                    onModelChange?.(m);
                  }}
                />
              )}

              <motion.button
                type="button"
                onClick={submit}
                disabled={!value.trim() && files.length === 0}
                aria-label="Send message"
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full transition-all ml-1 shrink-0",
                  "bg-chili-500 text-white shadow-[0_2px_8px_-2px_rgba(205,28,24,0.4)]",
                  "hover:bg-chili-600 hover:shadow-[0_4px_12px_-2px_rgba(205,28,24,0.6)]",
                  "disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
                  "dark:disabled:bg-white/10 dark:disabled:text-white/30"
                )}
                style={{ willChange: "transform" }}
              >
                <IconArrowUp size={16} stroke={2.5} />
              </motion.button>
            </div>
          </div>

          {/* Drop overlay */}
          <AnimatePresence>
            {dragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-[28px] bg-white/40 backdrop-blur-[2px] dark:bg-[#121212]/60"
                style={{ willChange: "opacity" }}
              >
                <div className="flex items-center gap-2 rounded-full border border-chili-500/20 bg-white px-5 py-2.5 text-sm font-semibold text-chili-600 shadow-xl dark:border-chili-500/30 dark:bg-[#1a1a1a] dark:text-chili-500">
                  <IconPaperclip size={16} />
                  Drop files here
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Model selector ───────────────────────── */

const MODELS: ReadonlyArray<{
  id: LiquidModel;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    id: "fast",
    label: "Fast",
    blurb: "Snappiest replies. Great for quick edits",
    icon: IconRocket,
  },
  {
    id: "thinking",
    label: "Thinking",
    blurb: "Step-by-step reasoning for tougher prompts",
    icon: IconBulb,
  },
  {
    id: "pro",
    label: "Pro",
    blurb: "Top quality with multimodal + tools",
    icon: IconSparkles,
  },
];

type ModelMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
};

function ModelSelector({
  value,
  onChange,
}: {
  value: LiquidModel;
  onChange: (m: LiquidModel) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hoverId, setHoverId] = React.useState<LiquidModel | null>(null);
  const [menuPosition, setMenuPosition] =
    React.useState<ModelMenuPosition | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];
  const CurrentIcon = current.icon;

  const updateMenuPosition = React.useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const menuWidth = Math.min(280, window.innerWidth - viewportPadding * 2);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - 10;
    const maxHeight = Math.max(132, spaceBelow);

    const left =
      scrollX +
      Math.max(
        viewportPadding,
        Math.min(
          rect.right - menuWidth,
          window.innerWidth - menuWidth - viewportPadding
        )
      );
    const top = scrollY + rect.bottom + 10;

    setMenuPosition({
      top,
      left,
      width: menuWidth,
      maxHeight,
      placement: "bottom",
    });
  }, []);

  React.useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      setHoverId(null);
      return;
    }

    updateMenuPosition();

    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
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

  React.useLayoutEffect(() => {
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
                y: menuPosition.placement === "bottom" ? -8 : 8,
                scale: 0.92,
                filter: "blur(8px)",
              }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                y: menuPosition.placement === "bottom" ? -8 : 8,
                scale: 0.96,
                filter: "blur(6px)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "absolute isolate z-[140] overflow-hidden rounded-2xl border border-black/[0.08] p-1.5",
                "bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffffff_0%,#f4f4f5_72%)]",
                "shadow-[0_1px_2px_rgba(0,0,0,.06),0_24px_60px_-18px_rgba(0,0,0,.22)]",
                "dark:border-white/[0.06] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#15151b_0%,#0a0a0b_72%)]",
                "dark:shadow-[0_1px_2px_rgba(0,0,0,.4),0_24px_60px_-16px_rgba(0,0,0,.72)]"
              )}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                transformOrigin: "top right",
                willChange: "transform, opacity, filter",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.055]"
                style={{
                  backgroundImage: LIQUID_MATTE_NOISE,
                  backgroundSize: "240px 240px",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.035)_0%,transparent_30%,transparent_72%,rgba(0,0,0,0.055)_100%)] dark:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,transparent_28%,transparent_72%,rgba(0,0,0,0.22)_100%)]"
              />
              <LayoutGroup id="liquid-model-menu">
                <div
                  className="relative z-10 max-h-[inherit] overflow-y-auto overscroll-contain"
                  onMouseLeave={() => setHoverId(null)}
                >
                  {MODELS.map((m) => {
                    const Icon = m.icon;
                    const selected = m.id === value;
                    const highlighted = hoverId === m.id || (!hoverId && selected);
                    return (
                      <button
                        key={m.id}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setHoverId(m.id)}
                        onFocus={() => setHoverId(m.id)}
                        onClick={() => {
                          onChange(m.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "group/opt relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none",
                          "transition-colors",
                          highlighted
                            ? "text-[var(--foreground)]"
                            : "text-[var(--foreground)]/85"
                        )}
                      >
                        {highlighted && (
                          <motion.span
                            layoutId="liquid-model-menu-highlight"
                            className="absolute inset-0 rounded-xl bg-[var(--surface-muted)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 32,
                              mass: 0.6,
                            }}
                            style={{ willChange: "transform" }}
                            aria-hidden
                          />
                        )}

                        <span
                          className={cn(
                            "relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                            selected
                              ? "bg-white text-[var(--foreground)] dark:bg-white/[0.08]"
                              : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
                            highlighted && "bg-white dark:bg-white/[0.08]"
                          )}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="relative z-10 min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold leading-tight tracking-tight">
                              {m.label}
                            </span>
                            <AnimatePresence>
                              {selected && (
                                <motion.span
                                  key="check"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 28,
                                  }}
                                  className="text-[var(--foreground)]"
                                  style={{ willChange: "transform" }}
                                >
                                  <IconCheck size={13} stroke={3} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--muted-foreground)]">
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
        aria-label={`Model: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-all duration-200",
          "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-black/5",
          "dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10",
          open && "bg-black/5 text-slate-900 dark:bg-white/10 dark:text-white"
        )}
      >
        <span className="text-inherit">
          <CurrentIcon size={16} />
        </span>
        <span>{current.label}</span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex text-inherit opacity-70"
          style={{ willChange: "transform" }}
        >
          <IconChevronDown size={14} />
        </motion.span>
      </button>
      {menu}
    </div>
  );
}
