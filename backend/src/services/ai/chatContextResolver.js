import Notes from "../../models/notes.model.js";
import GlobalChatSession from "../../models/globalChatSession.model.js";
import { stripHtml } from "../../utils/stripHtml.js";
import { summarizeHistory } from "../../utils/summarizeHistory.js";
import { formatStructuredNoteContext } from "./chatService.js";
import { getChatTools } from "./tools/chatTools.js";
import { DEFAULT_CHAT_MODEL, DEFAULT_CHAT_MODEL_II } from "./config/aiModels.js";

// Every routed model exposes at least a 200k window; keep 200k as the safe
// fallback for any model that is not in the registry yet.
const DEFAULT_MODEL_CONTEXT_WINDOW = 200000;

const MODEL_CONTEXT_WINDOWS = {
  [DEFAULT_CHAT_MODEL_II]: 260000, // inclusionai/ling-3.0-flash (fast route)
  "inclusionai/ling-3.0-flash": 260000,
  [DEFAULT_CHAT_MODEL]: 1000000, // z-ai/glm-5.3-flash (thinking/pro)
  "z-ai/glm-5.3-flash": 1000000,
  "deepseek/deepseek-v4-flash-0731": 260000,
  "deepseek/deepseek-v4.1-flash": 260000,
};

// Reserve room for the static system prompt, tool schemas, the summary, note
// and PDF context, and the model's own output. These are bounded separately,
// so a flat reservation is enough here.
const SYSTEM_AND_TOOL_OVERHEAD_TOKENS = 4000;
const RESERVED_OUTPUT_TOKENS = 8000;

// Below this delta a summarizer round-trip costs more than the context it
// saves. The hysteresis band (high - low) normally exceeds this by a wide
// margin, so compaction runs in meaningful chunks instead of every turn.
const MIN_COMPACTION_DELTA_TOKENS = 2000;

// Operational budgets per plan. The physical window is much larger (260k/1M),
// but sending it every turn would be slow and would exhaust the daily quota in
// a single message. These are the per-request ceilings; env vars can override.
const TIER_BUDGETS = {
  free: { high: 18000, low: 10000 },
  pro: { high: 100000, low: 64000 },
  enterprise: { high: 200000, low: 130000 },
};

export const getModelContextWindow = (modelId) => {
  if (!modelId) return DEFAULT_MODEL_CONTEXT_WINDOW;
  return MODEL_CONTEXT_WINDOWS[modelId] || DEFAULT_MODEL_CONTEXT_WINDOW;
};

/**
 * Derives dynamic watermarks from the routed model's real context window and
 * the user's plan. Clamps explicit env overrides to the model's safe budget.
 */
export const getWatermarkThresholds = ({ modelId, planTier } = {}) => {
  const modelContextWindow = getModelContextWindow(modelId);
  const maxSafeHistoryBudget = Math.max(
    4000,
    modelContextWindow - SYSTEM_AND_TOOL_OVERHEAD_TOKENS - RESERVED_OUTPUT_TOKENS,
  );

  const tierBudget = TIER_BUDGETS[planTier] || TIER_BUDGETS.free;
  const configuredHigh = Number.parseInt(process.env.CHAT_HISTORY_HIGH_WATERMARK, 10);
  const configuredLow = Number.parseInt(process.env.CHAT_HISTORY_LOW_WATERMARK, 10);

  const requestedHigh =
    Number.isFinite(configuredHigh) && configuredHigh > 0
      ? configuredHigh
      : tierBudget.high;
  const highWatermark = Math.max(
    1000,
    Math.min(requestedHigh, maxSafeHistoryBudget),
  );

  const requestedLow =
    Number.isFinite(configuredLow) && configuredLow > 0
      ? configuredLow
      : tierBudget.low;
  const lowWatermark = Math.max(
    100,
    Math.min(requestedLow, highWatermark - 100),
  );

  return {
    highWatermark,
    lowWatermark,
    modelContextWindow,
    fallbackMaxTokens: Math.min(
      maxSafeHistoryBudget,
      Math.max(highWatermark + 3000, 12000),
    ),
    minCompactionDeltaTokens: Math.min(
      MIN_COMPACTION_DELTA_TOKENS,
      Math.max(100, highWatermark - lowWatermark),
    ),
  };
};

/**
 * Provider-independent estimate for a message's token cost: word-like pieces
 * are split into roughly four-character tokens, punctuation/symbols count
 * individually, and message framing adds overhead. This is approximate, not a
 * tokenizer's exact count.
 */
export const estimateMessageTokens = (message) => {
  let serializedMessage;
  try {
    serializedMessage = JSON.stringify(message ?? {});
  } catch (_) {
    serializedMessage = String(message?.content ?? "");
  }

  const pieces = serializedMessage.match(/[\p{L}\p{N}_]+|[^\s]/gu) || [];
  const contentTokens = pieces.reduce((total, piece) => {
    if (/[\u3400-\u9FFF\uF900-\uFAFF]/u.test(piece)) {
      return total + Array.from(piece).length;
    }
    return (
      total +
      (/[\p{L}\p{N}_]/u.test(piece)
        ? Math.ceil(Array.from(piece).length / 4)
        : 1)
    );
  }, 0);

  return contentTokens + 4;
};

/**
 * Role-aware extraction for older messages passed to the summarizer.
 * Preserves high-value technical identifiers, errors, titles, and parameters
 * while stripping heavy embeddings, raw base64, and massive data dumps.
 */
export const sanitizeMessageForSummary = (message) => {
  if (!message) return message;
  const clone = {
    role: message.role,
    content: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""),
  };

  if (Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
    clone.toolCalls = message.toolCalls.map((tc) => {
      const sanitized = {
        tool: tc.tool || tc.function?.name,
        status: tc.status,
      };

      if (tc.error) {
        sanitized.error = tc.error;
      }

      if (tc.tool === "get_note_content") {
        sanitized.noteId = tc.args?.noteId;
        if (tc.data?.title) sanitized.title = tc.data.title;
        if (tc.data?.content) {
          sanitized.contentExcerpt = tc.data.content.slice(0, 600);
        }
      } else if (tc.tool === "search_web") {
        sanitized.query = tc.args?.query;
        if (Array.isArray(tc.data?.citations)) {
          sanitized.citations = tc.data.citations.map((c) => ({
            title: c.title,
            url: c.url,
          }));
        }
      } else if (tc.tool === "crawl_url") {
        // Keep the page identity and a short excerpt; the full text is too
        // large to replay in every later turn.
        sanitized.url = tc.args?.url || tc.data?.url;
        if (tc.data?.title) sanitized.title = tc.data.title;
        if (tc.data?.text) {
          sanitized.contentExcerpt = tc.data.text.slice(0, 600);
        }
      } else if (tc.tool === "recall_memory") {
        sanitized.query = tc.args?.query;
        if (Array.isArray(tc.data)) {
          sanitized.memories = tc.data.map((m) => ({
            category: m.category,
            content: m.content,
          }));
        }
      } else if (tc.tool === "create_note" || tc.tool === "update_note" || tc.tool === "delete_note") {
        sanitized.noteId = tc.args?.noteId || tc.data?.noteId;
        sanitized.title = tc.args?.title || tc.data?.title;
        sanitized.mode = tc.args?.mode;
      } else if (tc.tool === "ask_question") {
        sanitized.purpose = tc.args?.purpose;
        sanitized.questions = tc.args?.questions?.map((q) => q.question);
      } else if (tc.data) {
        if (typeof tc.data === "string") {
          sanitized.data = tc.data.slice(0, 500);
        } else if (typeof tc.data === "object") {
          const cleanData = { ...tc.data };
          delete cleanData.embedding;
          delete cleanData.imageBase64;
          sanitized.data = cleanData;
        }
      }

      return sanitized;
    });
  }

  return clone;
};

export const getRecentHistoryWithinTokenBudget = (history, tokenBudget) => {
  let tokenCount = 0;
  let startIndex = history.length;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const nextMessageTokens = estimateMessageTokens(history[index]);
    // Keep at least the newest message, even if it alone exceeds the budget.
    if (startIndex < history.length && tokenCount + nextMessageTokens > tokenBudget) {
      break;
    }
    tokenCount += nextMessageTokens;
    startIndex = index;
  }

  return {
    recentHistory: history.slice(startIndex),
    olderMessages: history.slice(0, startIndex),
  };
};

// In-memory single-flight lock per session ID to prevent concurrent overlapping compactions
const activeCompactionLocks = new Map();

/**
 * Fetch note context when the message is plausibly about the note.
 * First turn always fetches. Follow-ups fetch on broad note-related keywords.
 * Clearly off-topic messages (greetings, math, general questions) are skipped.
 */
export const shouldFetchNote = (message = "", history = [], contextChanged = false) => {
  // If the frontend explicitly tells us the editor content changed, we must include it!
  if (contextChanged) return true;

  // If this is the very first message of the chat, always fetch the note context.
  if (!history || history.length === 0) return true;

  // Otherwise, we rely on the LLM's vast context window history.
  // We no longer use arbitrary regex keywords that trigger false positives!
  return false;
};

/**
 * Fetch note context from the DB or frontend payload.
 */
export const resolveNoteContext = async ({ user, body, sessionData }) => {
  const {
    noteContext: reqNoteContext,
    structuredContext,
    hasSelection,
    message,
    contextChanged,
    noteId: bodyNoteId,
    currentNote,
  } = body;
  const noteId = bodyNoteId || sessionData?.noteId || currentNote?.id;
  const history = sessionData?.history || [];
  let noteContext = "";
  let noteFetched = false;
  const mentionsCurrentNote = /\b(?:this note|current note|my note|the note)\b/i.test(
    message || "",
  );

  const isNoteQuery =
    noteId &&
    noteId !== "new" &&
    (hasSelection ||
      contextChanged ||
      shouldFetchNote(message, history, contextChanged) ||
      (currentNote?.id && (history.length === 0 || mentionsCurrentNote)));
  const shouldIncludeContext = Boolean(isNoteQuery);

  if (shouldIncludeContext) {
    if (structuredContext) {
      noteContext = formatStructuredNoteContext(structuredContext);
    } else if (reqNoteContext) {
      noteContext = hasSelection
        ? `[User specifically highlighted this text in their editor]:\n${reqNoteContext}`
        : `[user's current editor context]:\n${reqNoteContext}`;
    } else if (user?._id) {
      try {
        const note = await Notes.findOne({
          _id: noteId,
          user: user._id,
        }).lean();
        if (note?.content) {
          noteContext = `Title: ${note.title || "Untitled"}\n\n${stripHtml(note.content).slice(0, 1500)}`;
          noteFetched = true;
        }
      } catch (error) {
        console.warn("⚠️ [ChatContextResolver] Note context lookup skipped:", error.message);
      }
    }
  }

  return { noteContext, noteFetched };
};

export class ChatContextResolver {
  async resolve({ user, body, sessionData }) {
    const { history = [], summary = "", activeSession, isGlobalChat } = sessionData || {};
    const {
      message = "",
      noteId,
      currentNote,
      hasSelection = false,
      contextChanged = false,
      chatMode,
      clientToolResults,
      modelTier,
      imageBase64,
    } = body || {};

    let effectiveHistory = history;
    let sessionSummary = activeSession?.summary || summary || "";

    // The routed model fixes the physical window; the plan fixes the
    // per-request budget so one message cannot eat a user's whole daily quota.
    const routedModelId =
      modelTier === "fast" && !imageBase64 ? DEFAULT_CHAT_MODEL_II : DEFAULT_CHAT_MODEL;
    const planTier = user?.plan?.tier || "free";
    const {
      highWatermark,
      lowWatermark,
      fallbackMaxTokens,
      minCompactionDeltaTokens,
    } = getWatermarkThresholds({ modelId: routedModelId, planTier });

    const sessionId = activeSession?._id ? String(activeSession._id) : null;

    // Await any concurrent in-flight compaction for this specific session (single-flight)
    if (sessionId && activeCompactionLocks.has(sessionId)) {
      try {
        await activeCompactionLocks.get(sessionId);
        // Re-read the committed summary and checkpoint. Otherwise a concurrent
        // request would recompute the same delta and summarize it again.
        if (activeSession?._id) {
          const latest = await GlobalChatSession.findById(activeSession._id).lean();
          if (latest) {
            activeSession.summary = latest.summary;
            activeSession.lastSummarizedMessageId = latest.lastSummarizedMessageId;
            activeSession.lastSummarizedSeq = latest.lastSummarizedSeq;
            sessionSummary = latest.summary || sessionSummary;
          }
        }
      } catch (_) {
        // Proceed safely with current state if concurrent compaction failed
      }
    }

    // Everything up to the checkpoint is already represented in the running
    // summary. Keep those messages in storage for the UI, but never replay them
    // to the model and never count them toward the watermark. Counting the full
    // stored history is what made compaction fire again on every single turn.
    const lastSummarizedSeq = activeSession?.lastSummarizedSeq || 0;
    const lastSummarizedMessageId = activeSession?.lastSummarizedMessageId || null;

    let unsummarizedStartIndex = 0;
    if (lastSummarizedSeq > 0) {
      const firstUnsummarized = history.findIndex(
        (m) => typeof m.seq !== "number" || m.seq > lastSummarizedSeq,
      );
      unsummarizedStartIndex =
        firstUnsummarized === -1 ? history.length : firstUnsummarized;
    } else if (lastSummarizedMessageId) {
      const checkpointIndex = history.findIndex((m) => m.id === lastSummarizedMessageId);
      unsummarizedStartIndex = checkpointIndex >= 0 ? checkpointIndex + 1 : 0;
    }

    const unsummarizedHistory = history.slice(unsummarizedStartIndex);
    const historyTokenCount = unsummarizedHistory.reduce(
      (total, item) => total + estimateMessageTokens(item),
      0,
    );

    effectiveHistory = unsummarizedHistory;

    // Compact only when the unsummarized tail crosses the high watermark. The
    // [low, high] band is the hysteresis: after a compaction the prompt starts
    // near low and grows until it crosses high again, so the summarizer runs on
    // a large chunk (high - low) instead of on every turn.
    if (historyTokenCount > highWatermark) {
      const { recentHistory, olderMessages } = getRecentHistoryWithinTokenBudget(
        unsummarizedHistory,
        lowWatermark,
      );

      const deltaTokenCount = olderMessages.reduce(
        (total, item) => total + estimateMessageTokens(item),
        0,
      );

      if (olderMessages.length > 0 && deltaTokenCount >= minCompactionDeltaTokens) {
        const candidateCheckpointMsg = olderMessages[olderMessages.length - 1];
        const candidateCheckpointId = candidateCheckpointMsg?.id || null;
        const candidateCheckpointSeq =
          typeof candidateCheckpointMsg?.seq === "number"
            ? candidateCheckpointMsg.seq
            : lastSummarizedSeq + olderMessages.length;

        const sanitizedDelta = olderMessages.map(sanitizeMessageForSummary);

        const runCompaction = async () => {
          const consolidatedSummary = await summarizeHistory(sanitizedDelta, sessionSummary);
          if (consolidatedSummary && typeof consolidatedSummary === "string" && consolidatedSummary.trim()) {
            const trimmed = consolidatedSummary.trim();
            sessionSummary = trimmed;

            // Optimistic concurrency update: only advance if checkpoint sequence matches precondition
            if (activeSession?._id) {
              try {
                const previousSeq = lastSummarizedSeq;
                const updated = await GlobalChatSession.findOneAndUpdate(
                  {
                    _id: activeSession._id,
                    $or: [
                      { lastSummarizedSeq: previousSeq },
                      { lastSummarizedSeq: { $exists: false } },
                      { lastSummarizedSeq: 0 },
                    ],
                  },
                  {
                    $set: {
                      summary: trimmed,
                      lastSummarizedMessageId: candidateCheckpointId,
                      lastSummarizedSeq: candidateCheckpointSeq,
                    },
                  },
                  { new: true },
                );

                if (updated) {
                  activeSession.summary = updated.summary;
                  activeSession.lastSummarizedMessageId = updated.lastSummarizedMessageId;
                  activeSession.lastSummarizedSeq = updated.lastSummarizedSeq;
                } else {
                  // Concurrent write conflict: reload committed summary and checkpoint rather than overwriting
                  const latest = await GlobalChatSession.findById(activeSession._id).lean();
                  if (latest) {
                    activeSession.summary = latest.summary;
                    activeSession.lastSummarizedMessageId = latest.lastSummarizedMessageId;
                    activeSession.lastSummarizedSeq = latest.lastSummarizedSeq;
                    sessionSummary = latest.summary || trimmed;
                  }
                }
              } catch (dbErr) {
                console.warn("⚠️ [ChatContextResolver] Failed to persist compaction checkpoint:", dbErr.message);
              }
            }
            return { success: true, summary: trimmed };
          }
          return { success: false, summary: sessionSummary };
        };

        let compactionPromise;
        if (sessionId) {
          compactionPromise = runCompaction();
          activeCompactionLocks.set(sessionId, compactionPromise);
        } else {
          compactionPromise = runCompaction();
        }

        let compactionResult = { success: false, summary: sessionSummary };
        try {
          compactionResult = await compactionPromise;
        } catch (sumErr) {
          console.warn("⚠️ [ChatContextResolver] Conversation extraction failed:", sumErr.message);
        } finally {
          if (sessionId) {
            activeCompactionLocks.delete(sessionId);
          }
        }

        if (compactionResult.success) {
          effectiveHistory = recentHistory;
        } else {
          // Failure-safe fallback: retain previous valid summary, do not advance checkpoint,
          // and retain as much history as safely fits within the fallback context limit to prevent context loss
          console.warn("⚠️ [ChatContextResolver] Extraction uncommitted; retaining previous summary and safe fallback history.");
          effectiveHistory = getRecentHistoryWithinTokenBudget(
            unsummarizedHistory,
            fallbackMaxTokens,
          ).recentHistory;
        }
      } else {
        // Not enough new material to justify a summarizer round-trip. Keep the
        // extra history; both the model window and the plan budget leave room.
        console.log(
          `📊 [ChatContextResolver] Compaction deferred: ${deltaTokenCount} new tokens < ${minCompactionDeltaTokens}`,
        );
        effectiveHistory = unsummarizedHistory;
      }
    }

    // Merge any verified client-side tool execution results into history
    if (Array.isArray(clientToolResults) && clientToolResults.length > 0 && effectiveHistory) {
      for (const ctr of clientToolResults) {
        for (const h of effectiveHistory) {
          if (h.role === "assistant" && Array.isArray(h.toolCalls)) {
            for (const tc of h.toolCalls) {
              if ((ctr.toolCallId && tc.id === ctr.toolCallId) || (!ctr.toolCallId && tc.tool === ctr.tool)) {
                tc.status = ctr.status;
                if (ctr.data) tc.data = ctr.data;
                if (ctr.error) tc.error = ctr.error;
              }
            }
          }
        }
      }
    }

    // Note context (always fetched when relevant to note context)
    const { noteContext, noteFetched } = await resolveNoteContext({
      user,
      body,
      sessionData: { ...sessionData, history: effectiveHistory },
    });

    console.log("📊 [AI_TELEMETRY_BACKEND]", {
      userId: user?._id,
      noteId: noteId || currentNote?.id || null,
      hasSelection: Boolean(hasSelection),
      contextChanged: Boolean(contextChanged),
      contextLength: (noteContext || "").length,
      noteFetched,
      isGlobalChat: Boolean(isGlobalChat),
      timestamp: new Date().toISOString(),
    });

    // Memories are retrieved on-demand via the recall_memory tool by the agent
    const memoryContext = "";

    const activeNoteId = noteId || currentNote?.id || null;
    let activeNoteTitle = currentNote?.title;
    if (activeNoteId && user?._id) {
      try {
        const existingNote = await Notes.findOne(
          { _id: activeNoteId, user: user._id },
          "title"
        ).lean();
        if (existingNote) {
          activeNoteTitle = existingNote.title;
        }
      } catch (_) {}
    }

    let activeNoteContext = "";
    if (activeNoteId) {
      activeNoteContext = `\n\n[ACTIVE NOTE]\nid: ${activeNoteId}\ntitle: "${activeNoteTitle || "Untitled"}"\n[/ACTIVE NOTE]`;
    }

    const taskContext = "";

    const userName = user?.name ? `User: ${user.name}` : "";
    const finalSystemPrompt = [userName, memoryContext, activeNoteContext].filter(Boolean).join("\n");

    const currentMode = chatMode || activeSession?.chatMode || "casual";
    // A global chat may reference the currently open note without becoming a
    // note-scoped conversation. Note-scoped chats are the contextual drawer.
    const isNoteScoped = !isGlobalChat;

    // Available tools for current chat mode (unified schema for prefix caching)
    const tools = getChatTools();

    return {
      effectiveHistory,
      sessionSummary,
      noteContext,
      noteFetched,
      finalSystemPrompt,
      taskContext,
      currentMode,
      isNoteScoped,
      activeNoteId,
      tools,
    };
  }
}

export const chatContextResolver = new ChatContextResolver();
export const resolveChatContext = (args) => chatContextResolver.resolve(args);
