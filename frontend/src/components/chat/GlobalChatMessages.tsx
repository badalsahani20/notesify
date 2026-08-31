import "katex/dist/katex.min.css";
import { ChevronRight, ChevronDown, FileText, Search, Globe, Check, Copy } from "lucide-react";
import { GlobalChatEmptyState } from "@/components/chat/GlobalChatEmptyState";
import type { Message } from "@/components/ai/types";
import IrisMessageBody from "./IrisMessageBody";
import { InlineQuizManager } from "./InlineQuizManager";
import { parseIrisResponse } from "@/utils/parseIrisResponse";
import { useEffect, useState, useRef } from "react";
import { getThinkingState } from "@/utils/getThinkingState";


// --- Thinking Widget ---
interface ThinkingWidgetProps {
  isThinking: boolean;
  thinkingTime?: number;
  thought?: string;
  isReasoningOff?: boolean;
}


const ThinkingWidget = ({ isThinking, thinkingTime, thought, isReasoningOff }: ThinkingWidgetProps) => {
  // If we have thought text, show it in a collapsible detail block
  const [thinking, setThinking] = useState(getThinkingState());

  useEffect(() => {
    if (!isThinking) return;

    const interval = setInterval(() => {
      setThinking(getThinkingState());
    }, 2500);
    return () => clearInterval(interval);
  }, [isThinking]);

  if (thought) {
    return (
      <details className="iris-thinking-details" open={isThinking}>
        <summary className={`iris-thinking-summary ${!isThinking ? "iris-thinking-summary-done" : ""}`}>
          <ChevronRight size={14} className="iris-chevron" />
          <span>{isThinking ? (isReasoningOff ? thinking.text : "Thinking") : `Thought for ${thinkingTime}s`}</span>
          {isThinking && (
            <span className="iris-thinking-indicator-dots">
              <span style={{ animationDelay: "0ms" }} />
              <span style={{ animationDelay: "180ms" }} />
              <span style={{ animationDelay: "360ms" }} />
            </span>
          )}
        </summary>
        <div className="iris-thinking-content">
          {thought}
        </div>
      </details>
    );
  }

  // Pure waiting state (no thoughts yet): show animated spinner
  if (isThinking) {
    return (
      <div className="iris-thinking-indicator">
        <span>{isReasoningOff ? thinking.text : "Thinking"}</span>
        <span className="iris-thinking-indicator-dots">
          <span style={{ animationDelay: "0ms" }} />
          <span style={{ animationDelay: "180ms" }} />
          <span style={{ animationDelay: "360ms" }} />
        </span>
      </div>
    );
  }

  // Done: closed time badge — no content, nothing to expand
  if (thinkingTime && thinkingTime > 0 && !isReasoningOff) {
    return (
      <div className="iris-thinking-indicator iris-thinking-indicator-done">
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
  useReasoning?: boolean;
}

export const GlobalChatMessages = ({
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
  useReasoning = true,
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

  // Re-enable auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCount.current || isSending) {
      setUserHasScrolledUp(false);
    }
    lastMessageCount.current = messages.length;
  }, [messages.length, isSending]);

  // Auto-scroll logic
  useEffect(() => {
    if (!userHasScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamedMessageText, isStreaming, isSending, userHasScrolledUp, bottomRef]);

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
          const toolCalls = (msg as any).toolCalls as Array<{ tool: string }> | undefined;

          return (
            <div key={msg.id} className={`gc-msg gc-msg-${msg.role}`}>
              {msg.role === "assistant" ? (
                <>
                  {/* ── Pure waiting state: pill only, no bubble wrapper ── */}
                  {isThinking && !displayText && !thought ? (
                    toolCalls && toolCalls.filter(tc => !["search_notes", "render_quiz"].includes(tc.tool)).length > 0 ? (
                      <div className="flex flex-col gap-2 mb-2">
                        {toolCalls.filter(tc => !["search_notes", "render_quiz"].includes(tc.tool)).map((tc, idx) => {
                          let label = "Working...";
                          let icon = <Globe size={14} className="iris-search-indicator-icon" />;
                          if (tc.tool === "search_web") {
                            label = "Searching the web...";
                            icon = <Search size={14} className="iris-search-indicator-icon animate-pulse" />;
                          } else if (tc.tool === "crawl_url") {
                            label = "Reading webpage...";
                            icon = <Globe size={14} className="iris-search-indicator-icon animate-pulse" />;
                          } else if (tc.tool === "get_note_content") {
                            label = "Reading note...";
                            icon = <FileText size={14} className="iris-search-indicator-icon animate-pulse" />;
                          } else if (tc.tool === "save_memory") {
                            label = "Saving to memory...";
                            icon = <Check size={14} className="iris-search-indicator-icon animate-pulse text-emerald-500" />;
                          }
                          return (
                            <div key={idx} className="iris-search-indicator-pulse">
                              {icon}
                              <span>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ThinkingWidget isThinking={true} isReasoningOff={!useReasoning} />
                    )
                  ) : (
                    <div className="gc-msg-bubble gc-msg-bubble-ai">
                      {/* 1. Premium completed tool badges (Top) */}
                      {toolCalls && toolCalls.filter(tc => !["search_notes", "render_quiz"].includes(tc.tool)).length > 0 && (
                        <div className="flex flex-col gap-1.5 mb-2">
                          {toolCalls.filter(tc => !["search_notes", "render_quiz"].includes(tc.tool)).map((tc, idx) => {
                            let label = tc.tool;
                            let icon = <Globe size={12} className="text-emerald-500" />;
                            if (tc.tool === "search_web") {
                              label = "Searched the web";
                              icon = <Search size={12} className="text-emerald-500" />;
                            } else if (tc.tool === "crawl_url") {
                              label = "Read webpage";
                              icon = <Globe size={12} className="text-emerald-500" />;
                            } else if (tc.tool === "get_note_content") {
                              label = "Read note";
                              icon = <FileText size={12} className="text-emerald-500" />;
                            } else if (tc.tool === "save_memory") {
                              label = "Saved to memory";
                              icon = <Check size={12} className="text-emerald-500" />;
                            }
                            return (
                              <div key={idx} className="iris-search-complete-badge">
                                <Check size={12} className="text-emerald-500" />
                                <span className="flex items-center gap-1">
                                  {icon}
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. Done badge or Active thought (Middle) */}
                      {(thinkingTime || thought) && (
                        <ThinkingWidget
                          isThinking={isThinking}
                          thinkingTime={thinkingTime}
                          thought={thought}
                        />
                      )}

                      {/* 3. Message content (Bottom) */}
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
                          onAnswer={sendMessage}
                        />
                      </div>

                      {/* 4. Tools (Inline rendering) */}
                      {msg.toolCalls?.map((tc, idx) => {
                        if (tc.tool === "search_web" || tc.tool === "crawl_url" || tc.tool === "save_memory") return null;
                        if (tc.tool === "render_quiz" && tc.quizData) {
                          return (
                            <InlineQuizManager
                              key={`quiz-${idx}`}
                              questions={tc.quizData}
                              isHistorical={msg.id !== messages[messages.length - 1].id}
                              onComplete={(formattedAnswers) => {
                                sendMessage(formattedAnswers);
                              }}
                            />
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

                      {isActiveStream && isStreaming && <span className="gc-cursor" />}
                    </div>
                  )}
                </>
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

      {/* Spacer to allow scrolling past the floating input box */}
      <div className="h-48 shrink-0" />
      <div ref={bottomRef} />
    </div>
  );
};
