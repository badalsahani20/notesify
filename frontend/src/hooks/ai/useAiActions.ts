import { useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import type { AiAction, AssistResult, SelectionRange } from "@/components/ai/types";
import { getSelection } from "@/utils/ai/aiContext";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { postAiAssistStream, postAiAssistBlocking } from "@/services/ai/aiAssistApi";

interface UseAiActionsOptions {
  editor: Editor | null;
  effectiveNoteId: string | null;
  plainNoteText: string;
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange>>;
}

export const useAiActions = ({
  editor,
  effectiveNoteId,
  plainNoteText,
  setSelectionRange,
}: UseAiActionsOptions) => {
  const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
  const [result, setResult] = useState<AssistResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopActionRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const runAction = async (action: AiAction, customPrompt?: string) => {
    const { text: selectedText, range } = getSelection(editor);
    const sourceText = customPrompt || selectedText || editor?.getText() || plainNoteText;

    if (!sourceText) {
      toast.error("No text found to process. Add content or select text first.");
      return;
    }

    abortControllerRef.current = new AbortController();
    const isDialogAction = ["summarize", "explain", "rewrite", "noteCreation"].includes(action);
    const targetRange = range || { from: editor?.state.selection.from || 0, to: editor?.state.selection.to || 0 };

    try {
      setLoadingAction(action);

      if (isDialogAction) {
        let response = await postAiAssistStream({
          noteId: effectiveNoteId,
          action,
          selectedText: customPrompt ? undefined : (selectedText || undefined),
          noteText: sourceText,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "AI action failed. Please try again.");
        }
        if (!response.body) throw new Error("No response body");

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream")) {
          const json = await response.json();
          const suggestion = json?.data?.suggestion ?? "";
          if (suggestion) {
            setSelectionRange(targetRange);
            setResult({
              action,
              suggestion,
              errors: json?.data?.errors ?? [],
              sourceType: selectedText ? "selection" : "note",
              isStreaming: false,
            });
          } else {
            toast.error("No suggestion returned.");
          }
        } else {
          let dialogOpened = false;
          await consumeAiChatStream(response.body, {
            throttleMs: 40,
            onUpdate: ({ fullText }) => {
              if (!fullText) return;
              if (!dialogOpened) {
                setSelectionRange(targetRange);
                dialogOpened = true;
              }
              setResult({
                action,
                suggestion: fullText,
                errors: [],
                sourceType: selectedText ? "selection" : "note",
                isStreaming: true,
              });
            },
          });
          setResult((prev) => (prev ? { ...prev, isStreaming: false } : prev));
        }
      } else {
        const json = await postAiAssistBlocking({
          noteId: effectiveNoteId,
          action,
          selectedText: selectedText || undefined,
          noteText: sourceText,
          signal: abortControllerRef.current.signal,
        });

        const data = json?.data ?? null;

        if (data?.suggestion) {
          setResult({ ...data, action });
          setSelectionRange(targetRange);

          const isInline = action === "grammar" || action === "continue";
          if (isInline && editor) {
            const isContinue = action === "continue";
            const insertPos = isContinue ? targetRange.to : targetRange.from;
            const chain = editor.chain().focus();
            if (!isContinue) chain.deleteRange(targetRange);
            chain
              .insertContentAt(insertPos, `<span data-ai-ghost="true">${data.suggestion}</span>`)
              .setTextSelection({ from: insertPos, to: insertPos + data.suggestion.length })
              .run();
          }
        } else {
          toast.error("No suggestion returned.");
        }
      }
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "CanceledError") {
        toast.message("Request cancelled.");
        return;
      }
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = (error instanceof Error ? error.message : null)
        || axiosError?.response?.data?.message
        || "AI action failed. Please try again.";
      const status = axiosError?.response?.status;

      if (status === 429) {
        toast.error("AI Credits Exhausted", {
          description: "You've reached today's limit for quick AI actions. Unlock higher limits with Premium.",
          duration: 5000,
        });
      } else {
        toast.error(message);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return {
    loadingAction,
    result,
    setResult,
    runAction,
    stopActionRequest,
  };
};
