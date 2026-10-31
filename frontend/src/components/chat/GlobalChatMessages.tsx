import "katex/dist/katex.min.css";
import { ChevronDown, Check, Copy } from "lucide-react";
import { GlobalChatEmptyState } from "@/components/chat/GlobalChatEmptyState";
import type { Message } from "@/components/ai/types";
import IrisMessageBody from "./IrisMessageBody";
import { IrisNoteCreatedCard } from "./IrisNoteCreatedCard";
import { ToolApprovalCard } from "./ToolApprovalCard";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";
import { executeClientTool } from "@/services/ai/clientToolExecutor";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { parseIrisResponse } from "@/utils/parseIrisResponse";
import { useEffect, useState, useRef, memo, useCallback, useMemo } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ui/reasoning";
import { MessageScroller } from "@/components/agents/message-scroller";
import { copyToClipboard } from "@/utils/clipboard";
import { StreamingResponse } from "@/components/agents/streaming-response";

import { useStreamingTextStore } from "@/store/useStreamingTextStore";

// --- Thinking Widget ---
interface ThinkingWidgetProps {
  isThinking: boolean;
  thinkingTime?: number;
  thought?: string;
}

const ThinkingWidget = ({ isThinking, thinkingTime, thought }: ThinkingWidgetProps) => {
  if (thought) {
    return (
      <Reasoning isStreaming={isThinking}>
        <ReasoningTrigger>
          {isThinking ? (
            <TextShimmer duration={2}>Thinking...</TextShimmer>
          ) : (
            <span>{thinkingTime && thinkingTime > 0 ? `Thought for ${thinkingTime}s` : "Thought"}</span>
          )}
        </ReasoningTrigger>
        <ReasoningContent markdown={true}>
          {thought}
        </ReasoningContent>
      </Reasoning>
    );
  }

  // Pure waiting state (no thoughts yet): show animated shimmer indicator
  if (isThinking) {
    return (
      <div className="flex items-center gap-1.5 text-[13px] font-medium py-1 select-none">
        <TextShimmer duration={2}>Thinking...</TextShimmer>
      </div>
    );
  }

  // Done: closed time badge — no content, nothing to expand
  if (thinkingTime && thinkingTime > 0) {
    return (
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70 py-0.5 select-none">
        <span>Thought for {thinkingTime}s</span>
      </div>
    );
  }

  return null;
};

interface AssistantMessageBodyProps {
  text: string;
  isStreaming: boolean;
  savedSegments?: Message["segments"];
  citations: any[];
}

const EMPTY_CITATIONS: any[] = [];

// Keep old assistant messages out of the streaming render loop.
const AssistantMessageBody = memo(({ text, isStreaming, savedSegments, citations }: AssistantMessageBodyProps) => {
  const segments = useMemo(
    () => savedSegments ?? parseIrisResponse(text),
    [savedSegments, text],
  );

  return (
    <IrisMessageBody
      segments={segments}
      isStreaming={isStreaming}
      streamingText={isStreaming ? text : undefined}
      citations={citations}
    />
  );
});

// --- Individual Message Row (Memoized for high scroll performance) ---

interface ChatMessageRowProps {
  msg: Message;
  isActiveStream: boolean;
  displayText: string;
  isStreaming: boolean;
  isSending: boolean;
  citations: any[];
  isCopied: boolean;
  onCopy: (text: string, id: string) => void;
  isLong: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedHeight?: number;
  registerUserRef: (id: string, el: HTMLDivElement | null) => void;
  isLastAssistantMessage?: boolean;
  onRegenerate?: () => void;
}

const ChatMessageRow = memo(({
  msg,
  isActiveStream,
  displayText,
  isStreaming,
  isSending,
  citations,
  isCopied,
  onCopy,
  isLong,
  isExpanded,
  onToggleExpand,
  expandedHeight,
  registerUserRef,
  isLastAssistantMessage = false,
  onRegenerate,
}: ChatMessageRowProps) => {
  const streamedText = useStreamingTextStore((s) =>
    isActiveStream && s.streamingMessageId === msg.id ? s.streamedMessageText : ""
  );
  const streamedThought = useStreamingTextStore((s) =>
    isActiveStream && s.streamingMessageId === msg.id ? s.streamedThought : ""
  );
  const isStreamThinking = useStreamingTextStore((s) =>
    isActiveStream && s.streamingMessageId === msg.id ? s.isThinking : undefined
  );
  const streamThinkingTime = useStreamingTextStore((s) =>
    isActiveStream && s.streamingMessageId === msg.id ? s.thinkingTime : undefined
  );

  const handleApproveTool = async (messageId: string, tc: any) => {
    const tool = tc.tool;
    const args = tc.args || {};
    const toolCallId = tc.id;
    const targetSessionId = useGlobalChatStore.getState().activeSessionId;

    useGlobalChatStore.getState().updateAssistantMessage((message: any) => {
      if (message.id !== messageId) return message;
      const existing = message.toolCalls ?? [];
      const index = existing.findIndex((t: any) => (toolCallId ? t.id === toolCallId : t.tool === tool));
      if (index === -1) return message;

      const updated = [...existing];
      updated[index] = { ...updated[index], status: "executing" };
      return { ...message, toolCalls: updated };
    });

    const result = await executeClientTool(tool, args);

    if (targetSessionId) {
      const accessToken = useAuthStore.getState().accessToken;
      void fetch(`${API_BASE_URL}/ai/chat/tool-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId: targetSessionId,
          toolCallId,
          tool,
          status: result.success ? "success" : "error",
          data: result.data ? { _id: result.data._id, title: result.data.title } : undefined,
          error: result.error,
        }),
      }).catch(() => {});
    }

    if (result.success && result.data && tool === "create_note") {
      useGlobalChatStore.getState().setActiveArtifact({
        type: "note",
        id: result.data._id,
        title: result.data.title,
        content: result.data.content,
      });
    } else if (result.success && tool === "delete_note") {
      const active = useGlobalChatStore.getState().activeArtifact;
      if (active?.id === (result.data?._id || args.noteId)) {
        useGlobalChatStore.getState().setActiveArtifact(null);
      }
    }

    useGlobalChatStore.getState().updateAssistantMessage((message: any) => {
      if (message.id !== messageId) return message;
      const existing = message.toolCalls ?? [];
      const index = existing.findIndex((t: any) => (toolCallId ? t.id === toolCallId : t.tool === tool));
      if (index === -1) return message;

      const updated = [...existing];
      updated[index] = {
        ...updated[index],
        status: result.success ? "success" : "error",
        data: result.data ?? updated[index].data,
        error: result.error ?? updated[index].error,
      };
      return { ...message, toolCalls: updated };
    });
  };

  const handleDenyTool = (messageId: string, tc: any) => {
    const tool = tc.tool;
    const toolCallId = tc.id;
    const targetSessionId = useGlobalChatStore.getState().activeSessionId;

    if (targetSessionId) {
      const accessToken = useAuthStore.getState().accessToken;
      void fetch(`${API_BASE_URL}/ai/chat/tool-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId: targetSessionId,
          toolCallId,
          tool,
          status: "error",
          error: "Action denied by user",
        }),
      }).catch(() => {});
    }

    useGlobalChatStore.getState().updateAssistantMessage((message: any) => {
      if (message.id !== messageId) return message;
      const existing = message.toolCalls ?? [];
      const index = existing.findIndex((t: any) => (toolCallId ? t.id === toolCallId : t.tool === tool));
      if (index === -1) return message;

      const updated = [...existing];
      updated[index] = {
        ...updated[index],
        status: "denied",
        error: "Action denied by user",
      };
      return { ...message, toolCalls: updated };
    });
  };

  if (msg.role === "assistant") {
    const isThinking = (msg as any).isThinking ?? false;
    const thinkingTime = (msg as any).thinkingTime as number | undefined;
    const thought = (msg as any).thought as string | undefined;

    const effectiveDisplayText = (isActiveStream ? (streamedText || displayText) : displayText) || "";
    const effectiveThought = (isActiveStream ? (streamedThought || thought) : thought) || "";
    const effectiveIsThinking = isActiveStream && isStreamThinking !== undefined ? isStreamThinking : isThinking;
    const effectiveThinkingTime = isActiveStream && streamThinkingTime !== undefined ? streamThinkingTime : thinkingTime;

    const toolCalls = (msg as any).toolCalls as Array<{
      id?: string;
      tool: string;
      query?: string;
      url?: string;
      citations?: any[];
      quizData?: any[];
      tasks?: any[];
      task?: any;
      status?: "pending" | "executing" | "success" | "error" | "approval-requested" | "denied";
      data?: any;
      args?: any;
      error?: string;
    }> | undefined;

    const isWorking = (isActiveStream && (isStreaming || isSending)) || effectiveIsThinking;

    // Identify active agentic tasks for streaming indicators
    const noteReadActivity = (toolCalls ?? []).find((tc) => tc.tool === "get_note_content");
    const noteSearchActivity = (toolCalls ?? []).find((tc) => tc.tool === "search_notes");
    const searchActivity = (toolCalls ?? []).find((tc) => tc.tool === "search_web");
    const crawlActivity = (toolCalls ?? []).find((tc) => tc.tool === "crawl_url");
    const memoryActivity = (toolCalls ?? []).find((tc) => tc.tool === "save_memory");
    const recallMemoryActivity = (toolCalls ?? []).find((tc) => tc.tool === "recall_memory");
    const askQuestionActivity = (toolCalls ?? []).find(
      (tc) => tc.tool === "ask_question" || tc.tool === "render_quiz" || tc.tool === "generate_quiz"
    );
    const deleteNoteActivity = (toolCalls ?? []).find((tc) => tc.tool === "delete_note");
    const hasAgenticTask = Boolean(
      noteReadActivity || noteSearchActivity || searchActivity || crawlActivity || memoryActivity || recallMemoryActivity || askQuestionActivity || deleteNoteActivity
    );

    return (
      <div className="gc-msg gc-msg-assistant" data-slot="message" data-from="assistant">
        <div className="gc-msg-bubble gc-msg-bubble-ai" data-slot="message-bubble-content">
          {/* Unified Agentic Task Indicators with TextShimmer */}
          {isWorking && hasAgenticTask && (
            <div className="flex flex-col gap-1 text-xs font-semibold my-1 text-white">
              {noteReadActivity && (
                <TextShimmer duration={2.5}>
                  {noteReadActivity.status === "success" ? "Reading complete" : "Reading note..."}
                </TextShimmer>
              )}
              {noteSearchActivity && (
                <TextShimmer duration={2.5}>
                  {noteSearchActivity.status === "success" 
                    ? "Notes searched" 
                    : noteSearchActivity.args?.query
                      ? `Searching notes for "${noteSearchActivity.args.query}"`
                      : "Searching notes..."}
                </TextShimmer>
              )}
              {searchActivity && (
                <TextShimmer duration={2.5}>
                  {searchActivity.query ? `Searching the web for "${searchActivity.query}"` : "Searching the web..."}
                </TextShimmer>
              )}
              {crawlActivity && (
                <TextShimmer duration={2.5}>Reading webpage...</TextShimmer>
              )}
              {memoryActivity && (
                <TextShimmer duration={2.5}>
                  {memoryActivity.status === "success" ? "Memory saved" : "Saving memory..."}
                </TextShimmer>
              )}
              {recallMemoryActivity && (
                <TextShimmer duration={2.5}>Recalling memory...</TextShimmer>
              )}
              {askQuestionActivity && (
                <TextShimmer duration={2.5}>Generating questions...</TextShimmer>
              )}
              {deleteNoteActivity && (
                <TextShimmer duration={2.5}>
                  {deleteNoteActivity.status === "success" ? "Note moved to trash" : "Moving note to trash..."}
                </TextShimmer>
              )}
            </div>
          )}

          {/* Thinking Widget */}
          {(effectiveThinkingTime || effectiveThought || (isWorking && !effectiveDisplayText && !hasAgenticTask)) && (
            <ThinkingWidget
              isThinking={effectiveIsThinking || (isWorking && !effectiveDisplayText)}
              thinkingTime={effectiveThinkingTime}
              thought={effectiveThought}
            />
          )}

          {/* Message content with StreamingResponse */}
          {effectiveDisplayText ? (
            <div className="gc-markdown max-w-full select-text text-white" data-ms-editor="false" spellCheck={false} translate="no">
              <StreamingResponse
                status={isActiveStream && isStreaming ? "streaming" : "complete"}
                copyText={effectiveDisplayText}
                onRetry={isLastAssistantMessage && !isStreaming && !isSending ? onRegenerate : undefined}
                className="w-full"
              >
                <AssistantMessageBody
                  text={effectiveDisplayText}
                  isStreaming={isStreaming && isActiveStream}
                  savedSegments={msg.segments}
                  citations={citations}
                />
              </StreamingResponse>
            </div>
          ) : null}

          {/* Existing Sources UI */}
          {citations.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-white/5">
              <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {citations.map((c, i) => {
                  let domain = "";
                  try {
                    domain = new URL(c.url).hostname.replace(/^www\./, "");
                  } catch {
                    domain = c.url;
                  }
                  const title = c.title || domain;
                  return (
                    <Source key={i} href={c.url}>
                      <SourceTrigger
                        label={title}
                        showFavicon={true}
                        className="max-w-[220px]"
                      />
                      <SourceContent
                        title={title}
                        description={c.content || c.url}
                      />
                    </Source>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tools Inline rendering */}
          {toolCalls?.map((tc, idx) => {
            if (
              tc.tool === "search_web" ||
              tc.tool === "search_notes" ||
              tc.tool === "crawl_url" ||
              tc.tool === "save_memory" ||
              tc.tool === "recall_memory" ||
              tc.tool === "web_citations" ||
              tc.tool === "get_note_content" ||
              tc.tool === "ask_question" ||
              tc.tool === "render_quiz" ||
              tc.tool === "generate_quiz"
            ) {
              return null;
            }
            if (tc.tool === "create_note" || tc.tool === "delete_note") {
              const noteId = tc.data?._id || tc.args?.noteId || tc.args?.id;
              const title = tc.data?.title || tc.args?.title || "Untitled Note";
              const content = tc.data?.content || tc.args?.content;

              if (
                tc.status === "approval-requested" ||
                tc.status === "pending" ||
                tc.status === "denied" ||
                (!tc.data && tc.status !== "success")
              ) {
                return (
                  <ToolApprovalCard
                    key={`approval-${idx}`}
                    toolCallId={tc.id}
                    tool={tc.tool}
                    args={tc.args || tc.data || {}}
                    state={tc.status === "denied" ? "denied" : tc.status === "error" ? "error" : "approval-requested"}
                    error={tc.error}
                    onApprove={() => handleApproveTool(msg.id, tc)}
                    onDeny={() => handleDenyTool(msg.id, tc)}
                  />
                );
              }

              const toolState = tc.status === "error" ? "error" : "completed";
              const variant = tc.tool === "delete_note" ? "deleted" : "created";
              return (
                <IrisNoteCreatedCard
                  key={`note-tool-${idx}`}
                  noteId={noteId}
                  title={title}
                  content={content}
                  variant={variant}
                  state={toolState}
                  error={tc.error}
                />
              );
            }

            if (tc.tool === "update_note") {
              const noteId = tc.data?._id || tc.args?.noteId || tc.args?.id;
              const title = tc.data?.title || tc.args?.title || "Untitled Note";
              const content = tc.data?.content || tc.args?.content;
              const toolState = tc.status === "error"
                ? "error"
                : tc.status === "pending" || tc.status === "executing"
                  ? "running"
                  : "completed";
              return (
                <IrisNoteCreatedCard
                  key={`note-tool-${idx}`}
                  noteId={noteId}
                  title={title}
                  content={content}
                  variant="updated"
                  state={toolState}
                  error={tc.error}
                />
              );
            }
            return null;
          })}

          {isActiveStream && isStreaming && effectiveDisplayText && <span className="gc-cursor" />}
        </div>
      </div>
    );
  }

  // User Message
  return (
    <div className="gc-msg gc-msg-user" data-slot="message" data-from="user">
      <div className="gc-msg-bubble gc-msg-bubble-user group relative" data-slot="message-bubble-content">
        {msg.imageUrl && (
          <a
            href={msg.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="gc-user-image-link"
          >
            <img src={msg.imageUrl} alt="Uploaded attachment" className="gc-user-image" />
          </a>
        )}
        {msg.text && (
          <>
            <div
              ref={(element) => registerUserRef(msg.id, element)}
              style={isExpanded
                ? { maxHeight: `${expandedHeight ?? 165}px` }
                : undefined}
              data-ms-editor="false"
              spellCheck={false}
              translate="no"
              className={`gc-user-message-content whitespace-pre-wrap${isLong ? (isExpanded ? " gc-user-message-content-expanded" : " gc-user-message-content-collapsed") : ""}`}
            >
              {msg.text}
            </div>
            {isLong && (
              <button
                type="button"
                className="gc-user-message-toggle cursor-pointer"
                onClick={() => onToggleExpand(msg.id)}
              >
                <span>{isExpanded ? "Show less" : "Show more"}</span>
                <span className={`gc-user-message-toggle-icon${isExpanded ? " gc-user-message-toggle-icon-expanded" : ""}`}>
                  <ChevronDown size={15} />
                </span>
              </button>
            )}
          </>
        )}

        {/* Hover Copy Button */}
        {msg.text && (
          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-2 -right-2 flex items-center bg-[#181818] border border-white/10 shadow-xl p-0.5 rounded-md z-10 cursor-pointer">
            <button
              onClick={() => onCopy(msg.text, msg.id)}
              className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
              title="Copy prompt"
            >
              {isCopied ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessageRow.displayName = "ChatMessageRow";

// --- Main Messages Component ---

interface GlobalChatMessagesProps {
  messages: Message[];
  messagesLoading: boolean;
  streamingMessageId: string | null;
  streamedMessageText: string;
  isStreaming: boolean;
  isSending: boolean;
  sendMessage: (text: string) => void;
  onRegenerate?: () => void;
  prompts: { students: string[], devs: string[] };
  bottomRef: React.RefObject<HTMLDivElement | null>;
  fullWidthAssistant?: boolean;
  hasActivePrompt?: boolean;
}

export const GlobalChatMessages = memo(({
  messages,
  messagesLoading,
  streamingMessageId,
  streamedMessageText,
  isStreaming,
  isSending,
  sendMessage,
  onRegenerate,
  prompts,
  bottomRef,
  fullWidthAssistant = false,
  hasActivePrompt = false,
}: GlobalChatMessagesProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedUserMessages, setExpandedUserMessages] = useState<Set<string>>(new Set());
  const [expandedUserMessageHeights, setExpandedUserMessageHeights] = useState<Record<string, number>>({});
  const [longUserMessageIds, setLongUserMessageIds] = useState<Set<string>>(new Set());
  const userMessageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const citationCacheRef = useRef(new Map<string, { toolCalls?: Message["toolCalls"]; citations: any[] }>());

  const citationsByMessageId = useMemo(() => {
    const result = new Map<string, any[]>();
    const nextCache = new Map<string, { toolCalls?: Message["toolCalls"]; citations: any[] }>();

    messages.forEach((message: any) => {
      const cached = citationCacheRef.current.get(message.id);
      if (cached && cached.toolCalls === message.toolCalls) {
        result.set(message.id, cached.citations);
        nextCache.set(message.id, cached);
        return;
      }

      const citations: any[] = [];
      const seen = new Set<string>();
      message.toolCalls?.forEach((toolCall: any) => {
        if (toolCall.tool !== "web_citations" || !Array.isArray(toolCall.citations)) return;
        toolCall.citations.forEach((citation: any) => {
          const normalizedUrl = typeof citation?.url === "string"
            ? citation.url.trim().toLowerCase()
            : "";
          if (normalizedUrl && !seen.has(normalizedUrl)) {
            seen.add(normalizedUrl);
            citations.push(citation);
          }
        });
      });

      const entry = { toolCalls: message.toolCalls, citations };
      result.set(message.id, citations);
      nextCache.set(message.id, entry);
    });

    citationCacheRef.current = nextCache;
    return result;
  }, [messages]);

  // Keep measurement effects from rerunning on every streamed token
  const userMessageMeasureKey = useMemo(
    () => messages
      .filter((message: any) => message.role === "user")
      .map((message: any) => `${message.id}:${message.text.length}`)
      .join("\u0001"),
    [messages],
  );

  useEffect(() => {
    const nextLongMessageIds = new Set<string>();
    messages.forEach((message: any) => {
      if (message.role !== "user") return;
      const element = userMessageRefs.current[message.id];
      if (!element) return;

      // 6 lines threshold for user prompts (approx 26px per line = 156px) without layout thrashing
      if (element.scrollHeight > 158) {
        nextLongMessageIds.add(message.id);
      }
    });
    setLongUserMessageIds(nextLongMessageIds);
  }, [userMessageMeasureKey, messages]);

  useEffect(() => {
    const nextHeights: Record<string, number> = {};
    expandedUserMessages.forEach((messageId) => {
      const element = userMessageRefs.current[messageId];
      if (element) nextHeights[messageId] = element.scrollHeight;
    });
    setExpandedUserMessageHeights(nextHeights);
  }, [expandedUserMessages, userMessageMeasureKey]);

  // When an interactive question/quiz prompt opens, scroll down so the message sits above the card
  useEffect(() => {
    if (hasActivePrompt) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [hasActivePrompt, bottomRef]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    if (!text) return;

    const copied = await copyToClipboard(text);
    if (!copied) {
      console.error("Failed to copy text");
      return;
    }

    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedUserMessages((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const registerUserRef = useCallback((id: string, el: HTMLDivElement | null) => {
    userMessageRefs.current[id] = el;
  }, []);

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Reader-Aware Message Scroller Viewport */}
      <MessageScroller
        // Do not animate from the top to the bottom when an existing session
        // is hydrated. The loaded transcript should land at its latest message.
        followOutput={!messagesLoading}
        followThreshold={64}
        smooth={false}
        busy={isStreaming}
        navigation={fullWidthAssistant ? undefined : "rail"}
        navigationLabel="Chat navigation"
        railClassName={hasActivePrompt ? "!bottom-[360px]" : "!bottom-[104px]"}
        viewportRef={scrollContainerRef}
        viewportClassName={`gc-messages gpu-scroll relative${fullWidthAssistant ? " gc-messages-fullwidth-assistant" : ""} [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        contentClassName="flex flex-col gap-4 w-full min-w-0"
        className="h-full flex-1 min-h-0 overflow-hidden"
      >
        {messagesLoading ? (
          <div className="gc-loading-wrap">
            <div className="gc-loading-dot" style={{ animationDelay: "0ms" }} />
            <div className="gc-loading-dot" style={{ animationDelay: "150ms" }} />
            <div className="gc-loading-dot" style={{ animationDelay: "300ms" }} />
          </div>
        ) : messages.length === 0 ? (
          <GlobalChatEmptyState onChipClick={sendMessage} prompts={prompts} />
        ) : (
          messages.map((msg) => {
            if (msg.role === "user" && msg.text.startsWith("[System:")) {
              return null;
            }

            const isActiveStream = msg.id === streamingMessageId;
            const displayText = (isActiveStream ? streamedMessageText : msg.text) || "";

            return (
              <ChatMessageRow
                key={msg.id}
                msg={msg}
                isActiveStream={isActiveStream}
                displayText={displayText}
                isStreaming={isStreaming}
                isSending={isSending}
                citations={citationsByMessageId.get(msg.id) ?? EMPTY_CITATIONS}
                isCopied={copiedId === msg.id}
                onCopy={handleCopy}
                isLong={longUserMessageIds.has(msg.id)}
                isExpanded={expandedUserMessages.has(msg.id)}
                onToggleExpand={handleToggleExpand}
                expandedHeight={expandedUserMessageHeights[msg.id]}
                registerUserRef={registerUserRef}
                isLastAssistantMessage={msg.id === lastAssistantMessageId}
                onRegenerate={onRegenerate}
              />
            );
          })
        )}

        {/* Spacer to allow scrolling past floating input box & active prompt dialog */}
        <div className={`shrink-0 transition-all duration-300 ${hasActivePrompt ? "h-[360px] sm:h-[400px]" : "h-48"}`} />
        <div ref={bottomRef} />
      </MessageScroller>
    </div>
  );
});

GlobalChatMessages.displayName = "GlobalChatMessages";
