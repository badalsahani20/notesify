import "katex/dist/katex.min.css";
import { ChevronDown, Check, Copy } from "lucide-react";
import { GlobalChatEmptyState } from "@/components/chat/GlobalChatEmptyState";
import type { Message } from "@/components/ai/types";
import IrisMessageBody from "./IrisMessageBody";
import { IrisNoteCreatedCard } from "./IrisNoteCreatedCard";
import { Tool, ToolCall, ToolStatus } from "@/components/ai/tool";
import { parseIrisResponse } from "@/utils/parseIrisResponse";
import { useEffect, useState, useRef, memo, useCallback, useMemo } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ui/reasoning";
import { MessageScroller } from "@/components/agents/message-scroller";
import { StreamingResponse } from "@/components/agents/streaming-response";

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
      <div className="flex items-center gap-1.5 text-xs font-medium py-1 select-none">
        <TextShimmer duration={2}>Thinking...</TextShimmer>
      </div>
    );
  }

  // Done: closed time badge — no content, nothing to expand
  if (thinkingTime && thinkingTime > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/70 py-0.5 select-none">
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
}: ChatMessageRowProps) => {
  if (msg.role === "assistant") {
    const isThinking = (msg as any).isThinking ?? false;
    const thinkingTime = (msg as any).thinkingTime as number | undefined;
    const thought = (msg as any).thought as string | undefined;
    const toolCalls = (msg as any).toolCalls as Array<{
      id?: string;
      tool: string;
      query?: string;
      url?: string;
      citations?: any[];
      quizData?: any[];
      status?: "pending" | "executing" | "success" | "error";
      data?: any;
      args?: any;
    }> | undefined;

    const isWorking = (isActiveStream && (isStreaming || isSending)) || isThinking;

    // Identify active agentic tasks for streaming indicators
    const noteReadActivity = (toolCalls ?? []).find((tc) => tc.tool === "get_note_content");
    const searchActivity = (toolCalls ?? []).find((tc) => tc.tool === "search_web");
    const crawlActivity = (toolCalls ?? []).find((tc) => tc.tool === "crawl_url");
    const memoryActivity = (toolCalls ?? []).find((tc) => tc.tool === "save_memory");
    const askQuestionActivity = (toolCalls ?? []).find(
      (tc) => tc.tool === "ask_question" || tc.tool === "render_quiz" || tc.tool === "generate_quiz"
    );
    const hasAgenticTask = Boolean(
      noteReadActivity || searchActivity || crawlActivity || memoryActivity || askQuestionActivity
    );

    return (
      <div className="gc-msg gc-msg-assistant" data-slot="message" data-from="assistant">
        <div className="gc-msg-bubble gc-msg-bubble-ai" data-slot="message-bubble-content">
          {/* Unified Agentic Task Indicators with TextShimmer */}
          {isWorking && hasAgenticTask && (
            <div className="flex flex-col gap-1 text-xs font-semibold my-1 text-white">
              {noteReadActivity && (
                <TextShimmer duration={2.5}>
                  {noteReadActivity.status === "success" ? "Note read" : "Reading note..."}
                </TextShimmer>
              )}
              {searchActivity && (
                <TextShimmer duration={2.5}>
                  {searchActivity.query ? `Searching the web for "${searchActivity.query}"...` : "Searching the web..."}
                </TextShimmer>
              )}
              {crawlActivity && (
                <TextShimmer duration={2.5}>Reading webpage...</TextShimmer>
              )}
              {memoryActivity && (
                <TextShimmer duration={2.5}>Saving memory...</TextShimmer>
              )}
              {askQuestionActivity && (
                <TextShimmer duration={2.5}>Generating questions...</TextShimmer>
              )}
            </div>
          )}

          {/* Thinking Widget */}
          {(thinkingTime || thought || (isWorking && !displayText && !hasAgenticTask)) && (
            <ThinkingWidget
              isThinking={isThinking || (isWorking && !displayText)}
              thinkingTime={thinkingTime}
              thought={thought}
            />
          )}

          {/* Message content with StreamingResponse */}
          {displayText ? (
            <div className="gc-markdown max-w-full select-text" data-ms-editor="false" spellCheck={false} translate="no">
              <StreamingResponse
                status={isActiveStream && isStreaming ? "streaming" : "complete"}
                copyText={displayText}
                onCopy={() => onCopy(displayText, msg.id)}
                className="w-full"
              >
                <AssistantMessageBody
                  text={displayText}
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
              tc.tool === "crawl_url" ||
              tc.tool === "save_memory" ||
              tc.tool === "web_citations" ||
              tc.tool === "get_note_content" ||
              tc.tool === "ask_question" ||
              tc.tool === "render_quiz" ||
              tc.tool === "generate_quiz"
            ) {
              return null;
            }
            if (tc.tool === "create_note" || tc.tool === "update_note") {
              const noteId = tc.data?._id || tc.args?.noteId || tc.args?.id;
              const title = tc.data?.title || tc.args?.title || "Untitled Note";
              const content = tc.data?.content || tc.args?.content;
              const toolState = tc.status === "error"
                ? "error"
                : tc.status === "pending" || tc.status === "executing"
                  ? "running"
                  : "completed";
              const isUpdate = tc.tool === "update_note";
              return (
                <div key={`note-tool-${idx}`} className="my-2">
                  <Tool state={toolState}>
                    <ToolCall name={tc.tool} argsSummary={title} />
                    <ToolStatus state={toolState} />
                  </Tool>
                  <IrisNoteCreatedCard
                    noteId={noteId}
                    title={title}
                    content={content}
                    variant={isUpdate ? "updated" : "created"}
                  />
                </div>
              );
            }
            return null;
          })}

          {isActiveStream && isStreaming && displayText && <span className="gc-cursor" />}
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
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-2 -right-2 flex items-center bg-[#181818] border border-white/10 shadow-xl p-0.5 rounded-md z-10 cursor-pointer">
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

    messages.forEach((message) => {
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
      .filter((message) => message.role === "user")
      .map((message) => `${message.id}:${message.text.length}`)
      .join("\u0001"),
    [messages],
  );

  useEffect(() => {
    const nextLongMessageIds = new Set<string>();
    messages.forEach((message) => {
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

  const handleCopy = useCallback((text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Failed to copy text:", err);
    });
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
        viewportClassName={`gc-messages relative${fullWidthAssistant ? " gc-messages-fullwidth-assistant" : ""} [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
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
