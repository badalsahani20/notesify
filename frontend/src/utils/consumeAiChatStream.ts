import { SseStreamParser } from "@/utils/sseParser";

export type WebCitation = {
  url: string;
  title: string;
  content?: string;
};

export type ToolCallEvent = {
  id?: string;
  tool: string;
  args?: Record<string, any>;
  execution?: "local" | "server" | "client";
  purpose?: "quiz" | "clarification" | "preference" | "ranking";
  status?: "pending" | "executing" | "success" | "error";
  data?: any;
  error?: string;
  quizData?: any;
  questions?: any;
  title?: string;
  query?: string;
  url?: string;
  citations?: WebCitation[];
};

type MetadataEvent = {
  pdfContext?: string;
};

type StreamSnapshot = {
  fullText: string;
  fullThought: string;
  isThinking: boolean;
  thinkingTime: number;
};

type ConsumeAiChatStreamOptions = {
  throttleMs?: number;
  onUpdate?: (snapshot: StreamSnapshot) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onMetadata?: (event: MetadataEvent) => void;
};

export const consumeAiChatStream = async (
  body: ReadableStream<Uint8Array>,
  options: ConsumeAiChatStreamOptions = {},
) => {
  const { throttleMs = 60, onUpdate, onToolCall, onMetadata } = options;
  const reader = body.getReader();
  const parser = new SseStreamParser();
  const startTime = Date.now();
  let fullText = "";
  let fullThought = "";
  let lastUpdateTime = 0;
  let thinkingEndTime = 0;

  const getThinkingTime = () =>
    thinkingEndTime
      ? Math.floor((thinkingEndTime - startTime) / 1000)
      : Math.floor((Date.now() - startTime) / 1000);

  const emitUpdate = () => {
    onUpdate?.({
      fullText,
      fullThought,
      isThinking: fullText.length === 0,
      thinkingTime: getThinkingTime(),
    });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const events = parser.processChunk(value);

    for (const data of events) {
      if (data.type === "error") {
        throw new Error(data.message || "AI service error");
      }

      if (data.type === "tool_call" && data.tool) {
        onToolCall?.({
          id: (data as any).id,
          tool: data.tool,
          args: (data as any).args,
          execution: (data as any).execution,
          purpose: (data as any).purpose,
          status: (data as any).status,
          data: (data as any).data,
          error: (data as any).error,
          quizData: (data as any).quizData,
          questions: (data as any).questions ?? (data as any).quizData,
          title: (data as any).title,
          query: (data as any).query,
          url: (data as any).url,
          citations: (data as any).citations,
        });
        continue;
      }

      if (data.type === "metadata") {
        onMetadata?.({ pdfContext: data.pdfContext });
        continue;
      }

      const delta = data.choices?.[0]?.delta;
      const content = delta?.content || "";
      const reasoning = delta?.reasoning || "";

      if (!content && !reasoning) continue;

      if (content && fullText.length === 0) {
        thinkingEndTime = Date.now();
      }

      fullText += content;
      fullThought += reasoning;

      const now = Date.now();
      if (now - lastUpdateTime > throttleMs) {
        emitUpdate();
        lastUpdateTime = now;
      }
    }
  }

  emitUpdate();

  return {
    fullText,
    fullThought,
    thinkingTime:
      thinkingEndTime
        ? Math.floor((thinkingEndTime - startTime) / 1000)
        : fullThought
          ? Math.floor((Date.now() - startTime) / 1000)
          : 0,
  };
};
