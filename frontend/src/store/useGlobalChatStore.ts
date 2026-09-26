import { create } from "zustand";
import api from "@/lib/api";
import { parseIrisResponse } from "../utils/parseIrisResponse";
import { prepareChatImage } from "@/utils/uploadImage";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { executeClientTool } from "@/services/ai/clientToolExecutor";

import type {
  IrisSegment,
  ToolCallRecord,
  ChatArtifact,
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

  // Active chat
  activeSessionId: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  pendingInteraction: PendingInteraction | null;

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
  answerInteraction: (answer: string) => Promise<void>;
  stopGeneration: () => void;
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
  pendingInteraction: null,
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
    set({
      messagesLoading: true,
      activeSessionId: sessionId,
      messages: [],
      pendingInteraction: null,
    });
    try {
      const { data } = await api.get(`/ai/chat/session/${sessionId}`);

      set({ pendingInteraction: data.data.pendingInteraction || null });
      
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
      set({ messages: [], pendingInteraction: null });
    } finally {
      set({ messagesLoading: false });
    }
  },

  startNewChat: () => {
    set({
      activeSessionId: null,
      messages: [],
      pendingInteraction: null,
      attachedImage: null,
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
      console.info("[IrisInteraction] resuming request", {
        interactionId: interaction.interactionId,
        endpoint: `${API_BASE_URL}/ai/interactions/:interactionId/answer`,
      });
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

      console.info("[IrisInteraction] resume response", {
        interactionId: interaction.interactionId,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) throw new Error("This interaction is no longer available");
      if (!response.body) throw new Error("No response body");

      const { fullText, fullThought, thinkingTime: finalThinkingTime } =
        await consumeAiChatStream(response.body, {
          throttleMs: 60,
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
        messages: state.messages.map((message) =>
          message.id === aiMsgId
            ? {
                ...message,
                text: fullText,
                thought: fullThought,
                isThinking: false,
                thinkingTime: finalThinkingTime,
                segments: parseIrisResponse(fullText),
              }
            : message,
        ),
      }));
      console.info("[IrisInteraction] stream completed; reloading session", {
        interactionId: interaction.interactionId,
        sessionId: activeSessionId,
        responseLength: fullText.length,
      });
      await get().loadSession(activeSessionId);
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
      await get().loadSession(activeSessionId).catch(() => {});
    } finally {
      if (activeChatAbortController === abortController) {
        activeChatAbortController = null;
      }
    }
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

    const abortController = new AbortController();
    activeChatAbortController = abortController;

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
          signal: abortController.signal,
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
          onToolCall: ({ id, interactionId, checkpointId, args, execution, purpose, status, data, error, tool, quizData, questions, title, query, url, citations }) => {
            if (tool === "ask_question" && interactionId && checkpointId) {
              const questionList = (questions ?? quizData) as InteractiveQuestion[] | undefined;
              const firstQuestion = questionList?.[0];
              console.info("[IrisInteraction] pending question received", {
                interactionId,
                checkpointId,
                questionCount: questionList?.length ?? 0,
                sessionId: get().activeSessionId || effectiveSessionId,
              });
              set({
                pendingInteraction: {
                  interactionId,
                  checkpointId,
                  type: "ask_question",
                  purpose,
                  title,
                  question: firstQuestion?.question ?? "",
                  options: firstQuestion?.options ?? [],
                  questions: questionList,
                  status: "pending",
                },
              });
            }

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
                        data: res.data ?? updated[idx].data,
                        status: res.success ? "success" : "error",
                        error: res.error ?? updated[idx].error,
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
                const existingIdx = id
                  ? existingCalls.findIndex((tc) => tc.id === id)
                  : existingCalls.findIndex((tc) => tc.tool === tool && tc.status !== "success" && tc.status !== "error");
                const correlatedIdx = existingIdx === -1 && id
                  ? existingCalls.findIndex((tc) => !tc.id && tc.tool === tool && tc.status !== "success" && tc.status !== "error")
                  : existingIdx;
                if (correlatedIdx !== -1) {
                  const updated = [...existingCalls];
                    updated[correlatedIdx] = {
                      ...updated[correlatedIdx],
                      id: id ?? updated[correlatedIdx].id,
                      args: args ?? updated[correlatedIdx].args,
                      query: query ?? updated[correlatedIdx].query,
                      url: url ?? updated[correlatedIdx].url,
                      execution: execution ?? updated[correlatedIdx].execution,
                      purpose: purpose ?? updated[correlatedIdx].purpose,
                      status: status ?? updated[correlatedIdx].status,
                      data: data ?? updated[correlatedIdx].data,
                      error: error ?? updated[correlatedIdx].error,
                    };
                  return { ...m, toolCalls: updated };
                }
                return {
                  ...m,
                  toolCalls: [...existingCalls, {
                    id,
                    args,
                    execution,
                    purpose,
                    tool,
                    status: status ?? "pending",
                    data,
                    error,
                    quizData,
                    questions: questions ?? quizData,
                    title,
                    query,
                    url,
                    citations,
                  }],
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
        set((state) => ({
          isSending: false,
          messages: state.messages.map((m) =>
            m.id === aiMsgId ? { ...m, text: "⚠️ Something went wrong. Please try again." } : m
          ),
        }));
      }
    } finally {
      if (activeChatAbortController === abortController) {
        activeChatAbortController = null;
      }
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
    pendingInteraction: null,
    isSending: false,
    attachedImage: null,
    imageDisabled: false,
  }),
}));
