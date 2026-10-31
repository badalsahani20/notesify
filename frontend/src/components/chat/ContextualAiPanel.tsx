import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { FileText, Type, X, RefreshCcw, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { GlobalChatMessages } from "@/components/chat/GlobalChatMessages";
import { GlobalChatCompose, type LiquidChatComposeHandle } from "@/components/chat/GlobalChatCompose";
import { InteractivePromptDialog } from "@/components/chat/InteractivePromptDialog";
import { SelectionToolbar } from "@/components/chat/SelectionToolbar";
import { isDesktopApp } from "@/lib/desktop";
import type { useAiChat } from "@/hooks/ai/useAiChat";
import type { Message, InteractiveQuestion } from "../ai/types";

type ContextualAiPanelProps = {
  aiChat: ReturnType<typeof useAiChat>;
  noteTitle?: string;
  /** True when the note hasn't been saved yet (noteId === "new") */
  isNewNote?: boolean;
  onClose: () => void;
  mobileMode?: boolean;
};

const ContextualAiPanel = ({
  aiChat,
  noteTitle,
  isNewNote = false,
  onClose,
  mobileMode = false,
}: ContextualAiPanelProps) => {
  const {
    hasHistory,
    historyCount,
    loadHistory,
    messages,
    chatInput,
    setChatInput,
    attachedImage,
    setAttachedImage,
    attachedDoc,
    setAttachedDoc,
    uploadDoc,
    isSendingChat,
    sendChatMessage,
    stopRequest,
    startNewChat,
    selectionRange,
    streamingMessageId,
    streamedMessageText,
    isStreaming,
    modelTier,
    setModelTier,
    useReasoning,
    setUseReasoning,
    regenerateResponse,
  } = aiChat;

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<LiquidChatComposeHandle>(null);

  const prompts = useMemo(() => ({ students: [], devs: [] }), []);

  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null);

  const lastAssistantMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const activePromptToolCall = useMemo(() => {
    return lastAssistantMsg?.role === "assistant" && dismissedPromptId !== lastAssistantMsg.id
      ? lastAssistantMsg.toolCalls?.find(
          (tc) => tc.tool === "ask_question" && Boolean(tc.questions || tc.quizData)
        )
      : null;
  }, [lastAssistantMsg, dismissedPromptId]);

  const activeQuestions = useMemo(() => {
    return (activePromptToolCall?.questions ?? activePromptToolCall?.quizData) as
      | InteractiveQuestion[]
      | undefined;
  }, [activePromptToolCall]);

  const handleSendMessage = useCallback(
    (text?: string) => {
      setChatInput("");
      void sendChatMessage(text ?? "");
    },
    [sendChatMessage, setChatInput]
  );

  const handleAskIris = useCallback((quotedText: string) => {
    const formattedQuote = `> ${quotedText.replace(/\n/g, "\n> ")}\n\n`;
    composeRef.current?.appendText(formattedQuote);
    setTimeout(() => {
      composeRef.current?.focusEnd();
    }, 50);
  }, []);

  const handleRegenerate = useCallback(() => {
    void regenerateResponse();
  }, [regenerateResponse]);

  const handleClearDoc = useCallback(() => {
    setAttachedDoc(null);
  }, [setAttachedDoc]);

  const handlePromptSubmit = useCallback(
    (formatted: string) => {
      if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
      void sendChatMessage(formatted);
    },
    [lastAssistantMsg, sendChatMessage],
  );

  const handlePromptDismiss = useCallback(() => {
    if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
  }, [lastAssistantMsg]);

  const topSlot = useMemo(
    () =>
      activeQuestions && activeQuestions.length > 0 ? (
        <InteractivePromptDialog
          questions={activeQuestions}
          purpose={activePromptToolCall?.purpose}
          onSubmit={handlePromptSubmit}
          onDismiss={handlePromptDismiss}
        />
      ) : null,
    [activeQuestions, activePromptToolCall, handlePromptSubmit, handlePromptDismiss],
  );

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const focus = searchParams.get("focus");
  const isFocusMode = focus === "1" || focus === "2";
  const isDesktop = isDesktopApp();
  const needsDesktopTitlebarPadding = isDesktop && isFocusMode && !mobileMode;

  return (
    <motion.aside
      // On mobile the slide-in is handled by the `assistant-rail-enter` CSS
      // animation. Framer Motion would leave a `translateX(0)` transform on the
      // sheet, and a transformed ancestor keeps the nested chat scroller off
      // Android WebView's fast scrolling path.
      initial={mobileMode ? false : { opacity: 0 }}
      animate={mobileMode ? undefined : { opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`assistant-rail relative overflow-hidden ${mobileMode ? "assistant-rail-mobile assistant-rail-enter bg-[#09090b]" : "bg-[var(--window-bg)] flex"}`}
    >
      <SelectionToolbar onAskIris={handleAskIris} />
      {/* Clean background without color tint blur layers */}
      <div 
        className={`relative z-10 flex items-center justify-between px-4 py-2.5 border-b border-[var(--divider)] shrink-0 ${mobileMode ? "bg-[var(--window-bg)]" : "bg-[var(--window-bg)]/90 backdrop-blur-md"}`}
        style={needsDesktopTitlebarPadding ? { paddingRight: "clamp(140px, 9.5rem, 160px)" } : undefined}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {isNewNote ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
              <Pencil size={10} />
              General chat
            </span>
          ) : selectionRange ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-[var(--active-surface)] text-[var(--accent-strong)] border border-[var(--accent-strong)]/30 whitespace-nowrap">
              <Type size={10} />
              Selection
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium bg-[var(--surface-ghost)] text-[var(--muted-text)] border border-[var(--divider)] whitespace-nowrap">
              <FileText size={10} />
              Note
            </span>
          )}
          {!isNewNote && noteTitle ? <span className="text-xs font-medium text-[var(--text-strong)] truncate">{noteTitle}</span> : null}
        </div>
        <div className="flex items-center gap-1 shrink-0" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button
            type="button"
            className="assistant-header-action"
            onClick={() => {
              setAttachedDoc(null);
              void startNewChat();
            }}
            title="Start fresh chat"
          >
            <RefreshCcw size={14} />
            <span>Reset</span>
          </button>
          <button type="button" className="assistant-close-button" onClick={onClose} aria-label="Close AI panel">
            <X size={16} />
          </button>
        </div>
      </div>

      {hasHistory ? (
        <div className="px-4 pt-3">
          <button
            type="button"
            className="ai-history-toggle"
            onClick={() => {
              loadHistory();
              // Let React re-render the messages before scrolling
              setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "instant" });
              }, 0);
            }}
            aria-label={`Load ${historyCount} previous messages`}
          >
            Older chat ({historyCount} messages)
          </button>
        </div>
      ) : null}

      {/* Messages and Composer Column */}
      <div className="relative flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        <GlobalChatMessages
          messages={messages as Message[]}
          messagesLoading={false}
          streamingMessageId={streamingMessageId}
          streamedMessageText={streamedMessageText}
          isStreaming={isStreaming}
          isSending={isSendingChat}
          sendMessage={handleSendMessage}
          prompts={prompts}
          bottomRef={bottomRef}
          fullWidthAssistant
          hasActivePrompt={Boolean(activeQuestions && activeQuestions.length > 0)}
          onRegenerate={handleRegenerate}
        />

        <GlobalChatCompose
          ref={composeRef}
          input={chatInput}
          attachedImage={attachedImage}
          setAttachedImage={setAttachedImage}
          attachedDoc={attachedDoc}
          onDocUpload={uploadDoc}
          onClearDoc={handleClearDoc}
          isSending={isSendingChat}
          imageDisabled={false}
          handleSend={handleSendMessage}
          textareaRef={textareaRef}
          fileRef={fileRef}
          placeholder="Ask about this note or anything..."
          onStop={stopRequest}
          modelTier={modelTier}
          setModelTier={setModelTier}
          useReasoning={useReasoning}
          setUseReasoning={setUseReasoning}
          compact
          topSlot={topSlot}
        />
      </div>
    </motion.aside>
  );
};

export default ContextualAiPanel;
