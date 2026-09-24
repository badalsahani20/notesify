import { useState, useMemo, useRef, useCallback } from "react";
import { FileText, Type, X, RefreshCcw, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { GlobalChatMessages } from "@/components/chat/GlobalChatMessages";
import { GlobalChatCompose } from "@/components/chat/GlobalChatCompose";
import { InteractivePromptDialog } from "@/components/chat/InteractivePromptDialog";
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
    isSendingChat,
    sendChatMessage,
    stopRequest,
    startNewChat,
    selectionRange,
    streamingMessageId,
    streamedMessageText,
    isStreaming,
    useReasoning,
    setUseReasoning,
    useWebSearch,
    setUseWebSearch,
  } = aiChat;

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      void sendChatMessage(text);
    },
    [sendChatMessage]
  );

  return (
    <motion.aside
      initial={mobileMode ? { x: "100%" } : { opacity: 0 }}
      animate={mobileMode ? { x: 0 } : { opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`assistant-rail relative overflow-hidden ${mobileMode ? "assistant-rail-mobile" : "flex"}`}
    >
      {/* Dim moving purplish gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[200px] h-[200px] rounded-full bg-violet-600/10 blur-[60px] animate-blob-drift" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[40%] right-[10%] w-[180px] h-[180px] rounded-full bg-fuchsia-600/10 blur-[60px] animate-blob-drift" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute bottom-[10%] left-[30%] w-[220px] h-[220px] rounded-full bg-indigo-600/10 blur-[60px] animate-blob-drift" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-hidden">
          {isNewNote ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
              <Pencil size={10} />
              General chat
            </span>
          ) : selectionRange ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
              <Type size={10} />
              Selection
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-white/5 text-white/60 border border-white/10 whitespace-nowrap">
              <FileText size={10} />
              Note
            </span>
          )}
          {!isNewNote && noteTitle ? <span className="text-xs font-medium text-white/80 truncate">{noteTitle}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="assistant-header-action"
            onClick={() => void startNewChat()}
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

      {/* Messages */}
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
      />

      <div className="relative">
        <GlobalChatCompose
          input={chatInput}
          setInput={setChatInput}
          attachedImage={attachedImage}
          setAttachedImage={setAttachedImage}
          isSending={isSendingChat}
          imageDisabled={false}
          handleSend={() => void sendChatMessage()}
          textareaRef={textareaRef}
          fileRef={fileRef}
          placeholder="Ask about this note or anything..."
          onStop={stopRequest}
          useReasoning={useReasoning}
          setUseReasoning={setUseReasoning}
          useWebSearch={useWebSearch}
          setUseWebSearch={setUseWebSearch}
          topSlot={
            activeQuestions && activeQuestions.length > 0 ? (
              <InteractivePromptDialog
                questions={activeQuestions}
                title={activePromptToolCall?.title}
                onSubmit={(formatted) => {
                  if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
                  void sendChatMessage(formatted);
                }}
                onDismiss={() => {
                  if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
                }}
              />
            ) : undefined
          }
        />
      </div>
    </motion.aside>
  );
};

export default ContextualAiPanel;
