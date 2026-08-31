import { useState } from "react";
import IrisAskBlock from "./IrisAskBlock";

interface InlineQuizManagerProps {
  questions: unknown;
  onComplete: (formattedAnswers: string) => void;
  isHistorical?: boolean;
}

type QuizQuestion = {
  question: string;
  options: string[];
};

const normalizeQuestions = (value: unknown): QuizQuestion[] => {
  let candidate = value;

  // Older persisted tool calls may store the payload as JSON text.
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }

  // Some tool-call shapes wrap the array under `questions` or `quizData`.
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const wrapped = candidate as { questions?: unknown; quizData?: unknown };
    candidate = wrapped.questions ?? wrapped.quizData;
  }

  if (!Array.isArray(candidate)) return [];

  return candidate.flatMap((item): QuizQuestion[] => {
    if (!item || typeof item !== "object") return [];
    const question = item as { question?: unknown; options?: unknown };
    if (typeof question.question !== "string" || !Array.isArray(question.options)) {
      return [];
    }

    const options = question.options.filter((option): option is string => typeof option === "string");
    return options.length > 0 ? [{ question: question.question, options }] : [];
  });
};

export const InlineQuizManager = ({ questions, onComplete, isHistorical = false }: InlineQuizManagerProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const normalizedQuestions = normalizeQuestions(questions);

  if (isHistorical || normalizedQuestions.length === 0) return null;

  // The first question that hasn't been answered yet
  const firstUnansweredIndex = normalizedQuestions.findIndex((_, i) => !answers[i.toString()]);
  
  // If all answered, activeIndex is -1.
  const activeIndex = firstUnansweredIndex === -1 ? -1 : firstUnansweredIndex;

  const handleAnswer = (index: number, ans: string) => {
    const newAnswers = { ...answers, [index.toString()]: ans };
    setAnswers(newAnswers);

    // If this was the last question, submit
    if (Object.keys(newAnswers).length === normalizedQuestions.length && !isSubmitted) {
      setIsSubmitted(true);
      const formattedAnswers = normalizedQuestions.map((q, i) => {
        const userAns = newAnswers[i.toString()];
        return `Question: ${q.question}\nOptions: ${q.options.join(", ")}\nUser's Answer: ${userAns}`;
      }).join("\n\n");
      onComplete(`[System: User submitted quiz]\n${formattedAnswers}\nPlease evaluate my answers.`);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {normalizedQuestions.map((q, index) => {
        const isAnswered = !!answers[index.toString()];
        const chosen = answers[index.toString()] ?? null;
        const isActive = index === activeIndex;
        const isPending = !isAnswered && !isActive;

        if (isPending) return null;

        return (
          <div key={index} className="iris-ask-container mb-2">
            <div className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mb-1.5 ml-1 opacity-70">
              Question {index + 1} of {normalizedQuestions.length}
            </div>
            <IrisAskBlock
              segment={{ kind: "ask", question: q.question, options: q.options }}
              answered={isAnswered}
              chosenAnswer={chosen}
              onAnswer={(ans) => handleAnswer(index, ans)}
            />
          </div>
        );
      })}
    </div>
  );
};
