import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNoteQuery } from "@/hooks/notes/useNotesQuery";
import { useUpdateNoteMutation } from "@/hooks/notes/useNotesMutations";
import type { Message, ChatHistoryMessage } from "@/components/ai/types";
import type { Note } from "@/store/useNoteStore";

export const getPersistedHistoryFromMessages = (messages: Message[]) =>
  messages
    .map((message, index) => {
      const hasUserMessageAfter = messages
        .slice(index + 1)
        .some((nextMessage) => nextMessage.role === "user");

      const toolCalls = message.toolCalls?.map((toolCall) => {
        const isQuizTool =
          toolCall.tool === "ask_question" ||
          toolCall.tool === "render_quiz" ||
          toolCall.tool === "generate_quiz";

        // Keep the active quiz payload until the user answers. Once a later
        // user message exists, retain only the completed tool metadata so the
        // prompt cannot reopen after a refresh.
        if (isQuizTool && hasUserMessageAfter && (toolCall.questions || toolCall.quizData)) {
          const { questions, quizData, ...completedToolCall } = toolCall;
          return { ...completedToolCall, completed: true };
        }

        return toolCall;
      });

      return {
        id: message.id,
        role: message.role as "user" | "assistant",
        content: message.text,
        ...(message.role === "assistant" && message.segments ? { segments: message.segments } : {}),
        ...(message.role === "assistant" && toolCalls ? { toolCalls } : {}),
      };
    })
    .filter((message) => message.id !== "welcome")
    .slice(-50);

interface UseAiChatSessionOptions {
  noteId: string;
  isNew: boolean;
  messagesRef: React.MutableRefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryMessage[]>>;
}

export const useAiChatSession = ({
  noteId,
  isNew,
  messagesRef,
  setMessages,
  setChatHistory,
}: UseAiChatSessionOptions) => {
  const queryClient = useQueryClient();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { data: activeNote } = useNoteQuery(isNew ? "" : noteId);
  const { mutateAsync: updateNoteAsync } = useUpdateNoteMutation();

  const loadHistory = useCallback(() => {
    if (activeNote?.chatHistory && activeNote.chatHistory.length > 0) {
      const existingIds = new Set(messagesRef.current.map((m) => m.id));

      const historicMessages = activeNote.chatHistory
        .map((m: any) => ({
          id: m.id || m._id || crypto.randomUUID(),
          role: m.role,
          text: m.content as string,
          segments: m.segments,
          toolCalls: m.toolCalls,
          skipAnimation: true,
        }))
        .filter((m: any) => !existingIds.has(m.id));

      const nextMessages = [
        ...(messagesRef.current.find((m) => m.id === "welcome") ? [messagesRef.current.find((m) => m.id === "welcome")!] : []),
        ...historicMessages,
        ...messagesRef.current.filter((m) => m.id !== "welcome"),
      ];

      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      setChatHistory(
        activeNote.chatHistory.map((m: any) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        }))
      );
      setHistoryLoaded(true);
    }
  }, [activeNote?.chatHistory, messagesRef, setChatHistory, setMessages]);

  useEffect(() => {
    if (historyLoaded) return;
    if (!activeNote?.chatHistory) return;

    if (activeNote.chatHistory.length === 0) {
      setHistoryLoaded(true);
      return;
    }

    const hasQuizInHistory = activeNote.chatHistory.some(
      (m: any) => m.toolCalls?.some((tc: any) =>
        tc.tool === "ask_question" || tc.tool === "render_quiz" || tc.tool === "generate_quiz"
      )
    );
    if (hasQuizInHistory) {
      loadHistory();
    }
  }, [activeNote?.chatHistory, historyLoaded, loadHistory]);

  useEffect(() => {
    setHistoryLoaded(false);
    const nextMessages: Message[] = [
      { id: "welcome", role: "assistant", text: "Hi! How can i help you today?" },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setChatHistory([]);
  }, [noteId, messagesRef, setChatHistory, setMessages]);

  const startNewChat = async () => {
    const nextMessages: Message[] = [
      { id: "welcome", role: "assistant", text: "Hi! How can i help you today?" },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setChatHistory([]);
    setHistoryLoaded(true);
    const latestNote = (queryClient.getQueryData(["note", noteId]) as Note | undefined) ?? activeNote;
    if (latestNote) {
      void updateNoteAsync({ noteId, updates: { chatHistory: [] }, version: latestNote.version });
    }
    toast.success("Chat history cleared");
  };

  const persistMessages = (updatedMessages: Message[]) => {
    if (isNew) return;
    const newDbHistory = getPersistedHistoryFromMessages(updatedMessages);
    const existingDbHistory = !historyLoaded
      ? (activeNote?.chatHistory ?? []).map((m: any) => ({
          id: m.id || m._id,
          role: m.role,
          content: m.content,
          ...(m.segments ? { segments: m.segments } : {}),
          ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        }))
      : [];
    const dbHistory = [...existingDbHistory, ...newDbHistory].slice(-50);

    const latestNote = (queryClient.getQueryData(["note", noteId]) as Note | undefined) ?? activeNote;
    if (latestNote) {
      void updateNoteAsync({
        noteId,
        updates: { chatHistory: dbHistory as Note["chatHistory"] },
        version: latestNote.version,
      });
    }
  };

  const hasHistory = (activeNote?.chatHistory?.length ?? 0) > 0 && !historyLoaded;
  const historyCount = activeNote?.chatHistory?.length ?? 0;

  return {
    activeNote,
    historyLoaded,
    hasHistory,
    historyCount,
    loadHistory,
    startNewChat,
    persistMessages,
  };
};
