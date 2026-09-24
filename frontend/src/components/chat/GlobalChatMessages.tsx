import "katex/dist/katex.min.css";
import { ChevronDown, Check, Copy } from "lucide-react";
import { GlobalChatEmptyState } from "@/components/chat/GlobalChatEmptyState";
import type { Message } from "@/components/ai/types";
import IrisMessageBody from "./IrisMessageBody";
import { IrisNoteCreatedCard } from "./IrisNoteCreatedCard";
import { Tool, ToolCall, ToolStatus } from "@/components/ai/tool";
import { parseIrisResponse } from "@/utils/parseIrisResponse";
import { useEffect, useState, useRef, useLayoutEffect, memo } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ui/reasoning";


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
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 py-0.5 select-none">
        <span>Thought for {thinkingTime}s</span>
      </div>
    );
  }

  return null;
};

// --- Main Component ---

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
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const lastMessageCount = useRef(messages.length);

  // Detect wrapping as well as explicit newlines so long prompts collapse at
  // the same visual height regardless of the viewport width.
  useEffect(() => {
    const nextLongMessageIds = new Set<string>();
    messages.forEach((message) => {
      if (message.role !== "user") return;
      const element = userMessageRefs.current[message.id];
      if (!element) return;

      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      const collapsedHeight = (Number.isFinite(lineHeight) ? lineHeight : 26) * 6;
      if (element.scrollHeight > collapsedHeight + 2) {
        nextLongMessageIds.add(message.id);
      }
    });
    setLongUserMessageIds(nextLongMessageIds);
  }, [messages]);

  // Measure the natural height after expanding so the CSS transition animates
  // to the real endpoint instead of an oversized max-height.
  useEffect(() => {
    const nextHeights: Record<string, number> = {};
    expandedUserMessages.forEach((messageId) => {
      const element = userMessageRefs.current[messageId];
      if (element) nextHeights[messageId] = element.scrollHeight;
    });
    setExpandedUserMessageHeights(nextHeights);
  }, [expandedUserMessages, messages]);

  const [selectionToolbar, setSelectionToolbar] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);

  const handleSelectionCheck = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionToolbar(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      setSelectionToolbar(null);
      return;
    }

    const containerEl = scrollContainerRef.current;
    if (!containerEl) return;

    try {
      const range = selection.getRangeAt(0);
      const ancestorNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

      if (!ancestorNode || !containerEl.contains(ancestorNode)) {
        setSelectionToolbar(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();

      const top = rect.top - containerRect.top + containerEl.scrollTop - 42;
      const left = rect.left - containerRect.left + rect.width / 2;

      setSelectionToolbar({
        text: selectedText,
        top: Math.max(10, top),
        left: Math.max(60, Math.min(containerRect.width - 60, left)),
      });
    } catch {
      setSelectionToolbar(null);
    }
  };

  useEffect(() => {
    const onSelectionChange = () => {
      handleSelectionCheck();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  const isInitialMount = useRef(true);
  const prevMessagesLength = useRef(messages.length);

  // Instantly pin scroll position before browser paint when returning to this page/session
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (container && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // When a new session is being loaded, prepare for instant pinning on completion
  useEffect(() => {
    if (messagesLoading) {
      isInitialMount.current = true;
    }
  }, [messagesLoading]);

  // Re-enable auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCount.current || isSending) {
      setUserHasScrolledUp(false);
    }
    lastMessageCount.current = messages.length;
  }, [messages.length, isSending]);

  // Auto-scroll logic: instant pin on initial mount/tab switch and during streaming
  useEffect(() => {
    if (userHasScrolledUp) return;

    const container = scrollContainerRef.current;

    // 1. Initial mount or returning to tab: instant pin without slow smooth-scroll animation
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevMessagesLength.current = messages.length;
      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
      return;
    }

    // 2. During streaming: keep pinned instantly
    if (isStreaming) {
      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
      return;
    }

    // 3. Only smooth-scroll when a new message was actually appended while actively viewing
    if (messages.length > prevMessagesLength.current) {
      prevMessagesLength.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamedMessageText, isStreaming, isSending, userHasScrolledUp, bottomRef]);

  // When an interactive question/quiz prompt opens, scroll down so the message sits above the card
  useEffect(() => {
    if (hasActivePrompt) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [hasActivePrompt, bottomRef]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user is near the bottom (within 50px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setUserHasScrolledUp(!isNearBottom);
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Failed to copy text:", err);
    });
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSelectionAction = (promptPrefix: string, text: string) => {
    setSelectionToolbar(null);
    window.getSelection()?.removeAllRanges();
    sendMessage(`${promptPrefix}: "${text}"`);
  };

  return (
    <div
      className={`gc-messages custom-scrollbar relative${fullWidthAssistant ? " gc-messages-fullwidth-assistant" : ""}`}
      ref={scrollContainerRef}
      onScroll={handleScroll}
      onMouseUp={handleSelectionCheck}
    >
      {/* Floating Selection Toolbar Popover */}
      {selectionToolbar && (
        <div
          className="absolute z-50 transform -translate-x-1/2 flex items-center bg-[#1c1c22] border border-white/20 shadow-2xl rounded-full p-1 text-xs text-white transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{ top: `${selectionToolbar.top}px`, left: `${selectionToolbar.left}px` }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => handleSelectionAction("Ask Iris about", selectionToolbar.text)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
          >
            <div className="iris-orb shrink-0" style={{ width: "12px", height: "12px", borderWidth: "1px", boxShadow: "none" }} />
            <span>Ask Iris</span>
          </button>
          
          <div className="h-3.5 w-[1px] bg-white/20 my-auto" />

          <button
            type="button"
            onClick={() => handleSelectionAction("Elaborate on", selectionToolbar.text)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <span>Elaborate</span>
          </button>

          <div className="h-3.5 w-[1px] bg-white/20 my-auto" />

          <button
            type="button"
            onClick={() => handleSelectionAction("Simplify", selectionToolbar.text)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <span>Simplify</span>
          </button>
        </div>
      )}
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
          // Hide system messages from the UI (e.g. hidden quiz submission prompts)
          if (msg.role === "user" && msg.text.startsWith("[System:")) {
            return null;
          }

          const isActiveStream = msg.id === streamingMessageId;
          const displayText = (isActiveStream ? streamedMessageText : msg.text) || "";
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
          }> | undefined;
          const isWorking = (isActiveStream && (isStreaming || isSending)) || isThinking;

          // Identify active agentic tasks for the existing streaming indicators.
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

          // Extract deduplicated citations for sources list
          const citations = (() => {
            const list: any[] = [];
            const seen = new Set<string>();
            toolCalls?.forEach((tc: any) => {
              if (tc.tool === "web_citations" && Array.isArray(tc.citations)) {
                for (const c of tc.citations) {
                  if (c?.url && !seen.has(c.url.trim().toLowerCase())) {
                    seen.add(c.url.trim().toLowerCase());
                    list.push(c);
                  }
                }
              }
            });
            return list;
          })();

          return (
            <div key={msg.id} className={`gc-msg gc-msg-${msg.role}`}>
              {msg.role === "assistant" ? (
                <div className="gc-msg-bubble gc-msg-bubble-ai">
                  {/* Unified Agentic Task Indicators with TextShimmer */}
                  {isWorking && hasAgenticTask && (
                    <div className="flex flex-col gap-1 text-xs font-semibold my-1">
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

                  {/* Thinking Widget (Only when reasoning thought exists, or waiting without an active agentic task) */}
                  {(thinkingTime || thought || (isWorking && !displayText && !hasAgenticTask)) && (
                    <ThinkingWidget
                      isThinking={isThinking || (isWorking && !displayText)}
                      thinkingTime={thinkingTime}
                      thought={thought}
                    />
                  )}

                  {/* Message content */}
                  {displayText ? (
                    <div
                      className="gc-markdown max-w-full focus:outline-none"
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      spellCheck={false}
                      autoCorrect="off"
                      data-ms-editor="false"
                      onBeforeInput={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (!(e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                    >
                      <IrisMessageBody
                        segments={msg.segments ?? parseIrisResponse(displayText)}
                        citations={citations}
                        onAnswer={sendMessage}
                      />
                    </div>
                  ) : null}

                      {/* Sources UI (Minimal, understated, interactive links with prompt-kit Source hover cards) */}
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

                      {/* 4. Tools (Inline rendering) */}
                      {msg.toolCalls?.map((tc, idx) => {
                        if (
                          tc.tool === "search_web" ||
                          tc.tool === "crawl_url" ||
                          tc.tool === "save_memory" ||
                          tc.tool === "web_citations" ||
                          tc.tool === "get_note_content" ||
                          tc.tool === "ask_question" ||
                          tc.tool === "render_quiz" ||
                          tc.tool === "generate_quiz"
                        )
                          return null;
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
                                <ToolCall name={ tc.tool } argsSummary={title} />
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

                      {/* Copy response button once generation completes */}
                      {!(isActiveStream && isStreaming) && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-white/40">
                          <button
                            onClick={() => handleCopy(displayText, msg.id)}
                            className="p-1 rounded-md hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      )}

                      {isActiveStream && isStreaming && displayText && <span className="gc-cursor" />}
                    </div>
              ) : (
                <div className="gc-msg-bubble gc-msg-bubble-user group relative">
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
                  {msg.text && (() => {
                    const isLong = longUserMessageIds.has(msg.id);
                    const isExpanded = expandedUserMessages.has(msg.id);

                    return (
                      <>
                        <div
                          ref={(element) => {
                            userMessageRefs.current[msg.id] = element;
                          }}
                          style={isExpanded
                            ? { maxHeight: `${expandedUserMessageHeights[msg.id] ?? 165}px` }
                            : undefined}
                          className={`gc-user-message-content whitespace-pre-wrap${isLong ? (isExpanded ? " gc-user-message-content-expanded" : " gc-user-message-content-collapsed") : ""}`}
                        >
                          {msg.text}
                        </div>
                        {isLong && (
                          <button
                            type="button"
                            className="gc-user-message-toggle"
                            onClick={() => setExpandedUserMessages((current) => {
                              const next = new Set(current);
                              if (next.has(msg.id)) next.delete(msg.id);
                              else next.add(msg.id);
                              return next;
                            })}
                          >
                            <span>{isExpanded ? "Show less" : "Show more"}</span>
                            <span className={`gc-user-message-toggle-icon${isExpanded ? " gc-user-message-toggle-icon-expanded" : ""}`}>
                              <ChevronDown size={15} />
                            </span>
                          </button>
                        )}
                      </>
                    );
                  })()}

                  {/* Hover Copy Button */}
                  {msg.text && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-2 -right-2 flex items-center bg-[#181818] border border-white/10 shadow-xl p-0.5 rounded-md z-10 cursor-pointer">
                      <button
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center"
                        title="Copy prompt"
                      >
                        {copiedId === msg.id ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Spacer to allow scrolling past the floating input box & active prompt dialog */}
      <div className={`shrink-0 transition-all duration-300 ${hasActivePrompt ? "h-[360px] sm:h-[400px]" : "h-48"}`} />
      <div ref={bottomRef} />
    </div>
  );
});

GlobalChatMessages.displayName = "GlobalChatMessages";
