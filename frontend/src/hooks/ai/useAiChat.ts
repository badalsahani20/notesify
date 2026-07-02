import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { AxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { requestSessionRefresh } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { parseIrisResponse } from "@/utils/parseIrisResponse";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { useNoteQuery } from "@/hooks/notes/useNotesQuery";
import { useUpdateNoteMutation } from "@/hooks/notes/useNotesMutations";
import type { AiAction, AssistResult, SelectionRange, Message, ChatHistoryMessage } from "@/components/ai/types";
import type { Note } from "@/store/useNoteStore";
import { stripHtml } from "@/utils/stripHtml";
import { markdownToHtml } from "@/utils/markdownToHtml";

const getSelection = (editor: Editor | null) => {
  if (!editor) return { text: "", range: null as SelectionRange };
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, " ").trim();
  return { text, range: from !== to ? { from, to } : null };
};

const getActiveNoteSection = (note: string, cursorPosition: number) => {
  const windowSize = 4000;
  const start = Math.max(0, cursorPosition - windowSize);
  const end = Math.min(note.length, cursorPosition + windowSize);
  return note.slice(start, end);
};

const resolveNoteContext = (editor: Editor | null, noteText: string) => {
  if (!editor) return { text: noteText.slice(0, 8000), hasSelection: false };
  const { text, range } = getSelection(editor);
  if (range && text) return { text, hasSelection: true };
  const cursor = editor.state.selection.from;
  return { text: getActiveNoteSection(noteText, cursor), hasSelection: false };
};

const getPersistedHistoryFromMessages = (messages: Message[]) =>
  messages
    .filter((message) => message.id !== "welcome")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.text,
      ...(message.role === "assistant" && message.segments ? { segments: message.segments } : {}),
      ...(message.role === "assistant" && message.toolCalls ? { toolCalls: message.toolCalls } : {}),
    }))
    .slice(-50);

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAiChat — owns all state, side effects, and API calls for the AI panel.
 *
 * The panel component (AiAuditPanel) becomes a thin glue layer:
 * it calls this hook, destructures the returned values, and passes them
 * to the child display components.
 *
 * @param noteId      - ID of the currently open note
 * @param noteContent - Raw HTML content of the note (used for AI context)
 * @param editor      - TipTap editor instance (used for selection tracking)
 */
export const useAiChat = (noteId: string, noteContent: string, editor: Editor | null) => {
  const queryClient = useQueryClient();
  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Ask about the current note or use the quick actions below to refine it." },
  ]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryMessage[]>([]);
  const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange>(null);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Direct streaming state — same pattern as useGlobalChatStore (no typewriter)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamedMessageText, setStreamedMessageText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [pdfContext, setPdfContext] = useState<string | null>(null);
  const [pdfInjected, setPdfInjected] = useState(false);
  const [useReasoning, setUseReasoning] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [chatMode, setChatMode] = useState<"study" | "casual">("study");

  const isNew = noteId === "new" || !noteId;
  // Resolve the effective noteId to send to the API — null signals the backend
  // to skip the note DB lookup and run in stateless (context-free) mode.
  const effectiveNoteId = isNew ? null : noteId;
  const { data: activeNote } = useNoteQuery(isNew ? "" : noteId);

  const { mutateAsync: updateNoteAsync } = useUpdateNoteMutation();

  // ── Refs ───────────────────────────────────────────────────────────────────
  // Tracks the last note context we sent to the AI so we know when it changed
  const lastSentContextRef = useRef("");
  // Lets us cancel in-flight requests when the user hits Stop
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);

  // ── Derived values ─────────────────────────────────────────────────────────
  const plainNoteText = useMemo(() => stripHtml(noteContent), [noteContent]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load chat history from the database when the user explicitly requests it
  const loadHistory = () => {
    if (activeNote?.chatHistory && activeNote.chatHistory.length > 0) {
      const existingIds = new Set(messagesRef.current.map((m) => m.id));

      const historicMessages = activeNote.chatHistory
        .map((m: any) => ({
          id: m.id || m._id || crypto.randomUUID(),
          role: m.role,
          text: m.content as string,
          segments: m.segments,
          toolCalls: m.toolCalls,
          skipAnimation: true,
        }))
        .filter((m: any) => !existingIds.has(m.id));

      const nextMessages = ((prev: Message[]) => {
        // Keep the welcome message at the top, then historic messages, then current messages
        const welcomeMessage = prev.find((m) => m.id === "welcome");
        const otherMessages = prev.filter((m) => m.id !== "welcome");
        return [
          ...(welcomeMessage ? [welcomeMessage] : []),
          ...historicMessages,
          ...otherMessages,
        ];
      })(messagesRef.current);

      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      setChatHistory(
        activeNote.chatHistory.map((m: any) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        }))
      );
      setHistoryLoaded(true);
    }
  };

  // If the note has no history initially, mark it as loaded so the button doesn't appear when chatting
  useEffect(() => {
    if (historyLoaded) return;
    if (!activeNote?.chatHistory) return;

    if (activeNote.chatHistory.length === 0) {
      // No history at all — mark as loaded so the load button never shows
      setHistoryLoaded(true);
      return;
    }

    // Auto-load history when it contains quiz tool calls so in-progress quizzes
    // survive note switches without requiring the user to click "Load History".
    const hasQuizInHistory = activeNote.chatHistory.some(
      (m: any) => m.toolCalls?.some((tc: any) => tc.tool === "generate_quiz")
    );
    if (hasQuizInHistory) {
      loadHistory();
    }
  }, [activeNote?.chatHistory, historyLoaded, loadHistory]);

  useEffect(() => {
    setHistoryLoaded(false);
    const nextMessages: Message[] = [
      { id: "welcome", role: "assistant", text: "Hi! How can i help you today?" },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setChatHistory([]);
  }, [noteId]);

  // Track editor selection so the context indicator updates in real time
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { range } = getSelection(editor);
      setSelectionRange(range);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    handleSelectionUpdate(); // run once immediately to capture any existing selection

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);


  /** Cancels any in-flight API request */
  const stopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  /** Runs one of the quick-action presets (Improve, Summarize, Brainstorm, Rewrite) directly into the editor */
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
        // ── Streaming path for dialog actions ───────────────────────────
        const { accessToken } = useAuthStore.getState();
        const fetchBody = JSON.stringify({
          noteId: effectiveNoteId,
          action,
          selectedText: customPrompt ? undefined : (selectedText || undefined),
          noteText: sourceText,
          stream: true,
        });

        let response = await fetch(`${import.meta.env.VITE_API_URL}/ai/assist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: fetchBody,
          signal: abortControllerRef.current.signal,
        });

        if (response.status === 401) {
          try {
            const newToken = await requestSessionRefresh();
            response = await fetch(`${import.meta.env.VITE_API_URL}/ai/assist`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${newToken}`,
              },
              body: fetchBody,
              signal: abortControllerRef.current.signal,
            });
          } catch (e) {
            window.location.href = "/login";
            throw new Error("Session expired. Please log in again.");
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "AI action failed. Please try again.");
        }
        if (!response.body) throw new Error("No response body");

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream")) {
          // ── Cached response path — backend returned JSON even for stream:true ──
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
          // ── Live SSE stream path ─────────────────────────────────────────
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
            }
          });

          // Mark streaming done
          setResult((prev) => prev ? { ...prev, isStreaming: false } : prev);
        }

      } else {
        // ── Blocking path for inline actions (grammar, continue) ─────────
        const res = await api.post(
          "/ai/assist",
          { noteId: effectiveNoteId, action, selectedText: selectedText || undefined, noteText: sourceText },
          { signal: abortControllerRef.current.signal }
        );

        const data = res.data?.data ?? null;

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

  /** Builds the payload for a chat message, including the relevant note context */
  const buildChatHistory = (nextPrompt: string) => {
    const { text: noteContext, hasSelection } = resolveNoteContext(editor, plainNoteText);
    const normalizedContext = noteContext.trim().slice(0, 8000);
    const contextChanged = Boolean(normalizedContext && normalizedContext !== lastSentContextRef.current);

    if (contextChanged) {
      lastSentContextRef.current = normalizedContext;
    }

    // Trim to last 6 entries before sending — the server trims to 6 too, but Groq
    // counts tokens on the full payload we send, before any server-side trimming.
    // Keeping this lean prevents hitting the TPM limit on models like llama-3.1-8b-instant.
    const trimmedHistory = chatHistory.slice(-6);

    return { history: trimmedHistory, message: nextPrompt, noteContext: normalizedContext, hasSelection, contextChanged };
  };

  /** Sends the current chatInput as a message to the AI */
  const sendChatMessage = async (overrideText?: string) => {
    if (isSendingChat) return;
    const textToProcess = overrideText !== undefined ? overrideText : chatInput;
    const trimmed = textToProcess.trim();
    if (!trimmed && !attachedImage) return;

    // Default to "Image Context" if they just send an image without text
    const textToSend = trimmed || "Describe this image context.";

    const sentImage = attachedImage;
    setAttachedImage(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: textToSend,
      imageUrl: sentImage || undefined
    };
    const optimisticMessages = [...messagesRef.current, userMessage];
    messagesRef.current = optimisticMessages;
    setMessages(optimisticMessages);

    // Only clear input if we were actually reading from it
    if (overrideText === undefined) {
      setChatInput("");
    }

    try {
      abortControllerRef.current = new AbortController();
      setIsSendingChat(true);

      const { history: chatHist, message, noteContext, hasSelection, contextChanged } = buildChatHistory(textToSend);
      const { accessToken } = useAuthStore.getState();

      const fetchBody = JSON.stringify({
        message,
        history: chatHist,
        noteId: effectiveNoteId,
        noteContext,
        hasSelection,
        contextChanged,
        imageBase64: sentImage,
        pdfContext: pdfInjected ? null : pdfContext,
        stream: true,
        useReasoning,
        enableWeb: useWebSearch,
        chatMode,
      });

      let response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: fetchBody,
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 401) {
        try {
          const newToken = await requestSessionRefresh();
          response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${newToken}`,
            },
            body: fetchBody,
            signal: abortControllerRef.current.signal,
          });
        } catch (e) {
          window.location.href = "/login";
          throw new Error("Session expired. Please log in again.");
        }
      }

      if (!response.ok) throw new Error("Failed to connect to AI");
      if (!response.body) throw new Error("No response body");

      // Add assistant message with isThinking:true — same as global chat store
      const aiMsgId = crypto.randomUUID();
      const initialAssistantMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        text: "",
        isThinking: true,
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);
      messagesRef.current = [...messagesRef.current, initialAssistantMsg];

      // Activate streaming UI
      setStreamingMessageId(aiMsgId);
      setStreamedMessageText("");
      setIsStreaming(true);

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body, {
          throttleMs: 40,
          onToolCall: ({ tool, quizData }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), { tool, quizData }] }
                  : m
              )
            );
          },
          onMetadata: ({ pdfContext }) => {
            if (pdfContext) setPdfContext(pdfContext);
          },
          onUpdate: ({ fullText, fullThought, isThinking, thinkingTime }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, isThinking, thought: fullThought, thinkingTime }
                  : m
              )
            );
            setStreamedMessageText(fullText);
          },
        });

      // Stream done — finalise
      const segments = parseIrisResponse(fullText);

      setStreamingMessageId(null);
      setStreamedMessageText("");
      setIsStreaming(false);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: fullText, thought: fullThought, segments, isThinking: false, thinkingTime: finalThinkingTime }
            : m
        )
      );
      messagesRef.current = messagesRef.current.map((m) =>
        m.id === aiMsgId ? { ...m, text: fullText, thought: fullThought, segments, isThinking: false, thinkingTime: finalThinkingTime } : m
      );

      setChatHistory((prev) => [...prev, { role: "user", content: textToSend }, { role: "assistant", content: fullText }]);
      setResult(null);

      // If we just sent a PDF, it is now "injected" into the history
      if (pdfContext && !pdfInjected) {
        setPdfInjected(true);
      }

      // Persist to DB — only when this is a real saved note (not a new/unsaved one)
      if (!isNew) {
        const persistedMessages = messagesRef.current;
        const newDbHistory = getPersistedHistoryFromMessages(persistedMessages);
        const existingDbHistory = !historyLoaded
          ? (activeNote?.chatHistory ?? []).map((m: any) => ({
              id: m.id || m._id,
              role: m.role,
              content: m.content,
              ...(m.segments ? { segments: m.segments } : {}),
              ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
            }))
          : [];
        const dbHistory = [...existingDbHistory, ...newDbHistory].slice(-50);

        const latestNote = (queryClient.getQueryData(["note", noteId]) as Note | undefined) ?? activeNote;
        if (latestNote) {
          void updateNoteAsync({
            noteId,
            updates: { chatHistory: dbHistory as Note["chatHistory"] },
            version: latestNote.version,
          });
        }
      }

    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "CanceledError") {
        setChatInput(trimmed); // restore their draft
        const rolledBackMessages = messagesRef.current.slice(0, -1);
        messagesRef.current = rolledBackMessages;
        setMessages(rolledBackMessages); // remove the optimistic user message
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

  /** Clears the current session and DB history for this note */
  const startNewChat = async () => {
    const nextMessages: Message[] = [
      { id: "welcome", role: "assistant", text: "Hi! How can i help you today?" },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setChatHistory([]);
    setHistoryLoaded(true);
    const latestNote = (queryClient.getQueryData(["note", noteId]) as Note | undefined) ?? activeNote;
    if (latestNote) {
      void updateNoteAsync({ noteId, updates: { chatHistory: [] }, version: latestNote.version });
    }
    toast.success("Chat history cleared");
  };

  /** Replaces the selected text in the editor with the AI suggestion */
  const applySuggestionToSelection = () => {
    if (!editor || !result?.suggestion) return;

    const isMarkdownAction = ["summarize", "explain", "rewrite", "noteCreation"].includes(result.action);
    const content = isMarkdownAction
      ? markdownToHtml(result.suggestion)
      : `<span data-ai-ghost="true">${result.suggestion}</span>`;

    // For "Insert at cursor" there may be no prior selection — fall back to cursor
    const range = selectionRange ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };

    editor.chain()
      .focus()
      .insertContentAt(range, content)
      .run();
  };

  /** Copies the latest AI suggestion to the clipboard */
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

  const hasHistory = (activeNote?.chatHistory?.length ?? 0) > 0 && !historyLoaded;
  const historyCount = activeNote?.chatHistory?.length ?? 0;

  // ── Return everything the panel and its children need ──────────────────────
  return {
    // Message list state
    messages,
    streamingMessageId,
    streamedMessageText,
    isStreaming,
    result,
    selectionRange,
    copied,
    hasHistory,
    historyCount,
    // Compose bar state
    chatInput,
    setChatInput,
    attachedImage,
    setAttachedImage,
    loadingAction,
    isSendingChat,
    // Actions
    sendChatMessage,
    stopRequest,
    runAction,
    copySuggestion,
    applySuggestionToSelection,
    loadHistory,
    startNewChat,
    setResult,
    chatHistory,
    useReasoning,
    setUseReasoning,
    useWebSearch,
    setUseWebSearch,
    chatMode,
    setChatMode,
  };
};
