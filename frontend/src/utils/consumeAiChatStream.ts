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
  tasks?: any[];
  task?: any;
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
  let revealedTextLength = 0;
  let fullThought = "";
  let thinkingEndTime = 0;
  let pendingFrame: number | null = null;
  const prefersReducedMotion =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Keep the stream consumer usable in non-browser tests as well. In the
  // browser this is always requestAnimationFrame, keeping presentation updates
  // synchronized with paints.
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
      fullText: fullText.slice(0, revealedTextLength),
      fullThought,
      isThinking: fullText.length === 0,
      thinkingTime: getThinkingTime(),
    });
  };

  let fractionalReveal = 0;
  let lastFrameTime = 0;

  const scheduleFrameUpdate = () => {
    if (pendingFrame !== null) return;
    if (!lastFrameTime) {
      lastFrameTime = performance.now();
    }
    pendingFrame = scheduleFrame((timestamp) => {
      pendingFrame = null;

      const now = typeof timestamp === "number" ? timestamp : performance.now();
      const deltaMs = lastFrameTime ? Math.min(Math.max(now - lastFrameTime, 1), 50) : 16.67;
      lastFrameTime = now;

      const pendingCharacters = fullText.length - revealedTextLength;
      if (pendingCharacters > 0) {
        if (prefersReducedMotion) {
          revealedTextLength = fullText.length;
        } else {
          // Dynamic velocity interpolation curve:
          // Smoothly ramps up speed when backlog increases so there is no artificial lag,
          // while preserving a silky smooth typewriter flow during steady streaming.
          let charsPerSecond = 48; // Baseline readable speed (~0.8 chars/frame @ 60fps)
          if (pendingCharacters > 300) {
            charsPerSecond = Math.max(600, pendingCharacters * 4);
          } else if (pendingCharacters > 120) {
            charsPerSecond = 320;
          } else if (pendingCharacters > 40) {
            charsPerSecond = 160;
          } else if (pendingCharacters > 15) {
            charsPerSecond = 90;
          }

          const charsToAdd = (charsPerSecond * deltaMs) / 1000;
          fractionalReveal += charsToAdd;
          const wholeChars = Math.min(
            pendingCharacters,
            Math.max(1, Math.floor(fractionalReveal)),
          );
          fractionalReveal -= wholeChars;
          revealedTextLength += wholeChars;

          // Prevent slicing UTF-16 surrogate pairs (such as emojis)
          if (
            revealedTextLength < fullText.length &&
            fullText.charCodeAt(revealedTextLength - 1) >= 0xd800 &&
            fullText.charCodeAt(revealedTextLength - 1) <= 0xdbff
          ) {
            revealedTextLength += 1;
          }
        }
      }

      emitUpdate();

      if (revealedTextLength < fullText.length) {
        scheduleFrameUpdate();
      } else {
        lastFrameTime = 0;
        fractionalReveal = 0;
      }
    });
  };

  const flushUpdate = () => {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }
    lastFrameTime = 0;
    fractionalReveal = 0;
    revealedTextLength = fullText.length;
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
            tasks: (data as any).tasks,
            task: (data as any).task,
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

        // Keep the complete response for the final result, while revealing the
        // visible text progressively at no more than one update per frame.
        scheduleFrameUpdate();
      }
    }

    // Do not leave the last delta waiting for the next paint after [DONE].
    flushUpdate();
  } catch (error) {
    // Publish accumulated partial text once, then cancel any scheduled frame
    // so it cannot fire after the caller has handled the error.
    flushUpdate();
    throw error;
  } finally {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }
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
