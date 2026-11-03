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
  status?: "pending" | "executing" | "success" | "error" | "approval-requested" | "denied";
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

/**
 * How far (in ms of streamed text) the visible text is allowed to trail the
 * received text. The reveal is proportional to the backlog, so the display
 * converges back to this window instead of falling further behind on fast
 * models.
 */
const REVEAL_LAG_MS = 48;
/** Upper bound per painted frame so a burst still sweeps in readably. */
const MAX_CHARS_PER_FRAME = 96;
/**
 * Guard against committing twice for the same paint. A normal display frame is
 * ~16.7 ms, so this still allows every frame through at 60 Hz.
 */
const MIN_EMIT_INTERVAL_MS = 16;
/**
 * Reasoning is secondary text and much more expensive to re-render (the
 * thinking panel parses its own markdown). Cap its commits at ~20 Hz while the
 * answer keeps the full frame rate.
 */
const THOUGHT_EMIT_INTERVAL_MS = 50;
/** Upper bound for the end-of-stream catch-up, scaled to the backlog. */
const DRAIN_MIN_MS = 48;
const DRAIN_MAX_MS = 600;

export const consumeAiChatStream = async (
  body: ReadableStream<Uint8Array>,
  options: ConsumeAiChatStreamOptions = {},
) => {
  const { onUpdate, onToolCall, onMetadata } = options;
  const reader = body.getReader();
  const parser = new SseStreamParser();
  // Starts on the first streamed token, not when the request is sent. Provider
  // connection time and time-to-first-token are not "thinking" time.
  let thinkingStartTime = 0;
  let fullText = "";
  let revealedTextLength = 0;
  let fullThought = "";
  let revealedThoughtLength = 0;
  let thinkingEndTime = 0;
  let pendingFrame: number | null = null;
  let draining = false;
  const prefersReducedMotion =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const now = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

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
    thinkingStartTime
      ? Math.floor(((thinkingEndTime || Date.now()) - thinkingStartTime) / 1000)
      : 0;

  let fractionalReveal = 0;
  let fractionalThoughtReveal = 0;
  let lastFrameTime = 0;
  let lastEmitTime = 0;
  let lastEmittedLength = -1;
  let lastEmittedThoughtLength = -1;

  // Exponential approach to the stream head: each frame reveals the share of
  // the backlog that would be consumed within REVEAL_LAG_MS. Steady state
  // trails by ~REVEAL_LAG_MS of text regardless of how fast tokens arrive.
  // The per-frame cap keeps a burst readable; the remainder is discarded
  // rather than accumulating debt, so pacing stays proportional afterwards.
  const advanceReveal = (
    full: string,
    revealed: number,
    fractional: number,
    deltaMs: number,
  ) => {
    const pending = full.length - revealed;
    if (pending <= 0) return { revealed, fractional: 0 };

    fractional += (pending * deltaMs) / REVEAL_LAG_MS;
    const charsToAdd = Math.min(
      Math.floor(fractional),
      pending,
      MAX_CHARS_PER_FRAME,
    );
    if (charsToAdd <= 0) return { revealed, fractional };

    fractional = Math.min(fractional - charsToAdd, 0.999);
    revealed += charsToAdd;

    // Prevent slicing UTF-16 surrogate pairs (such as emojis)
    if (
      revealed < full.length &&
      full.charCodeAt(revealed - 1) >= 0xd800 &&
      full.charCodeAt(revealed - 1) <= 0xdbff
    ) {
      revealed += 1;
    }

    return { revealed, fractional };
  };

  const emitUpdate = (force = false) => {
    const textChanged = lastEmittedLength !== revealedTextLength;
    const thoughtChanged = lastEmittedThoughtLength !== revealedThoughtLength;
    // Never repeat a snapshot, including the forced one at flush time.
    if (!textChanged && !thoughtChanged) return;

    // performance.now avoids the ~15.6 ms clock granularity of Date.now,
    // which can otherwise skip every other frame at 60 Hz.
    const currentTime = now();
    const interval = textChanged ? MIN_EMIT_INTERVAL_MS : THOUGHT_EMIT_INTERVAL_MS;
    if (!force && currentTime - lastEmitTime < interval) return;

    lastEmitTime = currentTime;
    lastEmittedLength = revealedTextLength;
    lastEmittedThoughtLength = revealedThoughtLength;
    onUpdate?.({
      fullText: fullText.slice(0, revealedTextLength),
      fullThought: fullThought.slice(0, revealedThoughtLength),
      isThinking: fullText.length === 0,
      thinkingTime: getThinkingTime(),
    });
  };

  const stepReveal = (timestamp: number) => {
    const frameTime = typeof timestamp === "number" ? timestamp : now();
    // A slow frame must still be allowed to catch up; only a pathological
    // pause (tab hidden, debugger) is capped.
    const deltaMs = lastFrameTime
      ? Math.min(Math.max(frameTime - lastFrameTime, 1), 250)
      : 16.67;
    lastFrameTime = frameTime;

    if (prefersReducedMotion) {
      revealedTextLength = fullText.length;
      revealedThoughtLength = fullThought.length;
    } else {
      ({ revealed: revealedTextLength, fractional: fractionalReveal } =
        advanceReveal(fullText, revealedTextLength, fractionalReveal, deltaMs));
      ({ revealed: revealedThoughtLength, fractional: fractionalThoughtReveal } =
        advanceReveal(
          fullThought,
          revealedThoughtLength,
          fractionalThoughtReveal,
          deltaMs,
        ));
    }

    if (
      revealedTextLength < fullText.length ||
      revealedThoughtLength < fullThought.length
    ) {
      emitUpdate();
      if (!draining) scheduleFrameUpdate();
      return;
    }

    lastFrameTime = 0;
    fractionalReveal = 0;
    fractionalThoughtReveal = 0;
    // Always publish the final characters of a burst, even inside the throttle.
    emitUpdate(true);
  };

  const scheduleFrameUpdate = () => {
    if (pendingFrame !== null) return;
    if (!lastFrameTime) {
      lastFrameTime = now();
    }
    pendingFrame = scheduleFrame((timestamp) => {
      pendingFrame = null;
      stepReveal(timestamp);
    });
  };

  const flushUpdate = () => {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }
    lastFrameTime = 0;
    fractionalReveal = 0;
    fractionalThoughtReveal = 0;
    revealedTextLength = fullText.length;
    revealedThoughtLength = fullThought.length;
    emitUpdate(true);
  };

  // Let the visible text catch up to what already arrived instead of snapping
  // the remaining characters in on completion. The budget scales with the
  // backlog: a normal ending adds a frame or two, a single large burst sweeps
  // in instead of teleporting.
  const drainReveal = async () => {
    if (prefersReducedMotion) {
      flushUpdate();
      return;
    }

    const backlog = Math.max(
      fullText.length - revealedTextLength,
      fullThought.length - revealedThoughtLength,
    );
    const budget = Math.min(
      DRAIN_MAX_MS,
      Math.max(
        DRAIN_MIN_MS,
        Math.ceil(backlog / MAX_CHARS_PER_FRAME) * (1000 / 60) + 32,
      ),
    );

    draining = true;
    try {
      const deadline = Date.now() + budget;
      while (
        (revealedTextLength < fullText.length ||
          revealedThoughtLength < fullThought.length) &&
        Date.now() < deadline
      ) {
        if (pendingFrame !== null) {
          cancelFrame(pendingFrame);
          pendingFrame = null;
        }
        await new Promise<void>((resolve) => {
          let settled = false;

          const settle = () => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            resolve();
          };

          // Browsers pause animation frames in hidden tabs; never let that
          // hold the stream open. The remaining text is flushed on timeout.
          const timer = globalThis.setTimeout(settle, 100);

          scheduleFrame((timestamp) => {
            settle();
            stepReveal(timestamp);
          });
        });
      }
    } finally {
      draining = false;
    }

    flushUpdate();
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

        if (!thinkingStartTime) {
          thinkingStartTime = Date.now();
        }

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

    // Let the last deltas paint instead of dumping the tail in one frame.
    await drainReveal();
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
    thinkingTime: getThinkingTime(),
  };
};
