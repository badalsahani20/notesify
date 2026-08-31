import { create } from "zustand";
import api from "@/lib/api";
import { parseIrisResponse } from "../utils/parseIrisResponse";
import { prepareChatImage } from "@/utils/uploadImage";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";

import type { IrisSegment } from "@/components/ai/types";

// Re-export so existing imports from this store path keep working
export type { IrisSegment };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  segments?: IrisSegment[];
  skipAnimation?: boolean;
  thought?: string;
  isThinking?: boolean;
  thinkingTime?: number;
  toolCalls?: { tool: string; quizData?: any }[];
};

export type ChatSession = {
  _id: string;
  title: string;
  updatedAt: string;
};

type GlobalChatStore = {
  // Sidebar
  sessions: ChatSession[];
  sessionsLoading: boolean;

  // Active chat
  activeSessionId: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;

  // Compose
  isSending: boolean;
  attachedImage: string | null;
  imageDisabled: boolean;
  useReasoning: boolean;
  useWebSearch: boolean;
  chatMode: "study" | "casual";

  // Actions
  fetchSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  startNewChat: () => void;
  sendMessage: (text: string, image?: string | null) => Promise<void>;
  setAttachedImage: (img: string | null) => void;
  setUseReasoning: (val: boolean) => void;
  setUseWebSearch: (val: boolean) => void;
  setChatMode: (mode: "study" | "casual") => void;
  reset: () => void;
};

export const useGlobalChatStore = create<GlobalChatStore>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  activeSessionId: null,
  messages: [],
  messagesLoading: false,
  isSending: false,
  attachedImage: null,
  imageDisabled: false,
  useReasoning: false, 
  useWebSearch: false,
  chatMode: "casual",

  fetchSessions: async () => {
    set({ sessionsLoading: true });
    try {
      const { data } = await api.get("/ai/sessions");
      set({ sessions: data.data.sessions });
    } catch {
      // silently fail — sidebar just stays empty
    } finally {
      set({ sessionsLoading: false });
    }
  },

  loadSession: async (sessionId: string) => {
    set({ messagesLoading: true, activeSessionId: sessionId, messages: [] });
    try {
      const { data } = await api.get(`/ai/chat/session/${sessionId}`);
      
      // Inherit the chatMode from the loaded session if available
      if (data.data.chatMode) {
        set({ chatMode: data.data.chatMode });
      }

      const mapped: ChatMessage[] = data.data.messages.map((m: { role: string; content: string; segments?: IrisSegment[] }) => {
        const imageMatch = m.content.match(/^\[Attached Image\]\((https?:\/\/[^)]+)\)\s*/i);
        const imageUrl = imageMatch?.[1];
        const text = imageUrl
          ? m.content.replace(imageMatch[0], "").trim()
          : m.content;

        return {
          id: crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          text,
          imageUrl,
          segments: m.segments || (m.role === "assistant" ? parseIrisResponse(m.content) : undefined),
          toolCalls: (m as any).toolCalls,
          skipAnimation: true,
        };
      });
      set({ messages: mapped });
    } catch {
      set({ messages: [] });
    } finally {
      set({ messagesLoading: false });
    }
  },

  startNewChat: () => {
    set({ activeSessionId: null, messages: [], attachedImage: null });
  },

  sendMessage: async (text: string, image?: string | null) => {
    const { activeSessionId, messages } = get();
    const requestSessionId = activeSessionId;
    const { imageForApi, imageUrl } = await prepareChatImage(image);

    // 1. Optimistically add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      imageUrl,
    };

    // 2. Add empty assistant message for streaming
    const aiMsgId = crypto.randomUUID();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: "assistant",
      text: "", // Will be filled chunk by chunk
      skipAnimation: true, // 🚀 Stops the jitter
      isThinking: true,
      thinkingTime: 0,
    };

    set({ 
      messages: [...messages, userMsg, aiMsg], 
      isSending: true, 
      attachedImage: null 
    });

    try {
      const { accessToken } = (await import("./useAuthStore")).useAuthStore.getState();

      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId,
          imageBase64: imageForApi || undefined,
          stream: true,
          useReasoning: get().useReasoning,
          enableWeb: get().useWebSearch,
          chatMode: get().chatMode,
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to AI");
      if (!response.body) throw new Error("No response body");

      // 🆔 Catch early sessionId from header
      const newSessionId = response.headers.get("X-Session-Id");
      const effectiveSessionId = newSessionId || requestSessionId;
      if (newSessionId) {
        set((state) => ({
          activeSessionId: newSessionId,
          sessions: state.sessions.some((session) => session._id === newSessionId)
            ? state.sessions
            : [
                {
                  _id: newSessionId,
                  title: text.slice(0, 48) || "New Chat",
                  updatedAt: new Date().toISOString(),
                },
                ...state.sessions,
              ],
        }));
      }

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body, {
          throttleMs: 60,
          onToolCall: ({ tool, quizData }) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === aiMsgId
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), { tool, quizData }] }
                  : m
              ),
            }));
          },
          onUpdate: ({ fullText, fullThought, isThinking, thinkingTime }) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === aiMsgId ? {
                  ...m,
                  text: fullText,
                  thought: fullThought,
                  isThinking,
                  thinkingTime,
                } : m
              ),
            }));
          },
        });

      const segments = parseIrisResponse(fullText);

      set((state) => ({
        isSending: false,
        sessions: effectiveSessionId
          ? state.sessions.map((session) =>
              session._id === effectiveSessionId
                ? { ...session, updatedAt: new Date().toISOString() }
                : session
            )
          : state.sessions,
        messages: state.messages.map((m) =>
          m.id === aiMsgId ? { 
            ...m, 
            text: fullText,
            thought: fullThought,
            isThinking: false,
            thinkingTime: finalThinkingTime,
            segments,
            skipAnimation: true 
          } : m
        ),
      }));

      const userTurnCount = get().messages.filter((message) => message.role === "user").length;

      // The backend generates a title after 2 user turns.
      if (effectiveSessionId && userTurnCount >= 2) {
        window.setTimeout(() => {
          get().fetchSessions();
        }, 2500);
      }

    } catch (err: any) {
      set((state) => ({
        isSending: false,
        messages: state.messages.map((m) =>
          m.id === aiMsgId ? { ...m, text: "⚠️ Something went wrong. Please try again." } : m
        ),
      }));
    }
  },

  setAttachedImage: (img) => set({ attachedImage: img }),
  setUseReasoning: (val) => set({ useReasoning: val }),
  setUseWebSearch: (val) => set({ useWebSearch: val }),
  setChatMode: (mode) => set({ chatMode: mode }),
  reset: () => set({
    sessions: [],
    sessionsLoading: false,
    activeSessionId: null,
    messages: [],
    messagesLoading: false,
    isSending: false,
    attachedImage: null,
    imageDisabled: false,
  }),
}));
