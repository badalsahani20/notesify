import { create } from "zustand";
import api from "@/lib/api";
import { toast } from "sonner";
import { parseIrisResponse } from "../utils/parseIrisResponse";
import { prepareChatImage } from "@/utils/uploadImage";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { startGlobalChatRequest } from "@/services/ai/chatRequest";
import { createChatToolHandler } from "@/services/ai/chatToolHandler";

import type {
  IrisSegment,
  ToolCallRecord,
  ChatArtifact,
  ChatAttachmentBundle,
  InteractiveQuestion,
} from "@/components/ai/types";

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

export type PendingInteraction = {
  interactionId: string;
  runId?: string;
  type: "ask_question";
  purpose?: "quiz" | "clarification" | "preference" | "ranking";
  title?: string | null;
  question: string;
  options: string[];
  questions?: InteractiveQuestion[];
  status: "pending" | "resuming" | "answered" | "cancelled" | "expired";
  answer?: unknown;
  checkpointId: string;
};

let activeChatAbortController: AbortController | null = null;

type GlobalChatStore = {
  // Sidebar
  sessions: ChatSession[];
  sessionsLoading: boolean;
  sessionsLoadingMore: boolean;
  sessionsHasMore: boolean;
  sessionsCursor: string | null;

  // Active chat
  activeSessionId: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  pendingInteraction: PendingInteraction | null;

  // Compose
  isSending: boolean;
  attachedImage: string | null;
  attachedDoc: ChatAttachmentBundle | null;
  imageDisabled: boolean;
  useReasoning: boolean;
  useWebSearch: boolean;
  chatMode: "study" | "casual";

  // Artifacts (split panel for notes, pdfs, etc.)
  activeArtifact: ChatArtifact | null;
  setActiveArtifact: (artifact: ChatArtifact | null) => void;

  // Actions
  fetchSessions: (options?: { silent?: boolean }) => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  loadSession: (sessionId: string, options?: { background?: boolean }) => Promise<void>;
  startNewChat: () => void;
  sendMessage: (text: string, image?: string | null, chatAttachmentId?: string | null) => Promise<void>;
  answerInteraction: (answer: string) => Promise<void>;
  stopGeneration: () => void;
  setAttachedImage: (img: string | null) => void;
  setAttachedDoc: (folder: ChatAttachmentBundle | null) => void;
  uploadDoc: (files: File[]) => Promise<void>;
  setUseReasoning: (val: boolean) => void;
  setUseWebSearch: (val: boolean) => void;
  setChatMode: (mode: "study" | "casual") => void;
  reset: () => void;
};

export const useGlobalChatStore = create<GlobalChatStore>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  sessionsLoadingMore: false,
  sessionsHasMore: false,
  sessionsCursor: null,
  activeSessionId: null,
  messages: [],
  messagesLoading: false,
  pendingInteraction: null,
  isSending: false,
  attachedImage: null,
  attachedDoc: null,
  imageDisabled: false,
  useReasoning: false, 
  useWebSearch: false,
  chatMode: "casual",
  activeArtifact: null,
  setActiveArtifact: (artifact) => set({ activeArtifact: artifact }),

  fetchSessions: async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      set({ sessionsLoading: true });
    }
    try {
      const { data } = await api.get("/ai/sessions", { params: { limit: 30 } });
      const currentSessions = get().sessions;
      const newSessions: ChatSession[] = data.data.sessions || [];
      const hasChanged =
        currentSessions.length !== newSessions.length ||
        currentSessions.some(
          (s, i) =>
            s._id !== newSessions[i]?._id ||
            s.title !== newSessions[i]?.title ||
            s.updatedAt !== newSessions[i]?.updatedAt
        );

      if (hasChanged) {
        set({ sessions: newSessions });
      }
      set({
        sessionsHasMore: Boolean(data.data.hasMore),
        sessionsCursor: data.data.nextCursor || null,
      });
    } catch {
      // silently fail — sidebar just stays empty
    } finally {
      if (!options?.silent) {
        set({ sessionsLoading: false });
      }
    }
  },

  loadMoreSessions: async () => {
    const { sessionsLoadingMore, sessionsHasMore, sessionsCursor } = get();
    if (sessionsLoadingMore || !sessionsHasMore || !sessionsCursor) return;

    set({ sessionsLoadingMore: true });
    try {
      const { data } = await api.get("/ai/sessions", {
        params: { limit: 30, cursor: sessionsCursor },
      });
      const incoming: ChatSession[] = data.data.sessions || [];
      const existingIds = new Set(get().sessions.map((session) => session._id));
      const appended = incoming.filter((session) => !existingIds.has(session._id));

      set((state) => ({
        sessions: [...state.sessions, ...appended],
        sessionsHasMore: Boolean(data.data.hasMore),
        sessionsCursor: data.data.nextCursor || null,
      }));
    } catch {
      // Keep the already-loaded sessions visible.
    } finally {
      set({ sessionsLoadingMore: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await api.delete(`/ai/sessions/${sessionId}`);
      const wasActive = get().activeSessionId === sessionId;

      set((state) => ({
        sessions: state.sessions.filter((session) => session._id !== sessionId),
        ...(wasActive
          ? {
              activeSessionId: null,
              messages: [],
              pendingInteraction: null,
              attachedImage: null,
              attachedDoc: null,
            }
          : {}),
      }));
    } catch {
      toast.error("Could not delete this chat. Please try again.");
    }
  },

  loadSession: async (sessionId: string, options?: { background?: boolean }) => {
    const isSameSession = get().activeSessionId === sessionId && get().messages.length > 0;
    const isBackground = options?.background || isSameSession;

    if (!isBackground) {
      set({
        messagesLoading: true,
        activeSessionId: sessionId,
        messages: [],
        pendingInteraction: null,
      });
    } else {
      set({ activeSessionId: sessionId });
    }
    try {
      const { data } = await api.get(`/ai/chat/session/${sessionId}`);

      set({
        pendingInteraction: data.data.pendingInteraction || null,
        attachedDoc: null,
      });
      
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
      if (!isBackground) {
        set({ messages: [], pendingInteraction: null });
      }
    } finally {
      if (!isBackground) {
        set({ messagesLoading: false });
      }
    }
  },

  startNewChat: () => {
    set({
      activeSessionId: null,
      messages: [],
      pendingInteraction: null,
      attachedImage: null,
      attachedDoc: null,
    });
  },

  stopGeneration: () => {
    if (!activeChatAbortController) return;
    console.info("[IrisChat] generation stopped by user");
    activeChatAbortController.abort();
  },

  answerInteraction: async (answer: string) => {
    const { activeSessionId, pendingInteraction, messages, isSending } = get();
    if (!activeSessionId || !pendingInteraction || isSending || !answer.trim()) {
      console.warn("[IrisInteraction] answer ignored", {
        hasSession: Boolean(activeSessionId),
        hasPendingInteraction: Boolean(pendingInteraction),
        isSending,
        hasAnswer: Boolean(answer.trim()),
      });
      return;
    }

    const interaction = pendingInteraction;
    console.info("[IrisInteraction] answer submitted", {
      interactionId: interaction.interactionId,
      checkpointId: interaction.checkpointId,
      sessionId: activeSessionId,
      answerLength: answer.length,
    });
    const aiMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: answer,
    };
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: "assistant",
      text: "",
      skipAnimation: true,
      isThinking: true,
      thinkingTime: 0,
    };

    set({
      messages: [...messages, userMsg, aiMsg],
      isSending: true,
      pendingInteraction: { ...interaction, status: "resuming", answer },
    });

    const abortController = new AbortController();
    activeChatAbortController = abortController;

    try {
      const { accessToken } = (await import("./useAuthStore")).useAuthStore.getState();
      const { API_BASE_URL } = await import("@/lib/api");
      const response = await fetch(
        `${API_BASE_URL}/ai/interactions/${interaction.interactionId}/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ answer }),
          signal: abortController.signal,
        },
      );

      if (!response.ok) throw new Error("This interaction is no longer available");
      if (!response.body) throw new Error("No response body");

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body!, {
          onToolCall: ({ tool, id, args, execution, purpose, status, data, error, quizData, questions, title, query, url, citations }) => {
            set((state) => ({
              messages: state.messages.map((message) => {
                if (message.id !== aiMsgId) return message;
                return {
                  ...message,
                  toolCalls: [
                    ...(message.toolCalls ?? []),
                    {
                      id,
                      tool,
                      args,
                      execution,
                      purpose,
                      status: status ?? "pending",
                      data,
                      error,
                      quizData,
                      questions: questions ?? quizData,
                      title,
                      query,
                      url,
                      citations,
                    },
                  ],
                };
              }),
            }));
          },
          onUpdate: ({ fullText: text, fullThought, isThinking, thinkingTime }) => {
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === aiMsgId
                  ? { ...message, text, thought: fullThought, isThinking, thinkingTime }
                  : message,
              ),
            }));
          },
        });

      set((state) => ({
        isSending: false,
        pendingInteraction: null,
        sessions: activeSessionId
          ? state.sessions.map((session) =>
              session._id === activeSessionId
                ? { ...session, updatedAt: new Date().toISOString() }
                : session
            )
          : state.sessions,
        messages: state.messages.map((message) =>
          message.id === aiMsgId
            ? {
                ...message,
                text: fullText,
                thought: fullThought,
                isThinking: false,
                thinkingTime: finalThinkingTime,
                segments: parseIrisResponse(fullText),
                skipAnimation: true,
              }
            : message,
        ),
      }));
      console.info("[IrisInteraction] stream completed", {
        interactionId: interaction.interactionId,
        sessionId: activeSessionId,
        responseLength: fullText.length,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        console.info("[IrisInteraction] resume stream stopped by user", {
          interactionId: interaction.interactionId,
        });
      } else {
        console.error("[IrisInteraction] resume failed", {
          interactionId: interaction.interactionId,
          error: error instanceof Error ? error.message : error,
        });
      }
      set({ isSending: false });
    } finally {
      if (activeChatAbortController === abortController) {
        activeChatAbortController = null;
      }
    }
  },

  sendMessage: async (text: string, image?: string | null, chatAttachmentId?: string | null) => {
    const { activeSessionId, messages } = get();
    const requestSessionId = activeSessionId;
    const { imageForApi, imageUrl } = await prepareChatImage(image);
    const attachmentId = chatAttachmentId || get().attachedDoc?.id || null;

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
      attachedImage: null,
      attachedDoc: null,
    });

    const abortController = new AbortController();
    activeChatAbortController = abortController;
    let effectiveSessionId = requestSessionId;

    try {
      const { response, accessToken, apiBaseUrl } = await startGlobalChatRequest({
        text,
        sessionId: activeSessionId,
        imageForApi: imageForApi || undefined,
        chatAttachmentId: attachmentId || undefined,
        activeArtifact: get().activeArtifact,
        messages,
        useReasoning: get().useReasoning,
        enableWeb: get().useWebSearch,
        chatMode: get().chatMode,
        signal: abortController.signal,
      });

      // 🆔 Catch early sessionId from header
      const newSessionId = response.headers.get("X-Session-Id");
      effectiveSessionId = newSessionId || requestSessionId;
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

      const updateAssistantMessage = (updater: (message: ChatMessage) => ChatMessage) => {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === aiMsgId ? updater(message) : message,
          ),
        }));
      };

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body!, {
          onToolCall: createChatToolHandler({
            accessToken,
            apiBaseUrl,
            effectiveSessionId,
            getTargetSessionId: () => get().activeSessionId,
            setPendingInteraction: (pendingInteraction) => set({ pendingInteraction }),
            setActiveArtifact: (activeArtifact) => set({ activeArtifact }),
            updateAssistantMessage,
          }),
          onUpdate: ({ fullText, fullThought, isThinking, thinkingTime }) => {
            updateAssistantMessage((message) => ({
              ...message,
              text: fullText,
              thought: fullThought,
              isThinking,
              thinkingTime,
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
          get().fetchSessions({ silent: true });
        }, 2200);
      }

    } catch (err: any) {
      if (abortController.signal.aborted) {
        console.info("[IrisRun] chat request stopped by user");
        set((state) => ({
          isSending: false,
          messages: state.messages.map((m) =>
            m.id === aiMsgId ? { ...m, isThinking: false, skipAnimation: true } : m
          ),
        }));
      } else {
        console.error("[IrisRun] chat request failed", {
          name: err?.name,
          message: err?.message,
        });
        const hasStreamedContent = Boolean(get().messages.find((m) => m.id === aiMsgId)?.text);
        set((state) => ({
          isSending: false,
          messages: state.messages.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isThinking: false,
                  text: m.text ? m.text : "⚠️ Something went wrong. Please try again.",
                }
              : m
          ),
        }));

        // Only attempt background session recovery if no content was received
        if (effectiveSessionId && !hasStreamedContent) {
          get().loadSession(effectiveSessionId, { background: true }).catch(() => {});
        }
      }
    } finally {
      if (activeChatAbortController === abortController) {
        activeChatAbortController = null;
      }
    }
  },

  setAttachedImage: (img) => set({ attachedImage: img }),
  setAttachedDoc: (doc) => set({ attachedDoc: doc }),
  uploadDoc: async (files) => {
    const { uploadChatAttachment } = await import("@/services/ai/uploadChatAttachment");
    const doc = await uploadChatAttachment(files);
    set({ attachedDoc: doc });
  },
  setUseReasoning: (val) => set({ useReasoning: val }),
  setUseWebSearch: (val) => set({ useWebSearch: val }),
  setChatMode: (mode) => set({ chatMode: mode }),
  reset: () => set({
    sessions: [],
    sessionsLoading: false,
    sessionsLoadingMore: false,
    sessionsHasMore: false,
    sessionsCursor: null,
    activeSessionId: null,
    messages: [],
    messagesLoading: false,
    pendingInteraction: null,
    isSending: false,
    attachedImage: null,
    attachedDoc: null,
    imageDisabled: false,
  }),
}));
