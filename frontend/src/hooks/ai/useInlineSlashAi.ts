import { useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { postAiAssistStream } from "@/services/ai/aiAssistApi";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { buildNoteContext } from "@/utils/ai/noteContextBuilder";
import { markdownToHtml } from "@/utils/markdownToHtml";
import { toast } from "sonner";
import type { useAiChat } from "@/hooks/ai/useAiChat";

interface UseInlineSlashAiProps {
  editor: Editor | null;
  noteId?: string | null;
  editable?: boolean;
  aiChat?: ReturnType<typeof useAiChat>;
}

export const useInlineSlashAi = ({
  editor,
  noteId,
  editable = true,
  aiChat,
}: UseInlineSlashAiProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<"menu" | "prompt">("menu");
  const [menuCoords, setMenuCoords] = useState<{ top: number; bottom: number; left: number } | null>(null);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewCoords, setReviewCoords] = useState<{ top: number; bottom: number; left: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const preGenSnapshotRef = useRef<any>(null);
  const insertPosRef = useRef<number>(0);
  const lastPromptRef = useRef<{ prompt: string; action: "generate" | "continue" | "summarize" | "explain" } | null>(null);

  // Close menus cleanly
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setMenuCoords(null);
  }, []);

  // Accept generated content (removes ghost styling from all generated text, cements into document silently)
  const handleAccept = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetAllAiGhost().run();
    setIsReviewOpen(false);
    setIsGenerating(false);
    preGenSnapshotRef.current = null;
  }, [editor]);

  // Stop active stream
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  // Discard generated content (restores document to pre-generation state or discards all ghost text)
  const handleDiscard = useCallback(() => {
    handleStop();
    if (editor) {
      if (preGenSnapshotRef.current) {
        editor.commands.setContent(preGenSnapshotRef.current, { emitUpdate: true });
        editor.commands.focus();
      } else {
        editor.chain().focus().discardAllAiGhost().run();
      }
    }
    setIsReviewOpen(false);
    setIsGenerating(false);
    preGenSnapshotRef.current = null;
  }, [editor, handleStop]);

  // Execute AI generation inline at cursor
  const executeInlineAi = useCallback(
    async (
      prompt: string,
      actionType: "generate" | "continue" | "summarize" | "explain"
    ) => {
      if (!editor || !editable) return;

      closeMenu();

      // For reading/analytical tasks (summarize, explain), open the floating inspector card
      // instead of injecting raw text directly into the note.
      if ((actionType === "summarize" || actionType === "explain") && aiChat) {
        void aiChat.runAction(actionType);
        return;
      }

      // Boundary check for empty editor
      const doc = editor.state.doc;
      const totalDocSize = doc.content.size;
      const { from } = editor.state.selection;

      const prefixStart = Math.max(0, from - 2000);
      const prefixText = doc.textBetween(prefixStart, from, "\n", " ").trim();

      const suffixEnd = Math.min(totalDocSize, from + 2000);
      const suffixText = doc.textBetween(from, suffixEnd, "\n", " ").trim();

      const isAtStart = !prefixText;
      const isAtEnd = !suffixText;
      const isEmptyDoc = isAtStart && isAtEnd;

      if (actionType === "continue" && isEmptyDoc) {
        toast.info("Start writing a thought or use 'Draft with Iris AI' to begin from a topic.");
        return;
      }

      lastPromptRef.current = { prompt, action: actionType };

      // Save pre-generation document state for reliable 100% rollback on Discard
      preGenSnapshotRef.current = editor.getJSON();
      const insertPos = from;
      insertPosRef.current = insertPos;

      // Extract cursor neighborhood context using existing noteContextBuilder
      const structuredContext = buildNoteContext(editor, noteId || "new", 1);
      const headingBreadcrumbs = structuredContext.headingPath.join(" > ");

      let contextualPrompt = "";

      if (actionType === "continue") {
        const parts: string[] = [];
        if (headingBreadcrumbs) {
          parts.push(`[Document Section Hierarchy]:\n${headingBreadcrumbs}`);
        }
        if (prefixText) {
          parts.push(`[PRECEDING CONTEXT (DO NOT REPEAT CONCEPTS OR TABLES COVERED HERE)]:\n${prefixText}`);
        } else {
          parts.push(`[PRECEDING CONTEXT]:\nNone (Start of document - write introductory overview leading into the following content)`);
        }
        if (structuredContext.activeBlock?.text) {
          parts.push(`[CURRENT CURSOR LINE / SECTION TO COMPLETE]:\n${structuredContext.activeBlock.text}`);
        }
        if (suffixText) {
          parts.push(`[SUBSEQUENT CONTEXT (DO NOT DUPLICATE OR OVERWRITE WHAT FOLLOWS)]:\n${suffixText}`);
        } else {
          parts.push(`[SUBSEQUENT CONTEXT]:\nNone (End of document - continue writing forward naturally)`);
        }
        contextualPrompt = parts.join("\n\n");
      } else {
        const surroundingText = structuredContext.surroundingBlocks
          .map((b) => {
            const isActive =
              structuredContext.activeBlock && b.id === structuredContext.activeBlock.id
                ? " (current block / cursor focus)"
                : "";
            return `[${b.type}${isActive}]: ${b.text}`;
          })
          .join("\n");

        contextualPrompt = [
          headingBreadcrumbs ? `[Document Section Hierarchy]:\n${headingBreadcrumbs}` : "",
          surroundingText ? `[Editor Context (surrounding blocks)]:\n${surroundingText}` : "",
          prompt ? `[User Request]:\n${prompt}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      // Set up streaming request
      abortControllerRef.current = new AbortController();
      setIsGenerating(true);
      setIsReviewOpen(true);

      // Anchor review bar initially at cursor
      try {
        const coords = editor.view.coordsAtPos(insertPos);
        setReviewCoords({ top: coords.top, bottom: coords.bottom, left: coords.left });
      } catch {
        // fallback
      }

      let accumulatedText = "";

      try {
        const response = await postAiAssistStream({
          noteId: noteId || null,
          action: actionType === "generate" ? "noteCreation" : actionType,
          selectedText: actionType === "continue" ? undefined : (structuredContext.selection?.text || undefined),
          noteText: contextualPrompt || editor.getText(),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "AI generation failed");
        }
        if (!response.body) throw new Error("No response body");

        await consumeAiChatStream(response.body, {
          onUpdate: ({ fullText }) => {
            if (!fullText || !editor) return;
            accumulatedText = fullText;

            // Render streamed text with ghost styling at insertPos
            const formattedHtml = markdownToHtml(accumulatedText);
            const ghostWrappedHtml = `<span data-ai-ghost="true">${formattedHtml}</span>`;

            editor
              .chain()
              .focus()
              .setMeta("addToHistory", false)
              .insertContentAt(
                { from: insertPos, to: editor.state.selection.to },
                ghostWrappedHtml
              )
              .run();

            // Keep review bar anchored to the bottom of the streamed text
            try {
              const currentEndCoords = editor.view.coordsAtPos(editor.state.selection.to);
              setReviewCoords({ top: currentEndCoords.top, bottom: currentEndCoords.bottom, left: currentEndCoords.left });
            } catch {
              // ignore coordinate calculation race condition
            }
          },
        });
      } catch (err: any) {
        if (err.name === "AbortError" || err.message === "Request cancelled.") {
          return;
        }
        console.error("❌ Inline AI Generation error:", err);
        toast.error(err.message || "AI generation failed. Please try again.");
        handleDiscard();
      } finally {
        setIsGenerating(false);
      }
    },
    [closeMenu, editable, editor, handleDiscard, noteId]
  );

  const handleRegenerate = useCallback(() => {
    if (lastPromptRef.current) {
      handleDiscard();
      setTimeout(() => {
        if (lastPromptRef.current) {
          void executeInlineAi(lastPromptRef.current.prompt, lastPromptRef.current.action);
        }
      }, 50);
    }
  }, [executeInlineAi, handleDiscard]);

  // Intercept editor keydown for slash and space commands
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!editor || !editable) return false;

      // When review bar is active, let Tab and Escape be handled by review bar
      if (isReviewOpen) {
        if (e.key === "Tab") {
          e.preventDefault();
          handleAccept();
          return true;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          handleDiscard();
          return true;
        }
      }

      // If command menu is already open, Escape closes it
      if (isMenuOpen && e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return true;
      }

      const { selection } = editor.state;
      const { $from } = selection;

      // 1.Space on empty line trigger
      if (e.key === " " && selection.empty && $from.parent.textContent === "") {
        e.preventDefault();
        try {
          const coords = editor.view.coordsAtPos(selection.from);
          setMenuCoords({ top: coords.top, bottom: coords.bottom, left: coords.left });
          setMenuMode("prompt");
          setIsMenuOpen(true);
          return true;
        } catch {
          return false;
        }
      }

      // 2. Slash "/" command trigger
      if (e.key === "/" && selection.empty) {
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, " ");
        // Guard check: only trigger at start of block or preceded by whitespace
        const isStartOfBlock = $from.parentOffset === 0;
        const isPrecededBySpace = textBefore.endsWith(" ");

        if (isStartOfBlock || isPrecededBySpace) {
          setTimeout(() => {
            try {
              const currentPos = editor.state.selection.from;
              const coords = editor.view.coordsAtPos(currentPos);
              setMenuCoords({ top: coords.top, bottom: coords.bottom, left: coords.left });
              setMenuMode("menu");
              setIsMenuOpen(true);
            } catch {
              // ignore
            }
          }, 10);
        }
      }

      return false;
    },
    [closeMenu, editable, editor, handleAccept, handleDiscard, isMenuOpen, isReviewOpen]
  );

  return {
    isMenuOpen,
    menuMode,
    menuCoords,
    closeMenu,
    isReviewOpen,
    isGenerating,
    reviewCoords,
    handleAccept,
    handleDiscard,
    handleRegenerate,
    handleStop,
    executeInlineAi,
    handleEditorKeyDown,
  };
};
