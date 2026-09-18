import { useEffect, useRef, useState } from "react";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";
import { useTypewriter } from "@/hooks/ui/useTypewriter";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { Message } from "@/components/ai/types";
import { STUDENT_PROMPTS, DEV_PROMPTS } from "@/lib/constants";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlobalChatSidebar } from "@/components/chat/GlobalChatSidebar";
import { GlobalChatMessages } from "@/components/chat/GlobalChatMessages";
import { GlobalChatCompose } from "@/components/chat/GlobalChatCompose";
import { ChatArtifactViewer } from "@/components/chat/ChatArtifactViewer";

const GlobalChatPage = () => {
  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    messages,
    messagesLoading,
    isSending,
    attachedImage,
    imageDisabled,
    fetchSessions,
    loadSession,
    startNewChat,
    sendMessage,
    setAttachedImage,
    useReasoning,
    setUseReasoning,
    useWebSearch,
    setUseWebSearch,
    activeArtifact,
    setActiveArtifact,
  } = useGlobalChatStore();

  const [input, setInput] = useState("");
  const [prompts, setPrompts] = useState({
    students: STUDENT_PROMPTS,
    devs: DEV_PROMPTS,
  });

  const isMobile = useMediaQuery("(max-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop side panel resizable width (percentage)
  const [panelWidth, setPanelWidth] = useState(46);
  const isDraggingRef = useRef(false);

  // Shared typewriter hook — no skip IDs needed for global chat
  const { streamingMessageId, streamedMessageText, isStreaming } = useTypewriter(
    messages as Message[],
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchSessions();
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
  }, [fetchSessions]);

  const handleSend = () => {
    if (!input.trim() && !attachedImage) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(input, attachedImage);
  };

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

  return (
    <div className="gc-shell">
      <GlobalChatSidebar
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSessionId={activeSessionId}
        loadSession={loadSession}
        startNewChat={startNewChat}
      />

      {/* ── Main chat area ── */}
      <div className="gc-main relative flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Dim purplish gradient background — paused during streaming or artifact viewing for max scroll performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className="absolute top-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[80px] animate-blob-drift"
            style={{
              animationDuration: "8s",
              animationPlayState: isStreaming || !!activeArtifact ? "paused" : "running",
            }}
          />
          <div
            className="absolute top-[40%] right-[10%] w-[250px] h-[250px] rounded-full bg-fuchsia-600/10 blur-[80px] animate-blob-drift"
            style={{
              animationDuration: "10s",
              animationDelay: "1s",
              animationPlayState: isStreaming || !!activeArtifact ? "paused" : "running",
            }}
          />
          <div
            className="absolute bottom-[10%] left-[30%] w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[80px] animate-blob-drift"
            style={{
              animationDuration: "12s",
              animationDelay: "2s",
              animationPlayState: isStreaming || !!activeArtifact ? "paused" : "running",
            }}
          />
        </div>

        {/* Floating Sidebar Toggle */}
        <button
          className="absolute top-4 left-4 z-50 p-2 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>

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
              sendMessage={(text) => sendMessage(text)}
              prompts={prompts}
              bottomRef={bottomRef}
              fullWidthAssistant={!!activeArtifact}
              useReasoning={useReasoning}
            />

            <GlobalChatCompose
              input={input}
              setInput={setInput}
              attachedImage={attachedImage}
              setAttachedImage={setAttachedImage}
              isSending={isSending}
              imageDisabled={imageDisabled}
              handleSend={handleSend}
              textareaRef={textareaRef}
              fileRef={fileRef}
              useReasoning={useReasoning}
              setUseReasoning={setUseReasoning}
              useWebSearch={useWebSearch}
              setUseWebSearch={setUseWebSearch}
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
