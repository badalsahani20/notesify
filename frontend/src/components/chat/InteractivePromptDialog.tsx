import { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ArrowRight, 
  Check, 
  GripVertical, 
  PenLine, 
  HelpCircle,
  Trophy,
  RotateCcw,
  Send,
  BrainCircuit,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { InteractiveQuestion } from "@/components/ai/types";
import { cn } from "@/lib/utils";

interface InteractivePromptDialogProps {
  questions: InteractiveQuestion[];
  purpose?: "quiz" | "clarification" | "preference" | "ranking" | string;
  onSubmit: (formattedResponse: string) => void;
  onDismiss: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const InteractivePromptDialog = ({
  questions,
  purpose,
  onSubmit,
  onDismiss,
}: InteractivePromptDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Reset minimized state when question set changes
  useEffect(() => {
    setIsMinimized(false);
  }, [questions]);

  // Explicit quiz mode vs general preference / topic / clarification choice
  const isQuiz = purpose === "quiz";

  // Store answers keyed by question index
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

  // Final submission builder
  const buildFormattedResponse = (overrideAnswers?: Record<number, any>, overrideCustom?: Record<number, string>) => {
    const activeAnswers = overrideAnswers ?? answers;
    const activeCustom = overrideCustom ?? customInputs;

    const formatted = questions
      .map((q, idx) => {
        const type = q.type || "single_select";
        const ans = activeAnswers[idx];
        const custom = activeCustom[idx]?.trim();

        if (type === "single_select") {
          const chosen = custom || ans || "Skipped";
          return total === 1 ? `Selected: ${chosen}` : `${idx + 1}. ${q.question}\nSelected: ${chosen}`;
        } else if (type === "multi_select") {
          const items = Array.isArray(ans) ? [...ans] : [];
          if (custom) items.push(`Custom: ${custom}`);
          const resText = items.length > 0 ? items.join(", ") : "None";
          return total === 1 ? `Selected: ${resText}` : `${idx + 1}. ${q.question}\nSelected: ${resText}`;
        } else if (type === "rank_priority") {
          const ranked: string[] = Array.isArray(ans) && ans.length > 0 ? ans : q.options;
          const rankingLines = ranked.map((item, rIdx) => `  ${rIdx + 1}. ${item}`).join("\n");
          return `${idx + 1}. ${q.question}\nRanking:\n${rankingLines}`;
        }
        return `${idx + 1}. ${q.question}\nAnswer: ${ans || "Skipped"}`;
      })
      .join("\n\n");

    if (isQuiz) {
      return `${formatted}\n\n[Please evaluate my answers, score them, explain any corrections, and recommend what to revise next.]`;
    }
    return formatted;
  };

  const handleFinalSubmit = () => {
    onSubmit(buildFormattedResponse());
  };

  // Single select handler: distinct selection with smooth auto-advance
  const handleSingleSelect = (option: string) => {
    const updatedAnswers = { ...answers, [currentIndex]: option };
    const updatedCustom = { ...customInputs, [currentIndex]: "" };

    setAnswers(updatedAnswers);
    setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: false }));
    setCustomInputs(updatedCustom);

    if (currentIndex < total - 1) {
      setTimeout(() => {
        setCurrentIndex((c) => c + 1);
      }, 220);
    } else {
      // Last question: if it's a quiz, show the review completion screen.
      // If it's a preference / topic question, immediately submit to Iris without quiz clutter!
      if (isQuiz) {
        setTimeout(() => {
          setShowCompletionScreen(true);
        }, 260);
      } else {
        setTimeout(() => {
          onSubmit(buildFormattedResponse(updatedAnswers, updatedCustom));
        }, 220);
      }
    }
  };

  // Multi select handler
  const handleMultiToggle = (option: string) => {
    const prevList: string[] = Array.isArray(answers[currentIndex]) ? answers[currentIndex] : [];
    const exists = prevList.includes(option);
    const nextList = exists ? prevList.filter((item) => item !== option) : [...prevList, option];
    setAnswers((prev) => ({ ...prev, [currentIndex]: nextList }));
  };

  // Rank priority handlers
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

  const answeredCount = questions.filter((q, idx) => {
    const type = q.type || "single_select";
    const ans = answers[idx];
    const custom = customInputs[idx]?.trim();
    if (type === "single_select") return Boolean(ans || custom);
    if (type === "multi_select") return (Array.isArray(ans) && ans.length > 0) || Boolean(custom);
    if (type === "rank_priority") return Array.isArray(ans) && ans.length > 0;
    return false;
  }).length;

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((c) => c + 1);
    } else {
      if (isQuiz) {
        setShowCompletionScreen(true);
      } else {
        handleFinalSubmit();
      }
    }
  };

  const handleSkipQuestion = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((c) => c + 1);
    } else {
      if (isQuiz) {
        setShowCompletionScreen(true);
      } else {
        handleFinalSubmit();
      }
    }
  };

  // Keyboard navigation: Enter advances if answered, Esc dismisses
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      } else if (e.key === "Enter" && !e.shiftKey) {
        if (showCompletionScreen) {
          e.preventDefault();
          handleFinalSubmit();
        } else if (isCurrentQuestionAnswered && !editingCustom) {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answers, customInputs, isCurrentQuestionAnswered, showCompletionScreen, currentIndex, editingCustom, isQuiz]);

  if (!currentQ && !showCompletionScreen) return null;

  const isLastQuestion = currentIndex === total - 1;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);

  const currentOptions: string[] =
    currentType === "rank_priority" && Array.isArray(currentAnswer) && currentAnswer.length > 0
      ? currentAnswer
      : currentQ.options || [];

  const defaultBadgeTitle = isQuiz
    ? "Quiz"
    : purpose === "preference"
    ? "Preference"
    : purpose === "clarification"
    ? "Clarification"
    : "Topic Choice";

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        <motion.div
          key="minimized-prompt-dock"
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="w-full bg-[var(--window-bg)] border border-[var(--divider)] hover:border-[var(--text-strong)]/20 rounded-xl shadow-xs text-[var(--text-strong)] px-3.5 py-2 mb-2 sm:mb-2.5 flex items-center justify-between gap-3 cursor-pointer group transition-all select-none"
          onClick={() => setIsMinimized(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsMinimized(false);
            }
          }}
          title="Click to resume answering"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-[var(--surface-ghost)] border border-[var(--divider)] flex items-center justify-center text-[var(--muted-text)] shrink-0 transition-colors">
              {isQuiz ? <BrainCircuit size={13} className="text-[var(--accent-strong)]" /> : <HelpCircle size={13} className="text-[var(--accent-strong)]" />}
            </div>
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="font-medium text-xs text-[var(--text-strong)] truncate">
                {isQuiz ? "Quiz in Progress" : defaultBadgeTitle}
              </span>
              <span className="text-[11px] font-mono text-[var(--muted-text)] shrink-0">
                {showCompletionScreen ? "• Ready to submit" : `• Step ${currentIndex + 1} of ${total}`}
              </span>
              {answeredCount > 0 && !showCompletionScreen && (
                <span className="text-[10px] font-mono font-medium text-[var(--accent-strong)] bg-[var(--active-surface)] px-1.5 py-0.5 rounded border border-[var(--accent-strong)]/20 shrink-0 hidden sm:inline">
                  {answeredCount}/{total} answered
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--text-strong)] hover:opacity-90 active:scale-[0.98] text-[var(--window-bg)] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              title="Expand question panel"
            >
              <ChevronUp size={13} />
              <span>{showCompletionScreen ? "Review Answers" : "Resume"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
              title="Dismiss question"
              aria-label="Dismiss question"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="expanded-prompt-dialog"
          initial={{ opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="w-full bg-[var(--window-bg)] border border-[var(--divider)] rounded-xl shadow-lg text-[var(--text-strong)] overflow-hidden mb-2 sm:mb-3 select-none"
        >
          {/* ── 1. Top Slim Progress Bar (Only shown for quizzes or multi-question series) ── */}
          {(isQuiz || total > 1) && (
            <div className="w-full bg-[var(--divider)]/40 h-[2px] overflow-hidden">
              <motion.div
                className="h-full bg-[var(--accent-strong)]"
                initial={false}
                animate={{ width: showCompletionScreen ? "100%" : `${progressPct}%` }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {showCompletionScreen ? (
              /* ── 4. COMPLETION SCREEN (Only active for Quiz mode) ── */
              <motion.div
                key="completion-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="p-4 sm:p-5 flex flex-col gap-3.5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--divider)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--active-surface)] border border-[var(--accent-strong)]/20 flex items-center justify-center text-[var(--accent-strong)] shadow-2xs">
                      <Trophy size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-strong)] tracking-tight">Quiz Complete</h3>
                      <p className="text-xs text-[var(--muted-text)] font-mono">
                        {answeredCount} of {total} question{total > 1 ? "s" : ""} answered
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsMinimized(true)}
                      className="p-1.5 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
                      title="Minimize to read chat first"
                      aria-label="Minimize quiz dialog"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="p-1.5 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
                      title="Close"
                      aria-label="Close"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Answer Summary Card */}
                <div className="bg-[var(--surface-muted)]/30 border border-[var(--divider)] rounded-lg p-3 sm:p-3.5 max-h-[42vh] overflow-y-auto custom-scrollbar space-y-2">
                  <div className="text-[11px] font-mono font-medium tracking-wider text-[var(--muted-text)] uppercase">
                    Review Your Answers
                  </div>
                  <div className="space-y-2 divide-y divide-[var(--divider)]">
                    {questions.map((q, idx) => {
                      const ans = answers[idx];
                      const custom = customInputs[idx]?.trim();
                      let display = "Skipped";
                      if (custom) display = custom;
                      else if (Array.isArray(ans)) display = ans.length > 0 ? ans.join(", ") : "Skipped";
                      else if (ans) display = ans;

                      return (
                        <div key={`summary-q-${idx}`} className="pt-2 first:pt-0 flex flex-col gap-0.5">
                          <div className="text-xs font-medium text-[var(--text-strong)] line-clamp-1">
                            {idx + 1}. {q.question}
                          </div>
                          <div className="text-xs text-[var(--muted-text)] font-medium pl-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-strong)] shrink-0" />
                            <span className="line-clamp-1">{display}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs text-[var(--muted-text)] leading-relaxed">
                  Iris will evaluate your answers, summarize your score, explain missed concepts, and recommend what to revise next.
                </p>

                {/* Completion Screen Actions */}
                <div className="flex items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletionScreen(false);
                      setCurrentIndex(0);
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] border border-transparent hover:border-[var(--divider)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Change Answers</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--text-strong)] hover:opacity-90 active:scale-[0.98] text-[var(--window-bg)] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Submit to Iris</span>
                    <Send size={13} />
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ── ACTIVE PROMPT SCREEN ── */
              <motion.div
                key={`question-screen-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                {/* ── Header: Contextual (Quiz vs Preference/Topic Choice) ── */}
                <div className="px-4 sm:px-5 pt-3 pb-2.5 border-b border-[var(--divider)] bg-[var(--surface-muted)]/20 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-strong)] bg-[var(--surface-ghost)] px-2 py-0.5 rounded-md border border-[var(--divider)]">
                        {isQuiz ? (
                          <BrainCircuit size={11} className="shrink-0 text-[var(--accent-strong)]" />
                        ) : (
                          <HelpCircle size={11} className="shrink-0 text-[var(--accent-strong)]" />
                        )}
                        <span>{defaultBadgeTitle}</span>
                      </div>

                      {/* For single preference/choice questions, avoid verbose "Question 1 of 1" */}
                      {isQuiz ? (
                        <>
                          <span className="text-xs font-medium font-mono text-[var(--text-strong)]">
                            Question {currentIndex + 1} of {total}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--muted-text)] bg-[var(--surface-ghost)] px-2 py-0.5 rounded border border-[var(--divider)] hidden sm:inline">
                            {progressPct}% complete
                          </span>
                        </>
                      ) : total > 1 ? (
                        <span className="text-xs font-medium font-mono text-[var(--muted-text)]">
                          Step {currentIndex + 1} of {total}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Previous / Next buttons for multi-step series */}
                      {total > 1 && (
                        <div className="flex items-center gap-0.5 bg-[var(--surface-ghost)] p-0.5 rounded-md border border-[var(--divider)]">
                          <button
                            type="button"
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
                            className="p-1 rounded text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Previous"
                            aria-label="Previous"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={currentIndex === total - 1}
                            onClick={() => setCurrentIndex((c) => Math.min(total - 1, c + 1))}
                            className="p-1 rounded text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Next"
                            aria-label="Next"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
                        title="Minimize to read chat first"
                        aria-label="Minimize question panel"
                      >
                        <ChevronDown size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={onDismiss}
                        className="p-1.5 rounded-md text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
                        title="Dismiss"
                        aria-label="Dismiss"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Prompt Text */}
                  <div className="text-sm sm:text-[15px] font-medium text-[var(--text-strong)] leading-snug whitespace-normal break-words pt-0.5">
                    {currentQ.question}
                  </div>
                </div>

                {/* ── Options Content Area ── */}
                <div className="p-3 sm:p-4 space-y-2 max-h-[46vh] sm:max-h-[380px] overflow-y-auto custom-scrollbar overscroll-contain">
                  {/* 1. SINGLE SELECT */}
                  {currentType === "single_select" && (
                    <>
                      {currentOptions.map((opt, i) => {
                        const isSelected = currentAnswer === opt && !editingCustom;
                        const letter = OPTION_LETTERS[i] || String(i + 1);

                        return (
                          <button
                            key={`single-${opt}-${i}`}
                            type="button"
                            onClick={() => handleSingleSelect(opt)}
                            className={cn(
                              "w-full text-left p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer group touch-manipulation focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-strong)]",
                              isSelected
                                ? "bg-[var(--active-surface)] border-[var(--accent-strong)] text-[var(--text-strong)] shadow-2xs ring-1 ring-[var(--accent-strong)]/30"
                                : "bg-[var(--surface-muted)]/40 border-[var(--divider)] hover:bg-[var(--surface-ghost)]/60 hover:border-[var(--text-strong)]/20 text-[var(--text-strong)]"
                            )}
                          >
                            <span
                              className={cn(
                                "w-5 h-5 rounded text-[11px] font-mono font-medium flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-[var(--accent-strong)] text-white shadow-2xs"
                                  : "bg-[var(--surface-ghost)] text-[var(--muted-text)] group-hover:text-[var(--text-strong)]"
                              )}
                            >
                              {letter}
                            </span>

                            <span className="text-xs sm:text-sm font-normal flex-1 leading-snug">{opt}</span>

                            <div
                              className={cn(
                                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                                isSelected
                                  ? "border-[var(--accent-strong)] bg-[var(--accent-strong)]"
                                  : "border-[var(--divider)] bg-transparent group-hover:border-[var(--muted-text)]"
                              )}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-2xs" />}
                            </div>
                          </button>
                        );
                      })}

                      {/* "Something else" Option for Single Select */}
                      <div
                        className={cn(
                          "p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all focus-within:border-[var(--accent-strong)] focus-within:ring-1 focus-within:ring-[var(--accent-strong)]/30",
                          editingCustom
                            ? "bg-[var(--active-surface)] border-[var(--accent-strong)] text-[var(--text-strong)]"
                            : "bg-[var(--surface-muted)]/30 border-[var(--divider)] hover:border-[var(--text-strong)]/20 text-[var(--text-strong)]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setIsEditingCustom((prev) => ({ ...prev, [currentIndex]: true }))}
                          className="w-5 h-5 rounded bg-[var(--surface-ghost)] text-[var(--muted-text)] hover:text-[var(--text-strong)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                          title="Write custom answer"
                        >
                          <PenLine size={12} />
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
                              e.preventDefault();
                              handleNext();
                            }
                          }}
                          className="flex-1 bg-transparent text-xs sm:text-sm text-[var(--text-strong)] placeholder-[var(--muted-text)]/60 focus:outline-none py-0.5"
                        />
                      </div>
                    </>
                  )}

                  {/* 2. MULTI SELECT */}
                  {currentType === "multi_select" && (
                    <>
                      {currentOptions.map((opt, i) => {
                        const isChecked = Array.isArray(currentAnswer) && currentAnswer.includes(opt);
                        const letter = OPTION_LETTERS[i] || String(i + 1);

                        return (
                          <button
                            key={`multi-${opt}-${i}`}
                            type="button"
                            onClick={() => handleMultiToggle(opt)}
                            className={cn(
                              "w-full text-left p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer group touch-manipulation focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-strong)]",
                              isChecked
                                ? "bg-[var(--active-surface)] border-[var(--accent-strong)] text-[var(--text-strong)] shadow-2xs ring-1 ring-[var(--accent-strong)]/30"
                                : "bg-[var(--surface-muted)]/40 border-[var(--divider)] hover:bg-[var(--surface-ghost)]/60 hover:border-[var(--text-strong)]/20 text-[var(--text-strong)]"
                            )}
                          >
                            <span
                              className={cn(
                                "w-5 h-5 rounded text-[11px] font-mono font-medium flex items-center justify-center shrink-0 transition-colors",
                                isChecked
                                  ? "bg-[var(--accent-strong)] text-white shadow-2xs"
                                  : "bg-[var(--surface-ghost)] text-[var(--muted-text)] group-hover:text-[var(--text-strong)]"
                              )}
                            >
                              {letter}
                            </span>

                            <span className="text-xs sm:text-sm font-normal flex-1 leading-snug">{opt}</span>

                            <div
                              className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                                isChecked
                                  ? "bg-[var(--accent-strong)] border-[var(--accent-strong)] text-white shadow-2xs"
                                  : "border-[var(--divider)] bg-transparent group-hover:border-[var(--muted-text)]"
                              )}
                            >
                              {isChecked && <Check size={11} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}

                      {/* "Something else" Option for Multi Select */}
                      <div
                        className={cn(
                          "p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all focus-within:border-[var(--accent-strong)] focus-within:ring-1 focus-within:ring-[var(--accent-strong)]/30",
                          customText.trim()
                            ? "bg-[var(--active-surface)] border-[var(--accent-strong)] text-[var(--text-strong)]"
                            : "bg-[var(--surface-muted)]/30 border-[var(--divider)] hover:border-[var(--text-strong)]/20 text-[var(--text-strong)]"
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors",
                            customText.trim() ? "bg-[var(--accent-strong)] text-white" : "bg-[var(--surface-ghost)] text-[var(--muted-text)]"
                          )}
                        >
                          <PenLine size={12} />
                        </div>
                        <input
                          type="text"
                          placeholder="Something else..."
                          value={customText}
                          onChange={(e) => {
                            setCustomInputs((prev) => ({ ...prev, [currentIndex]: e.target.value }));
                          }}
                          className="flex-1 bg-transparent text-xs sm:text-sm text-[var(--text-strong)] placeholder-[var(--muted-text)]/60 focus:outline-none py-0.5"
                        />
                      </div>
                    </>
                  )}

                  {/* 3. RANK PRIORITY */}
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
                              "w-full p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all select-none group cursor-grab active:cursor-grabbing touch-none",
                              isBeingDragged
                                ? "bg-[var(--surface-ghost)] opacity-50 border-dashed border-[var(--accent-strong)]"
                                : isDropTarget
                                ? "bg-[var(--active-surface)] border-[var(--accent-strong)] text-[var(--text-strong)] shadow-[inset_2px_0_0_0_var(--accent-strong)]"
                                : "bg-[var(--surface-muted)]/40 border-[var(--divider)] hover:bg-[var(--surface-ghost)]/60 text-[var(--text-strong)]"
                            )}
                          >
                            <span className="w-5 h-5 rounded bg-[var(--surface-ghost)] text-[var(--muted-text)] group-hover:text-[var(--text-strong)] text-[11px] font-mono font-medium flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>

                            <span className="text-xs sm:text-sm font-medium text-[var(--text-strong)] flex-1 leading-snug">
                              {opt}
                            </span>

                            <div className="p-1 text-[var(--muted-text)] group-hover:text-[var(--text-strong)] flex items-center shrink-0">
                              <GripVertical size={15} />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 sm:px-5 py-2.5 bg-[var(--surface-muted)]/30 border-t border-[var(--divider)] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSkipQuestion}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] active:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    Skip
                  </button>

                  <button
                    type="button"
                    disabled={!isCurrentQuestionAnswered}
                    onClick={handleNext}
                    className={cn(
                      "min-w-[110px] px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-all cursor-pointer",
                      !isCurrentQuestionAnswered
                        ? "bg-[var(--surface-muted)] text-[var(--muted-text)]/40 border-[var(--divider)] cursor-not-allowed opacity-60"
                        : "bg-[var(--text-strong)] hover:opacity-90 active:scale-[0.98] text-[var(--window-bg)] border-transparent shadow-2xs"
                    )}
                  >
                    <span>
                      {isQuiz
                        ? isLastQuestion ? "Finish & Review" : "Next Question"
                        : isLastQuestion ? "Submit Choice" : "Next Step"}
                    </span>
                    {isLastQuestion && !isQuiz ? (
                      <Send size={12} />
                    ) : (
                      <ArrowRight size={13} strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
