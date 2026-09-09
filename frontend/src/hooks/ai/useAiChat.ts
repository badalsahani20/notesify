import { useEffect, useRef, useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { stripHtml } from "@/utils/stripHtml";
import type { Message, ChatHistoryMessage } from "@/components/ai/types";
import { useNoteContext } from "./useNoteContext";
import { useAiSuggestion } from "./useAiSuggestion";
import { useAiActions } from "./useAiActions";
import { useAiChatSession } from "./useAiChatSession";
import { useAiChatStreaming } from "./useAiChatStreaming";
import { postAiChatStream } from "@/services/ai/aiChatApi";

import { useGlobalChatStore } from "@/store/useGlobalChatStore";

/**
 * useAiChat — Facade hook owning state composition, side effects, and API orchestration for AI panel.
 */
export const useAiChat = (noteId: string, noteContent: string, editor: Editor | null) => {
  // ── Global Chat Mode ────────────────────────────────────────────────────────
  const { chatMode, setChatMode } = useGlobalChatStore();

  // ── Basic UI State ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Ask about the current note or use the quick actions below to refine it." },
  ]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // ── AI Settings State ───────────────────────────────────────────────────────
  const [pdfContext, setPdfContext] = useState<string | null>(null);
  const [pdfInjected, setPdfInjected] = useState(false);
  const [useReasoning, setUseReasoning] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  const isNew = noteId === "new" || !noteId;
  const effectiveNoteId = isNew ? null : noteId;
  const plainNoteText = useMemo(() => stripHtml(noteContent), [noteContent]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const lastSentContextRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Composed Hooks ─────────────────────────────────────────────────────────
  const noteContextState = useNoteContext(editor, plainNoteText, noteId);
  const session = useAiChatSession({
    noteId,
    isNew,
    messagesRef,
    setMessages,
    setChatHistory,
  });
  const streaming = useAiChatStreaming({
    setMessages,
    messagesRef,
    setPdfContext,
  });
  const actions = useAiActions({
    editor,
    effectiveNoteId,
    plainNoteText,
    setSelectionRange: noteContextState.setSelectionRange,
  });
  const suggestion = useAiSuggestion({
    editor,
    result: actions.result,
    selectionRange: noteContextState.selectionRange,
  });

  // ── Request Management ─────────────────────────────────────────────────────
  const stopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.stopActionRequest();
  };

  const buildChatHistory = (nextPrompt: string) => {
    const structuredContext = noteContextState.buildContext();
    const { hasSelection, selection, activeBlock, revisionId, surroundingBlocks, headingPath } = structuredContext;

    // Stable fingerprint for change detection
    const contextFingerPrint = JSON.stringify({
      hasSelection,
      selectionText: selection?.text,
      activeBlockId: activeBlock?.id,
      activeBlockText: activeBlock?.text,
      blockIds: surroundingBlocks.map((b) => b.id),
      headingPath,
    });

    const contextChanged = Boolean(
      contextFingerPrint && contextFingerPrint !== lastSentContextRef.current
    );

    if (contextChanged) {
      lastSentContextRef.current = contextFingerPrint;
    }

    const contextSource = hasSelection
      ? "selection"
      : contextChanged
      ? "local-window"
      : "reused-context";

    const editorContentLength = editor?.getText()?.length ?? plainNoteText.length;
    const savedContentLength = session.activeNote?.content ? stripHtml(session.activeNote.content).length : 0;
    const contextFreshness = {
      editorContentLength,
      savedContentLength,
      isDiverged: editorContentLength !== savedContentLength,
      divergenceDelta: editorContentLength - savedContentLength,
    };

    console.log("📊 [AI_TELEMETRY_FRONTEND]", {
      noteId: effectiveNoteId,
      revisionId,
      hasSelection,
      headingPath,
      activeBlockId: activeBlock?.id,
      blockCount: surroundingBlocks.length,
      contextChanged,
      contextFreshness,
      messageCount: chatHistory.length,
      contextSource,
      timestamp: new Date().toISOString(),
    });

    const trimmedHistory = chatHistory.slice(-6);

    return { history: trimmedHistory, message: nextPrompt, structuredContext, hasSelection, contextChanged };
  };

  const sendChatMessage = async (overrideText?: string) => {
    if (isSendingChat) return;
    const textToProcess = overrideText !== undefined ? overrideText : chatInput;
    const trimmed = textToProcess.trim();
    if (!trimmed && !attachedImage) return;

    const textToSend = trimmed || "Describe this image context.";
    const sentImage = attachedImage;
    setAttachedImage(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: textToSend,
      imageUrl: sentImage || undefined,
    };
    const optimisticMessages = [...messagesRef.current, userMessage];
    messagesRef.current = optimisticMessages;
    setMessages(optimisticMessages);

    if (overrideText === undefined) {
      setChatInput("");
    }

    try {
      abortControllerRef.current = new AbortController();
      setIsSendingChat(true);

      const { history: chatHist, message, structuredContext, hasSelection, contextChanged } = buildChatHistory(textToSend);

      const response = await postAiChatStream({
        message,
        history: chatHist,
        noteId: effectiveNoteId,
        structuredContext,
        hasSelection,
        contextChanged,
        imageBase64: sentImage,
        pdfContext: pdfInjected ? null : pdfContext,
        useReasoning,
        enableWeb: useWebSearch,
        chatMode,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to connect to AI");
      if (!response.body) throw new Error("No response body");

      const aiMsgId = crypto.randomUUID();
      const initialAssistantMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        text: "",
        isThinking: true,
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);
      messagesRef.current = [...messagesRef.current, initialAssistantMsg];

      const fullText = await streaming.processStream(response.body, aiMsgId);

      setChatHistory((prev) => [...prev, { role: "user", content: textToSend }, { role: "assistant", content: fullText }]);
      actions.setResult(null);

      if (pdfContext && !pdfInjected) {
        setPdfInjected(true);
      }

      session.persistMessages(messagesRef.current);
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && (error.name === "CanceledError" || error.name === "AbortError")) {
        setChatInput(trimmed);
        const rolledBackMessages = messagesRef.current.slice(0, -1);
        messagesRef.current = rolledBackMessages;
        setMessages(rolledBackMessages);
        return;
      }
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError?.response?.data?.message || "Chat request failed. Please try again.";
      const status = axiosError?.response?.status;

      if (status === 429 || /quota|rate limit|too many requests/i.test(message)) {
        toast.error("AI Limit Reached", {
          description: "Please upgrade to Premium to keep using AI features without limits.",
          duration: 5000,
        });
      }

      setChatHistory((prev) => [...prev, { role: "user", content: trimmed }]);
      const errorMessage: Message = { id: crypto.randomUUID(), role: "assistant", text: message };
      const failedMessages = [...messagesRef.current, errorMessage];
      messagesRef.current = failedMessages;
      setMessages(failedMessages);
    } finally {
      setIsSendingChat(false);
    }
  };

  return {
    messages,
    streamingMessageId: streaming.streamingMessageId,
    streamedMessageText: streaming.streamedMessageText,
    isStreaming: streaming.isStreaming,
    result: actions.result,
    selectionRange: noteContextState.selectionRange,
    copied: suggestion.copied,
    hasHistory: session.hasHistory,
    historyCount: session.historyCount,
    chatInput,
    setChatInput,
    attachedImage,
    setAttachedImage,
    loadingAction: actions.loadingAction,
    isSendingChat,
    sendChatMessage,
    stopRequest,
    runAction: actions.runAction,
    copySuggestion: suggestion.copySuggestion,
    applySuggestionToSelection: suggestion.applySuggestionToSelection,
    loadHistory: session.loadHistory,
    startNewChat: session.startNewChat,
    setResult: actions.setResult,
    chatHistory,
    useReasoning,
    setUseReasoning,
    useWebSearch,
    setUseWebSearch,
    chatMode,
    setChatMode,
  };
};
