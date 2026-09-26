import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ArrowRight, ArrowUp, Check, GripVertical, PenLine } from "lucide-react";
import { motion } from "framer-motion";
import type { InteractiveQuestion } from "@/components/ai/types";
import { cn } from "@/lib/utils";

interface InteractivePromptDialogProps {
  questions: InteractiveQuestion[];
  title?: string;
  onSubmit: (formattedResponse: string) => void;
  onDismiss: () => void;
}

export const InteractivePromptDialog = ({
  questions,
  title,
  onSubmit,
  onDismiss,
}: InteractivePromptDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Store answers keyed by question index or id
  // For single_select: string
  // For multi_select: string[]
  // For rank_priority: string[] (ordered options)
  const [answers, setAnswers] = useState<Record<number, any>>(() => {
    const initial: Record<number, any> = {};
    questions.forEach((q, idx) => {
      const type = q.type || "single_select";
      if (type === "rank_priority") {
        initial[idx] = [...q.options];
      } else if (type === "multi_select") {
        initial[idx] = [];
      } else {
        initial[idx] = "";
      }
    });
    return initial;
  });

  // Track "Something else" custom inputs
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [isEditingCustom, setIsEditingCustom] = useState<Record<number, boolean>>({});

  const currentQ = questions[currentIndex] || questions[0];
  const currentType = currentQ?.type || "single_select";
  const total = questions.length;

  const currentAnswer = answers[currentIndex];
  const customText = customInputs[currentIndex] || "";
  const editingCustom = isEditingCustom[currentIndex] || false;

  // Single select handler
  const handleSingleSelect = (option: string) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: option }));
    setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: false }));
    // Picking an option replaces any write-in, otherwise the write-in wins on submit
    setCustomInputs((prev) => ({ ...prev, [currentIndex]: "" }));

    // Auto-advance if not last question
    if (currentIndex < total - 1) {
      setTimeout(() => setCurrentIndex((c) => c + 1), 180);
    }
  };

  // Multi select handler
  const handleMultiToggle = (option: string) => {
    const prevList: string[] = Array.isArray(answers[currentIndex]) ? answers[currentIndex] : [];
    const exists = prevList.includes(option);
    const nextList = exists ? prevList.filter((item) => item !== option) : [...prevList, option];
    setAnswers((prev) => ({ ...prev, [currentIndex]: nextList }));
  };

  // Rank priority handlers (desktop drag + mobile touch)
  const [activeDragIdx, setActiveDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleMoveRank = (fromIdx: number, toIdx: number) => {
    const currentList: string[] = Array.isArray(answers[currentIndex]) ? [...answers[currentIndex]] : [...(currentQ.options || [])];
    if (toIdx < 0 || toIdx >= currentList.length) return;
    const [moved] = currentList.splice(fromIdx, 1);
    currentList.splice(toIdx, 0, moved);
    setAnswers((prev) => ({ ...prev, [currentIndex]: currentList }));
  };

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const resetDrag = () => {
    dragItem.current = null;
    dragOverItem.current = null;
    setActiveDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
    setActiveDragIdx(idx);
    dragOverItem.current = idx;
    setDragOverIdx(idx);
  };

  const handleDragEnter = (idx: number) => {
    dragOverItem.current = idx;
    setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      handleMoveRank(dragItem.current, dragOverItem.current);
    }
    resetDrag();
  };

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    e.preventDefault();
    dragItem.current = idx;
    setActiveDragIdx(idx);
    dragOverItem.current = idx;
    setDragOverIdx(idx);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || dragItem.current === null) return;
    e.preventDefault();
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = targetElement?.closest<HTMLElement>("[data-rank-idx]");
    if (row) {
      const idx = parseInt(row.getAttribute("data-rank-idx") || "-1", 10);
      if (idx >= 0 && idx !== dragOverItem.current) {
        dragOverItem.current = idx;
        setDragOverIdx(idx);
      }
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Check if current question has a valid selection or write-in
  const isCurrentQuestionAnswered = (() => {
    if (currentType === "single_select") {
      return Boolean(currentAnswer || customText.trim());
    }
    if (currentType === "multi_select") {
      return (Array.isArray(currentAnswer) && currentAnswer.length > 0) || Boolean(customText.trim());
    }
    if (currentType === "rank_priority") {
      return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    }
    return false;
  })();

  // Final submission builder
  const handleFinalSubmit = () => {
    const formatted = questions
      .map((q, idx) => {
        const type = q.type || "single_select";
        const ans = answers[idx];
        const custom = customInputs[idx]?.trim();

        if (type === "single_select") {
          const chosen = custom || ans || "Skipped";
          return `${idx + 1}. ${q.question}\nSelected: ${chosen}`;
        } else if (type === "multi_select") {
          const items = Array.isArray(ans) ? [...ans] : [];
          if (custom) items.push(`Custom: ${custom}`);
          const resText = items.length > 0 ? items.join(", ") : "None";
          return `${idx + 1}. ${q.question}\nSelected: ${resText}`;
        } else if (type === "rank_priority") {
          const ranked: string[] = Array.isArray(ans) && ans.length > 0 ? ans : q.options;
          const rankingLines = ranked.map((item, rIdx) => `  ${rIdx + 1}. ${item}`).join("\n");
          return `${idx + 1}. ${q.question}\nRanking:\n${rankingLines}`;
        }
        return `${idx + 1}. ${q.question}\nAnswer: ${ans || "Skipped"}`;
      })
      .join("\n\n");

    onSubmit(formatted);
  };

  const handleNextOrSubmit = () => {
    if (!isCurrentQuestionAnswered) return;
    if (currentIndex < total - 1) {
      setCurrentIndex((c) => c + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleSkipQuestion = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((c) => c + 1);
    } else {
      handleFinalSubmit();
    }
  };

  // Keyboard navigation (Ctrl+Enter to submit, Esc to dismiss)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isCurrentQuestionAnswered) {
          handleFinalSubmit();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answers, customInputs, isCurrentQuestionAnswered]);

  if (!currentQ) return null;

  const selectedCount = Array.isArray(currentAnswer) ? currentAnswer.length : 0;
  const isLastQuestion = currentIndex === total - 1;

  const currentOptions: string[] =
    currentType === "rank_priority" && Array.isArray(currentAnswer) && currentAnswer.length > 0
      ? currentAnswer
      : currentQ.options || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-full bg-[#1b1b1e]/98 dark:bg-[#18181b]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden mb-2 sm:mb-3 select-none"
    >
      {/* ── Dialog Header (Two-row layout) ── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.08] bg-white/[0.02] flex flex-col gap-1.5">
        {/* Row 1: Deck title on the left, Pager & Close button on the right */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-zinc-400 truncate tracking-wide">
            {title || "Question"}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {total > 1 && (
              <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium bg-white/[0.05] py-0.5 px-2 rounded-lg border border-white/5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
                  className="hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 cursor-pointer p-0.5 transition-colors touch-manipulation"
                  title="Previous question"
                  aria-label="Previous question"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-1 text-[11px] text-zinc-300 whitespace-nowrap">
                  {currentIndex + 1}
                  <span className="hidden sm:inline"> of </span>
                  <span className="sm:hidden">/</span>
                  {total}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === total - 1}
                  onClick={() => setCurrentIndex((c) => Math.min(total - 1, c + 1))}
                  className="hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 cursor-pointer p-0.5 transition-colors touch-manipulation"
                  title="Next question"
                  aria-label="Next question"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] active:bg-white/15 transition-colors cursor-pointer touch-manipulation"
              title="Close dialog"
              aria-label="Close dialog"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Row 2: The question prompt at normal size, allowed to wrap fully */}
        <div className="text-sm sm:text-[15px] font-medium text-zinc-100 leading-snug whitespace-normal break-words">
          {currentQ.question}
        </div>
      </div>

      {/* ── Options Content Area ── */}
      <div className="divide-y divide-white/[0.06] max-h-[46vh] sm:max-h-[360px] overflow-y-auto custom-scrollbar overscroll-contain">
        {/* 1. SINGLE SELECT */}
        {currentType === "single_select" && (
          <>
            {currentOptions.map((opt, i) => {
              const isSelected = currentAnswer === opt && !editingCustom;
              return (
                <button
                  key={`single-${opt}-${i}`}
                  type="button"
                  onClick={() => handleSingleSelect(opt)}
                  className={`w-full text-left px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 transition-colors cursor-pointer group active:bg-white/[0.08] touch-manipulation ${
                    isSelected ? "bg-white/[0.07] text-white" : "hover:bg-white/[0.04] text-zinc-200"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-violet-600 text-white shadow-sm"
                        : "bg-white/[0.06] text-zinc-400 group-hover:bg-white/[0.1] group-hover:text-zinc-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium flex-1 leading-snug">{opt}</span>
                </button>
              );
            })}

            {/* "Something else" Option */}
            <div
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 transition-colors ${
                editingCustom ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: true }))}
                className="w-6 h-6 rounded-md bg-white/[0.06] text-zinc-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer touch-manipulation"
                title="Type custom answer"
              >
                <PenLine size={13} />
              </button>
              <input
                type="text"
                placeholder="Something else..."
                value={customText}
                onFocus={() => setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: true }))}
                onChange={(e) => {
                  setCustomInputs((prev) => ({ ...prev, [currentIndex]: e.target.value }));
                  setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: true }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customText.trim()) {
                    handleNextOrSubmit();
                  }
                }}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none py-1 touch-manipulation"
              />
            </div>
          </>
        )}

        {/* 2. MULTI SELECT (Checkboxes) */}
        {currentType === "multi_select" && (
          <>
            {currentOptions.map((opt, i) => {
              const isChecked = Array.isArray(currentAnswer) && currentAnswer.includes(opt);
              return (
                <div
                  key={`multi-${opt}-${i}`}
                  onClick={() => handleMultiToggle(opt)}
                  className={`px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 transition-colors cursor-pointer group active:bg-white/[0.08] touch-manipulation ${
                    isChecked ? "bg-white/[0.06] text-white" : "hover:bg-white/[0.04] text-zinc-200"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? "bg-violet-600 border-violet-500 text-white shadow-sm"
                        : "border-white/20 bg-transparent group-hover:border-white/40"
                    }`}
                  >
                    {isChecked && <Check size={13} strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium flex-1 leading-snug">{opt}</span>
                </div>
              );
            })}

            {/* "Something else" Option for Multi Select (label: clicking the box focuses the input) */}
            <label className="px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 hover:bg-white/[0.03] transition-colors cursor-text">
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  customText.trim()
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "border-white/20 bg-transparent"
                }`}
              >
                {customText.trim() && <Check size={13} strokeWidth={3} />}
              </div>
              <input
                type="text"
                placeholder="Something else..."
                value={customText}
                onChange={(e) => {
                  setCustomInputs((prev) => ({ ...prev, [currentIndex]: e.target.value }));
                }}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none py-1 touch-manipulation"
              />
            </label>
          </>
        )}

        {/* 3. RANK PRIORITIES (Flat strips, drag to reorder from anywhere on a row) */}
        {currentType === "rank_priority" && (
          <>
            {currentOptions.map((opt, i) => {
              const isBeingDragged = activeDragIdx === i;
              const isDropTarget = dragOverIdx === i && activeDragIdx !== null && activeDragIdx !== i;

              return (
                <div
                  key={`rank-${opt}-${i}`}
                  data-rank-idx={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={(e) => handleTouchStart(i, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={resetDrag}
                  className={cn(
                    "w-full px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 transition-colors min-h-[44px] sm:min-h-[48px] select-none group cursor-grab active:cursor-grabbing touch-none",
                    isBeingDragged
                      ? "bg-white/[0.08] opacity-60"
                      : isDropTarget
                      ? "bg-violet-600/15 text-white shadow-[inset_2px_0_0_0_#8b5cf6]"
                      : "hover:bg-white/[0.04] text-zinc-200"
                  )}
                >
                  {/* Number badge on left */}
                  <span className="w-6 h-6 rounded-md bg-white/[0.06] text-zinc-400 group-hover:bg-white/[0.1] text-xs font-semibold flex items-center justify-center shrink-0 transition-colors">
                    {i + 1}
                  </span>

                  {/* Option text */}
                  <span className="text-sm font-medium text-zinc-200 flex-1 min-w-0 leading-snug break-words">
                    {opt}
                  </span>

                  {/* Grip handle: visual hint; the entire row is touch-draggable */}
                  <div
                    className="p-2 -mr-1.5 text-zinc-400 group-hover:text-zinc-200 active:text-white flex items-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical size={16} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Dialog Footer ── */}
      <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-black/30 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <div className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">
          {currentType === "multi_select" && <span>{selectedCount} selected</span>}
          {currentType === "rank_priority" && (
            <span>Drag to re-order your priorities</span>
          )}
          {currentType === "single_select" && (
            <span>Pick an option or write your own</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSkipQuestion}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.08] active:bg-white/15 transition-colors cursor-pointer touch-manipulation"
          >
            Skip
          </button>

          {/* Next / Submit Button (same style for every question type) */}
          {(currentType !== "single_select" || isLastQuestion) && (
            <button
              type="button"
              disabled={!isCurrentQuestionAnswered}
              onClick={handleNextOrSubmit}
              className={cn(
                "min-w-[84px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all shadow-sm touch-manipulation",
                !isCurrentQuestionAnswered
                  ? "bg-white/10 text-white/30 cursor-not-allowed border-white/5 opacity-50"
                  : "bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white border-transparent cursor-pointer active:scale-95"
              )}
            >
              <span>{isLastQuestion ? "Submit" : "Next"}</span>
              {isLastQuestion ? (
                <ArrowUp size={13} strokeWidth={2.5} />
              ) : (
                <ArrowRight size={13} strokeWidth={2.5} />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
