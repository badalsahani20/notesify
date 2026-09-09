import { useState } from "react";
import type { Editor } from "@tiptap/react";
import type { AssistResult, SelectionRange } from "@/components/ai/types";
import { markdownToHtml } from "@/utils/markdownToHtml";

interface UseAiSuggestionOptions {
  editor: Editor | null;
  result: AssistResult | null;
  selectionRange: SelectionRange;
}

export const useAiSuggestion = ({
  editor,
  result,
  selectionRange,
}: UseAiSuggestionOptions) => {
  const [copied, setCopied] = useState(false);

  const applySuggestionToSelection = () => {
    if (!editor || !result?.suggestion) return;

    const isMarkdownAction = ["summarize", "explain", "rewrite", "noteCreation"].includes(
      result.action
    );
    const content = isMarkdownAction
      ? markdownToHtml(result.suggestion)
      : `<span data-ai-ghost="true">${result.suggestion}</span>`;

    const range = selectionRange ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };

    editor.chain().focus().insertContentAt(range, content).run();
  };

  const copySuggestion = async () => {
    if (!result?.suggestion) return;
    try {
      await navigator.clipboard.writeText(result.suggestion);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return {
    copied,
    applySuggestionToSelection,
    copySuggestion,
  };
};
