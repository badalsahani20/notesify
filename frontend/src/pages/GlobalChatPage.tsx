import { useEffect, useRef, useState } from "react";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";
import { useTypewriter } from "@/hooks/ui/useTypewriter";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { Message } from "@/components/ai/types";
import { STUDENT_PROMPTS, DEV_PROMPTS } from "@/lib/constants";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { GlobalChatSidebar } from "@/components/chat/GlobalChatSidebar";
import { GlobalChatMessages } from "@/components/chat/GlobalChatMessages";
import { GlobalChatCompose } from "@/components/chat/GlobalChatCompose";


const GlobalChatPage = () => {
  const {
    sessions, sessionsLoading,
    activeSessionId, messages, messagesLoading,
    isSending, attachedImage, imageDisabled,
    fetchSessions, loadSession, startNewChat, sendMessage, setAttachedImage,
    useReasoning, setUseReasoning,
    useWebSearch, setUseWebSearch,
  } = useGlobalChatStore();

  const [input, setInput] = useState("");
  const [prompts, setPrompts] = useState({ students: STUDENT_PROMPTS, devs: DEV_PROMPTS });

  const isMobile = useMediaQuery("(max-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      api.get("/public/prompts")
        .then(res => {
          if (res.data.success) {
            setPrompts({
              students: res.data.data.studentPrompts,
              devs: res.data.data.devPrompts
            });
          }
        })
        .catch(() => { }); // Keep fallbacks on error
    });
  }, [fetchSessions]);


  const handleSend = () => {
    // Keep the submitted Markdown exactly as authored. Only use trim() to
    // decide whether the composer is empty; it must not rewrite the payload.
    if (!input.trim() && !attachedImage) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(input, attachedImage);
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
        {/* Dim moving purplish gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[80px] animate-blob-drift" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[40%] right-[10%] w-[250px] h-[250px] rounded-full bg-fuchsia-600/10 blur-[80px] animate-blob-drift" style={{ animationDuration: '10s', animationDelay: '1s' }} />
          <div className="absolute bottom-[10%] left-[30%] w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[80px] animate-blob-drift" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        </div>

        {/* Floating Sidebar Toggle */}
        <button
          className="absolute top-4 left-4 z-50 p-2 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>

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
          fullWidthAssistant
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
    </div>
  );
};

export default GlobalChatPage;
