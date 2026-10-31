import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  Sparkles,
  Network,
  Cpu,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { CURRENT_VERSION } from "@/hooks/user/useWhatsNew";
import demoNotesGif from "@/assets/update/demo-notes-generation.gif";
import demoSummarizationGif from "@/assets/update/demo-summarization.gif";

interface WhatsNewModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Inline Slash AI (/)",
    desc: "Generate, outline, and summarize directly at cursor without leaving your keyboard.",
  },
  {
    icon: Zap,
    title: "60 FPS Streaming Engine",
    desc: "Velocity-timed reveal buffer completely eliminates token stutter and dropped frames.",
  },
  {
    icon: Network,
    title: "Live Mermaid Diagrams",
    desc: "Safe mid-stream interception with auto-repairing syntax sanitizer.",
  },
  {
    icon: Cpu,
    title: "Fast KV Prompt Caching",
    desc: "Ephemeral system prompt caching cuts latency on repeated actions.",
  },
];

const SLIDES = [
  {
    id: "generation",
    badge: "Redesigned Interaction",
    title: "Keyboard-First Inline Commands (/)",
    description:
      "We replaced clunky button menus with an intuitive, command-based workflow. Type '/' anywhere inside your note to brainstorm, generate structured notes, or build tables directly at your cursor.",
    gif: demoNotesGif,
    alt: "Instant AI Note Generation Showcase",
    pills: [
      "Inline Slash (/) Palette",
      "In-Document Ghost Preview",
      "Instant Accept / Discard (↵ / Esc)",
      "Zero Modal Disruption",
    ],
    showFeatureGrid: false,
  },
  {
    id: "summarization",
    badge: "Document Intelligence",
    title: "Frictionless AI Summarization",
    description:
      "Summaries and deep analysis now execute seamlessly inline. Instead of navigating separate modals or tabs, trigger instant summaries, key takeaways, and action items with one click or command.",
    gif: demoSummarizationGif,
    alt: "Note Summarization Showcase",
    showFeatureGrid: true,
  },
];

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onDismiss }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  // Reset to first slide when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setDirection(0);
    }
  }, [isOpen]);

  const goToSlide = (newIndex: number) => {
    setDirection(newIndex > currentSlide ? 1 : -1);
    setCurrentSlide(newIndex);
  };

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  };

  // Keyboard navigation: Escape to close, Left/Right arrow keys for slides
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentSlide < SLIDES.length - 1) {
          goToSlide(currentSlide + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentSlide > 0) {
          goToSlide(currentSlide - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentSlide, onDismiss]);

  const openChangelog = () => {
    window.open(
      "https://github.com/badalsahani20/notesify/releases",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const slide = SLIDES[currentSlide];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            key="wn-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            key="wn-card"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 shadow-[0_24px_70px_rgba(0,0,0,0.7),0_1px_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onDismiss}
              className="absolute top-3.5 right-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-zinc-400 hover:text-white hover:bg-black/75 transition-colors border border-white/10 cursor-pointer backdrop-blur-sm"
              aria-label="Close dialog"
            >
              <X size={15} />
            </button>

            {/* Top Media Showcase Container */}
            <div className="relative w-full bg-black/60 border-b border-white/[0.08] overflow-hidden group">
              {/* Media badge */}
              <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2 rounded-full bg-black/60 border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span>{slide.badge}</span>
              </div>

              {/* The GIF Preview with Slide Transition */}
              <div className="w-full flex items-center justify-center h-[210px] sm:h-[245px] bg-zinc-950/90 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.img
                    key={slide.gif}
                    src={slide.gif}
                    alt={slide.alt}
                    custom={direction}
                    initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full object-contain"
                    loading={currentSlide === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </AnimatePresence>
              </div>

              {/* Subtle bottom gradient to blend media into content */}
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-900/90 to-transparent pointer-events-none" />
            </div>

            {/* Content Body with Animated Transitions */}
            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={slide.id}
                  custom={direction}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {/* Release Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-white/[0.06] text-white/90 border border-white/[0.08]">
                      v{CURRENT_VERSION}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      Feature {currentSlide + 1} of {SLIDES.length}
                    </span>
                  </div>

                  <h2
                    id="whats-new-title"
                    className="text-xl sm:text-2xl font-bold tracking-tight text-white"
                  >
                    {slide.title}
                  </h2>

                  <p className="mt-2 text-xs sm:text-[13px] text-zinc-400 leading-relaxed">
                    {slide.description}
                  </p>

                  {/* Slide 1 Highlights: Key Capabilities */}
                  {slide.pills && (
                    <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-2 flex-wrap">
                      {slide.pills.map((pill) => (
                        <span
                          key={pill}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-zinc-300 border border-white/[0.06]"
                        >
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span>{pill}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Slide 2 Highlights: 4-Feature Architecture Grid */}
                  {slide.showFeatureGrid && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                        Platform Architecture Highlights
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {HIGHLIGHTS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.title}
                              className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 mt-0.5">
                                <Icon size={13} className="stroke-[2.2]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-semibold text-white tracking-tight">
                                  {item.title}
                                </h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Footer Controls & Navigation */}
              <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
                {/* Left side: Navigation Dots & Back or Changelog */}
                <div className="flex items-center gap-3">
                  {currentSlide > 0 ? (
                    <button
                      type="button"
                      onClick={prevSlide}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={13} />
                      <span>Back</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openChangelog}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <span>Release Notes</span>
                      <ExternalLink size={12} className="opacity-70" />
                    </button>
                  )}

                  {/* Dot Indicators */}
                  <div className="flex items-center gap-1.5">
                    {SLIDES.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goToSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                          currentSlide === idx
                            ? "w-5 bg-white"
                            : "w-1.5 bg-white/20 hover:bg-white/40"
                        }`}
                        aria-label={`Go to feature slide ${idx + 1}`}
                      />
                    ))}
                    <span className="text-[11px] font-mono text-zinc-500 ml-1">
                      {currentSlide + 1}/{SLIDES.length}
                    </span>
                  </div>
                </div>

                {/* Right side: Next Slide or Try It Now Primary */}
                <div className="flex items-center gap-2">
                  {currentSlide < SLIDES.length - 1 ? (
                    <button
                      type="button"
                      onClick={nextSlide}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-zinc-950 bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                    >
                      <span>Next: Summarization</span>
                      <ArrowRight size={14} className="stroke-[2.5]" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openChangelog}
                        className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <span>Changelog</span>
                        <ExternalLink size={12} className="opacity-70" />
                      </button>
                      <button
                        id="whats-new-continue"
                        type="button"
                        onClick={onDismiss}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-zinc-950 bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                      >
                        <span>Try it now</span>
                        <ArrowRight size={14} className="stroke-[2.5]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WhatsNewModal;
