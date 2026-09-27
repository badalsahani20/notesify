import { SseStreamParser } from "@/utils/sseParser";

export type WebCitation = {
  url: string;
  title: string;
  content?: string;
};

export type ToolCallEvent = {
  id?: string;
  interactionId?: string;
  checkpointId?: string;
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
  onUpdate?: (snapshot: StreamSnapshot) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onMetadata?: (event: MetadataEvent) => void;
};

export const consumeAiChatStream = async (
  body: ReadableStream<Uint8Array>,
  options: ConsumeAiChatStreamOptions = {},
) => {
  const { onUpdate, onToolCall, onMetadata } = options;
  const reader = body.getReader();
  const parser = new SseStreamParser();
  const startTime = Date.now();
  let fullText = "";
  let fullThought = "";
  let thinkingEndTime = 0;
  let pendingFrame: number | null = null;
  let updatePending = false;

  // Keep the stream consumer usable in non-browser tests as well. In the
  // browser this is always requestAnimationFrame, so deltas received during
  // one frame result in one presentation update.
  const scheduleFrame = (callback: FrameRequestCallback) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback);
    }
    return globalThis.setTimeout(() => callback(Date.now()), 0);
  };

  const cancelFrame = (frame: number) => {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(frame);
    } else {
      globalThis.clearTimeout(frame);
    }
  };

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

  const cancelPendingUpdate = () => {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }
    updatePending = false;
  };

  const scheduleUpdate = () => {
    updatePending = true;
    if (pendingFrame !== null) return;

    pendingFrame = scheduleFrame(() => {
      pendingFrame = null;
      if (!updatePending) return;
      updatePending = false;
      emitUpdate();
    });
  };

  const flushUpdate = () => {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }
    updatePending = false;
    emitUpdate();
  };

  try {
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
            interactionId: (data as any).interactionId,
            checkpointId: (data as any).checkpointId,
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
        const reasoning = delta?.reasoning || delta?.reasoning_content || "";

        if (!content && !reasoning) continue;

        if (content && fullText.length === 0) {
          thinkingEndTime = Date.now();
        }

        fullText += content;
        fullThought += reasoning;

        // Accumulate synchronously, then let the browser coalesce presentation
        // updates to one callback per animation frame.
        scheduleUpdate();
      }
    }

    // Do not leave the last delta waiting for the next paint after [DONE].
    flushUpdate();
  } catch (error) {
    // An aborted reader can reject while a frame is pending. Publish the
    // accumulated partial response once, then cancel the callback so it cannot
    // fire after the caller has handled the error.
    cancelPendingUpdate();
    emitUpdate();
    throw error;
  } finally {
    cancelPendingUpdate();
  }

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
