import { create } from "zustand";

interface StreamingTextState {
  streamingMessageId: string | null;
  streamedMessageText: string;
  streamedThought: string;
  isThinking: boolean;
  thinkingTime: number;
  setStreamUpdate: (data: Partial<{
    streamingMessageId: string | null;
    streamedMessageText: string;
    streamedThought: string;
    isThinking: boolean;
    thinkingTime: number;
  }>) => void;
  resetStream: () => void;
}

export const useStreamingTextStore = create<StreamingTextState>((set) => ({
  streamingMessageId: null,
  streamedMessageText: "",
  streamedThought: "",
  isThinking: false,
  thinkingTime: 0,
  setStreamUpdate: (data) => set(data),
  resetStream: () =>
    set({
      streamingMessageId: null,
      streamedMessageText: "",
      streamedThought: "",
      isThinking: false,
      thinkingTime: 0,
    }),
}));
