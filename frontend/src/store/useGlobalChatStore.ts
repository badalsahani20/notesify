import { create } from "zustand";
import api from "@/lib/api";
import { parseIrisResponse } from "../utils/parseIrisResponse";
import { prepareChatImage } from "@/utils/uploadImage";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { executeClientTool } from "@/services/ai/clientToolExecutor";

import type { IrisSegment, ToolCallRecord, ChatArtifact } from "@/components/ai/types";

// Re-export so existing imports from this store path keep working
export type { IrisSegment, ChatArtifact };

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
  toolCalls?: ToolCallRecord[];
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

  // Artifacts (split panel for notes, pdfs, etc.)
  activeArtifact: ChatArtifact | null;
  setActiveArtifact: (artifact: ChatArtifact | null) => void;

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
  activeArtifact: null,
  setActiveArtifact: (artifact) => set({ activeArtifact: artifact }),

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
      if (data.data.chatMode === "study" || data.data.chatMode === "casual") {
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
      const { API_BASE_URL } = await import("@/lib/api");

      const currentArtifact = get().activeArtifact;
      let currentNoteContext = currentArtifact?.id
        ? { id: currentArtifact.id, title: currentArtifact.title }
        : undefined;

      // Fallback: If no active artifact in chat, check if a note is currently opened in the workspace
      if (!currentNoteContext) {
        try {
          const { activeNoteId } = (await import("./useNoteStore")).useNoteStore.getState();
          if (activeNoteId) {
            const { queryClient } = await import("@/lib/queryClient");
            const note = queryClient.getQueryData<any>(["note", activeNoteId]);
            if (note) {
              currentNoteContext = { id: note._id, title: note.title };
            }
          }
        } catch (_) {}
      }

      // Collect verified tool execution outcomes from recent messages to keep LLM context in sync
      const clientToolResults: Array<{ toolCallId?: string; tool: string; status: string; data?: any; error?: string }> = [];
      const prevAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0);
      if (prevAssistantMsg?.toolCalls) {
        for (const tc of prevAssistantMsg.toolCalls) {
          if (tc.status) {
            clientToolResults.push({
              toolCallId: tc.id,
              tool: tc.tool,
              status: tc.status,
              data: tc.data ? { _id: tc.data._id, title: tc.data.title } : undefined,
              error: tc.error,
            });
          }
        }
      }

      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
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
          currentNote: currentNoteContext,
          clientToolResults,
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to AI");
      if (!response.body) throw new Error("No response body");

      // 🆔 Catch early sessionId from header
      const newSessionId = response.headers.get("X-Session-Id");
      const effectiveSessionId = newSessionId || requestSessionId;
      if (newSessionId) {
        // Derive clean optimistic title without transcript/filler prefixes
        const cleanInitial = text
          .replace(/^(user|assistant|system)\s*:\s*/gi, "")
          .replace(/\b(hey|hello|hi|yo|sup|can you|could you|please)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        const optimisticTitle = cleanInitial
          ? cleanInitial.slice(0, 42)
          : "New Chat";

        set((state) => ({
          activeSessionId: newSessionId,
          sessions: state.sessions.some((session) => session._id === newSessionId)
            ? state.sessions
            : [
                {
                  _id: newSessionId,
                  title: optimisticTitle,
                  updatedAt: new Date().toISOString(),
                },
                ...state.sessions,
              ],
        }));
      }

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body, {
          throttleMs: 60,
          onToolCall: ({ id, args, execution, tool, quizData, query, url, citations }) => {
            if (execution === "local" && args) {
              executeClientTool(tool, args).then((res) => {
                // Report verified tool execution result back to session history on server
                const targetSessionId = get().activeSessionId || effectiveSessionId;
                if (targetSessionId) {
                  fetch(`${API_BASE_URL}/ai/chat/tool-result`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      sessionId: targetSessionId,
                      toolCallId: id,
                      tool,
                      status: res.success ? "success" : "error",
                      data: res.data ? { _id: res.data._id, title: res.data.title } : undefined,
                      error: res.error,
                    }),
                  }).catch(() => {});
                }

                if (res?.data) {
                  // If a note was created or updated, automatically open it in the split artifact panel
                  if (tool === "create_note" || tool === "update_note") {
                    set({
                      activeArtifact: {
                        type: "note",
                        id: res.data._id,
                        title: res.data.title,
                        content: res.data.content,
                      },
                    });
                  }
                }

                set((state) => ({
                  messages: state.messages.map((m) => {
                    if (m.id !== aiMsgId) return m;
                    const existing = m.toolCalls ?? [];
                    const idx = existing.findIndex((tc) => (id ? tc.id === id : tc.tool === tool));
                    if (idx !== -1) {
                      const updated = [...existing];
                      updated[idx] = {
                        ...updated[idx],
                        data: res.data,
                        status: res.success ? "success" : "error",
                        error: res.error,
                      };
                      return { ...m, toolCalls: updated };
                    }
                    return m;
                  }),
                }));
              });
            }

            set((state) => ({
              messages: state.messages.map((m) => {
                if (m.id !== aiMsgId) return m;
                const existingCalls = m.toolCalls ?? [];
                if (tool === "web_citations" && citations) {
                  const filtered = existingCalls.filter((tc) => tc.tool !== "web_citations");
                  return {
                    ...m,
                    toolCalls: [...filtered, { tool, citations }],
                  };
                }
                const existingIdx = existingCalls.findIndex((tc) => (id ? tc.id === id : tc.tool === tool));
                if (existingIdx !== -1) {
                  const updated = [...existingCalls];
                  updated[existingIdx] = {
                    ...updated[existingIdx],
                    args: args ?? updated[existingIdx].args,
                    query: query ?? updated[existingIdx].query,
                    url: url ?? updated[existingIdx].url,
                  };
                  return { ...m, toolCalls: updated };
                }
                return {
                  ...m,
                  toolCalls: [...existingCalls, { id, args, execution, tool, quizData, query, url, citations }],
                };
              }),
            }));
          },
          onUpdate: ({ fullText, fullThought, isThinking, thinkingTime }) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      text: fullText,
                      thought: fullThought,
                      isThinking,
                      thinkingTime,
                    }
                  : m
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
          m.id === aiMsgId
            ? { 
                ...m, 
                text: fullText,
                thought: fullThought,
                isThinking: false,
                thinkingTime: finalThinkingTime,
                segments,
                skipAnimation: true 
              }
            : m
        ),
      }));

      const userTurnCount = get().messages.filter((message) => message.role === "user").length;

      // The backend generates/refines a high-quality title after conversation turns.
      // Fetch updated sessions once title generation completes in the background.
      if (effectiveSessionId && (userTurnCount === 1 || userTurnCount === 2)) {
        window.setTimeout(() => {
          get().fetchSessions();
        }, 2200);
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
