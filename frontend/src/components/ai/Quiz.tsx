import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, X } from "lucide-react";

interface MCQQuestion {
  id: string | number;
  question: string;
  options: string[];
}

interface QuizProps {
  questions: MCQQuestion[];
  onComplete: (answers: Record<string, string>) => void;
  onDismiss?: () => void;
}

export default function Quiz({ questions, onComplete, onDismiss }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);

  // Safety check in case questions array is empty or undefined
  if (!questions || questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestion?.id] || null;

  const handleSelect = (val: string) => {
    if (isFinished) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setIsFinished(true);
      onComplete(answers);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <Card className="w-full max-w-[420px] mx-auto bg-[#18181b] border-white/10 shadow-2xl transition-all duration-300 my-1 rounded-xl py-3 gap-2">
      <CardHeader className="space-y-1 px-4 py-0">
        <div className="flex justify-between items-center">
          <CardDescription className="text-[11px] font-bold tracking-widest uppercase text-violet-400">
            {isFinished ? "Quiz Submitted" : `Question ${currentIndex + 1}/${questions.length}`}
          </CardDescription>
          {onDismiss && !isFinished && (
            <button 
              onClick={onDismiss}
              className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-full hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <CardTitle className="text-[15px] font-medium leading-relaxed text-zinc-100">
          {currentQuestion.question}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 py-0">
        <RadioGroup 
          value={currentAnswer || ""} 
          onValueChange={handleSelect}
          disabled={isFinished}
          className="space-y-1.5"
        >
          {currentQuestion.options.map((option, index) => {
            const isCurrentOption = currentAnswer === index.toString();
            
            // Dynamic styling
            let optionStyles = "flex items-center justify-between space-x-3 rounded-lg border py-1.5 px-3 cursor-pointer transition-all duration-200 ";
            
            if (isFinished) {
              if (isCurrentOption) {
                optionStyles += "border-violet-500/50 bg-violet-500/10 opacity-100";
              } else {
                optionStyles += "border-white/5 opacity-40 cursor-not-allowed";
              }
            } else if (isCurrentOption) {
              optionStyles += "border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20";
            } else {
              optionStyles += "border-white/5 bg-white/[0.02] hover:bg-white/5";
            }

            return (
              <div key={index} className={optionStyles}>
                <div className="flex items-center space-x-3 w-full cursor-pointer">
                  <RadioGroupItem 
                    value={index.toString()} 
                    id={`opt-${index}`} 
                    className="sr-only"
                  />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[11px] font-bold text-white/40">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <Label htmlFor={`opt-${index}`} className="font-normal text-zinc-200 text-[14px] cursor-pointer w-full py-1 leading-snug">
                    {option}
                  </Label>
                </div>
                {isFinished && isCurrentOption && <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" />}
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>

      <CardFooter className="flex justify-end px-4 py-1 mt-1 border-t border-white/5 pt-3">
        {!isFinished && (
          <Button 
            onClick={handleNext} 
            disabled={currentAnswer === null}
            className="h-9 px-5 text-[13px] font-medium bg-white text-zinc-950 font-semibold hover:bg-zinc-200 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-md transition-colors border-0 shadow-none flex items-center gap-1.5"
          >
            <span>{isLastQuestion ? "Submit" : "Next"}</span>
            {!isLastQuestion && <ArrowRight className="h-4 w-4" />}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
