import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { Message } from "@/components/ai/types";
import { STUDENT_PROMPTS, DEV_PROMPTS } from "@/lib/constants";
import { PanelLeftOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlobalChatSidebar } from "@/components/chat/GlobalChatSidebar";
import { GlobalChatMessages } from "@/components/chat/GlobalChatMessages";
import { GlobalChatCompose, type LiquidChatComposeHandle } from "@/components/chat/GlobalChatCompose";
import { ChatArtifactViewer } from "@/components/chat/ChatArtifactViewer";
import { InteractivePromptDialog } from "@/components/chat/InteractivePromptDialog";
import { SelectionToolbar } from "@/components/chat/SelectionToolbar";
import type { InteractiveQuestion } from "@/components/ai/types";

const GlobalChatPage = () => {
  const {
    sessions,
    sessionsLoading,
    sessionsLoadingMore,
    sessionsHasMore,
    activeSessionId,
    messages,
    messagesLoading,
    pendingInteraction,
    isSending,
    attachedImage,
    attachedDoc,
    imageDisabled,
    fetchSessions,
    loadSession,
    loadMoreSessions,
    deleteSession,
    startNewChat,
    sendMessage,
    answerInteraction,
    stopGeneration,
    setAttachedImage,
    setAttachedDoc,
    uploadDoc,
    modelTier,
    setModelTier,
    useReasoning,
    setUseReasoning,
    activeArtifact,
    setActiveArtifact,
    regenerateResponse,
  } = useGlobalChatStore();

  const [input, setInput] = useState("");
  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState({
    students: STUDENT_PROMPTS,
    devs: DEV_PROMPTS,
  });

  const isMobile = useMediaQuery("(max-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth > 960);
  // Preserve the session list after its first mobile open so subsequent drawer
  // animations do not rebuild every row while the panel is sliding.
  const [hasOpenedMobileSidebar, setHasOpenedMobileSidebar] = useState(sidebarOpen);

  useEffect(() => {
    if (sidebarOpen) setHasOpenedMobileSidebar(true);
  }, [sidebarOpen]);

  // Desktop side panel resizable width (percentage)
  const [panelWidth, setPanelWidth] = useState(46);
  const isDraggingRef = useRef(false);

  // Global chat already receives throttled text updates from the SSE store.
  // A second character-by-character layer restarted on every store update and
  // caused the desktop stream to stutter.
  const latestAssistant = messages[messages.length - 1]?.role === "assistant"
    ? messages[messages.length - 1]
    : null;
  const isStreaming = isSending && Boolean(latestAssistant);
  const streamingMessageId = isStreaming ? latestAssistant?.id ?? null : null;
  const streamedMessageText = isStreaming ? latestAssistant?.text ?? "" : "";

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<LiquidChatComposeHandle>(null);

  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const previousRouteSessionIdRef = useRef(sessionId);
  const routeInitializedRef = useRef(false);

  useEffect(() => {
    // On phones the session history lives in the drawer. Do not build and
    // update that off-screen list while the chat screen is entering.
    if (!isMobile || sidebarOpen) {
      void fetchSessions();
    }
  }, [fetchSessions, isMobile, sidebarOpen]);

  useEffect(() => {
    // Fetch dynamic prompts
    import("@/lib/api").then(({ default: api }) => {
      api
        .get("/public/prompts")
        .then((res) => {
          if (res.data.success) {
            setPrompts({
              students: res.data.data.studentPrompts,
              devs: res.data.data.devPrompts,
            });
          }
        })
        .catch(() => {}); // Keep fallbacks on error
    });
  }, []);

  useEffect(() => {
    if (sessionId) {
      if (sessionId !== useGlobalChatStore.getState().activeSessionId) {
        loadSession(sessionId);
      }
      sessionStorage.setItem("notesify_last_chat_session", sessionId);
    } else {
      sessionStorage.removeItem("notesify_last_chat_session");
      const leavingSessionRoute = previousRouteSessionIdRef.current !== undefined;
      const enteringWithStaleSession =
        !routeInitializedRef.current &&
        useGlobalChatStore.getState().activeSessionId !== null;
      if (leavingSessionRoute || enteringWithStaleSession) {
        startNewChat();
      }
    }
    previousRouteSessionIdRef.current = sessionId;
    routeInitializedRef.current = true;
  }, [sessionId, loadSession, startNewChat]);

  useEffect(() => {
    if (!sessionId && activeSessionId && isSending) {
      sessionStorage.setItem("notesify_last_chat_session", activeSessionId);
      navigate(`/chat/${activeSessionId}`, { replace: true });
    }
  }, [sessionId, activeSessionId, isSending, navigate]);

  const handleStartNewChat = useCallback(() => {
    sessionStorage.removeItem("notesify_last_chat_session");
    startNewChat();
    navigate("/chat");
  }, [startNewChat, navigate]);

  const handleLoadSession = useCallback(
    (id: string) => {
      sessionStorage.setItem("notesify_last_chat_session", id);
      loadSession(id);
      navigate(`/chat/${id}`);
    },
    [loadSession, navigate],
  );

  const handleSend = useCallback((text?: string) => {
    const toSend = text ?? input;
    if (!toSend.trim() && !attachedImage && !attachedDoc) return;
    const imageToSend = attachedImage;
    const docId = attachedDoc?.id;
    setInput("");
    setAttachedImage(null);
    setAttachedDoc(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(toSend, imageToSend, docId);
  }, [input, attachedImage, attachedDoc, sendMessage, setInput, setAttachedImage, setAttachedDoc]);

  const handleRegenerate = useCallback(() => {
    void regenerateResponse();
  }, [regenerateResponse]);

  const handleLoadMoreSessions = useCallback(() => {
    void loadMoreSessions();
  }, [loadMoreSessions]);

  const handleClearDoc = useCallback(() => {
    setAttachedDoc(null);
  }, [setAttachedDoc]);

  const lastAssistantMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const activePromptToolCall = useMemo(() => {
    return lastAssistantMsg?.role === "assistant" && dismissedPromptId !== lastAssistantMsg.id
      ? lastAssistantMsg.toolCalls?.find(
          (tc) => tc.tool === "ask_question" && Boolean(tc.questions || tc.quizData)
        )
      : null;
  }, [lastAssistantMsg, dismissedPromptId]);

  const activeQuestions = useMemo(() => {
    const pendingQuestions = pendingInteraction
      ? pendingInteraction.questions ?? [{
          id: pendingInteraction.interactionId,
          question: pendingInteraction.question,
          type: "single_select" as const,
          options: pendingInteraction.options,
        }]
      : undefined;

    return (activePromptToolCall?.questions ?? activePromptToolCall?.quizData ?? pendingQuestions) as
      | InteractiveQuestion[]
      | undefined;
  }, [activePromptToolCall, pendingInteraction]);

  // Hide the prompt while the answer is being resumed; the server remains the
  // source of truth and will provide the next pending interaction if needed.
  const hasActivePrompt = !isSending && Boolean(activeQuestions && activeQuestions.length > 0);

  const handlePromptSubmit = useCallback(
    (formatted: string) => {
      if (pendingInteraction) {
        void answerInteraction(formatted);
        return;
      }
      if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
      sendMessage(formatted);
    },
    [answerInteraction, lastAssistantMsg, pendingInteraction, sendMessage]
  );

  const handlePromptDismiss = useCallback(() => {
    if (pendingInteraction) return;
    if (lastAssistantMsg) setDismissedPromptId(lastAssistantMsg.id);
  }, [lastAssistantMsg, pendingInteraction]);

  // Drag-to-resize handler for desktop split panel
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const windowWidth = window.innerWidth;
      const newWidthPx = windowWidth - moveEvent.clientX;
      const newWidthPct = Math.min(
        Math.max((newWidthPx / windowWidth) * 100, 26),
        68,
      );
      setPanelWidth(newWidthPct);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleAskIris = useCallback((quotedText: string) => {
    const formattedQuote = `> ${quotedText.replace(/\n/g, "\n> ")}\n\n`;
    composeRef.current?.appendText(formattedQuote);
    setTimeout(() => {
      composeRef.current?.focusEnd();
    }, 50);
  }, []);

  const topSlot = useMemo(
    () =>
      hasActivePrompt && activeQuestions ? (
        <InteractivePromptDialog
          questions={activeQuestions}
          purpose={activePromptToolCall?.purpose ?? pendingInteraction?.purpose ?? undefined}
          onSubmit={handlePromptSubmit}
          onDismiss={handlePromptDismiss}
        />
      ) : null,
    [
      hasActivePrompt,
      activeQuestions,
      activePromptToolCall,
      pendingInteraction,
      handlePromptSubmit,
      handlePromptDismiss,
    ],
  );

  return (
    <div className="gc-shell">
      <SelectionToolbar onAskIris={handleAskIris} />

      {/* Desktop sidebar: docked and persistent */}
      {!isMobile && (
        <GlobalChatSidebar
          isMobile={false}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsLoadingMore={sessionsLoadingMore}
          sessionsHasMore={sessionsHasMore}
          activeSessionId={activeSessionId}
          loadSession={handleLoadSession}
          loadMoreSessions={handleLoadMoreSessions}
          deleteSession={deleteSession}
          startNewChat={handleStartNewChat}
        />
      )}

      {/* Mobile sidebar: smooth animated overlay drawer */}
      {isMobile && hasOpenedMobileSidebar && (
        <GlobalChatSidebar
          isMobile={true}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsLoadingMore={sessionsLoadingMore}
          sessionsHasMore={sessionsHasMore}
          activeSessionId={activeSessionId}
          loadSession={handleLoadSession}
          loadMoreSessions={handleLoadMoreSessions}
          deleteSession={deleteSession}
          startNewChat={handleStartNewChat}
        />
      )}

      {/* ── Main chat area ── */}
      <div className="gc-main relative flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Floating Sidebar Toggle — visible only when sidebar is collapsed */}
        {!sidebarOpen && (
          <button
            className="absolute top-3.5 left-3.5 z-40 p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        {/* ── Horizontal Split Container (Chat on Left, Artifact Canvas on Right) ── */}
        <div
          className="relative flex-1 flex flex-row h-full w-full min-h-0 min-w-0 overflow-hidden z-10"
          style={{ display: "flex", flexDirection: "row" }}
        >
          {/* Left Column: Chat Messages & Compose (Always present & active) */}
          <div className="relative flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
            <GlobalChatMessages
              messages={messages as Message[]}
              messagesLoading={messagesLoading}
              streamingMessageId={streamingMessageId}
              streamedMessageText={streamedMessageText}
              isStreaming={isStreaming}
              isSending={isSending}
              sendMessage={sendMessage}
              prompts={prompts}
              bottomRef={bottomRef}
              fullWidthAssistant={!!activeArtifact}
              hasActivePrompt={hasActivePrompt}
              onRegenerate={handleRegenerate}
            />

            {/* Active interactive prompt (Claude-style docked dialog above input box) */}
            <GlobalChatCompose
              ref={composeRef}
              input={input}
              attachedImage={attachedImage}
              setAttachedImage={setAttachedImage}
              attachedDoc={attachedDoc}
              onDocUpload={uploadDoc}
              onClearDoc={handleClearDoc}
              isSending={isSending}
              imageDisabled={imageDisabled}
              handleSend={handleSend}
              onStop={stopGeneration}
              textareaRef={textareaRef}
              fileRef={fileRef}
              modelTier={modelTier}
              setModelTier={setModelTier}
              useReasoning={useReasoning}
              setUseReasoning={setUseReasoning}
              topSlot={topSlot}
            />
          </div>

          {/* Right Column: Desktop Split Artifact Canvas (Smooth slide in & out) */}
          <AnimatePresence>
            {activeArtifact && !isMobile && (
              <motion.aside
                key="desktop-artifact-canvas"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${panelWidth}%`, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{
                  width: { duration: 0.38, ease: [0.25, 1, 0.5, 1] },
                  opacity: { duration: 0.28, ease: "easeOut" },
                }}
                className="relative flex h-full shrink-0 overflow-hidden border-l border-slate-800 bg-[#0c0d12] z-20 shadow-2xl"
              >
                {/* Resizing Drag Handle */}
                <div
                  onMouseDown={handleResizeMouseDown}
                  className="absolute left-0 top-0 bottom-0 w-2 hover:bg-emerald-500/50 cursor-col-resize z-30 transition-colors flex items-center justify-center group select-none"
                  title="Drag to resize note panel"
                >
                  <div className="w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-emerald-400 transition-colors" />
                </div>

                <div className="flex-1 h-full min-w-0 overflow-hidden pl-1">
                  <ChatArtifactViewer
                    artifact={activeArtifact}
                    onClose={() => setActiveArtifact(null)}
                  />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* ── Mobile Sheet with smooth slide up transition ── */}
        <AnimatePresence>
          {activeArtifact && isMobile && (
            <motion.div
              key="mobile-artifact-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end"
              onClick={() => setActiveArtifact(null)}
            >
              <motion.div
                key="mobile-artifact-sheet-content"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.38, ease: [0.25, 1, 0.5, 1] }}
                className="h-[84vh] w-full rounded-t-2xl overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <ChatArtifactViewer
                  artifact={activeArtifact}
                  onClose={() => setActiveArtifact(null)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GlobalChatPage;
