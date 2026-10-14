import Notes from "../../models/notes.model.js";
import Memory from "../../models/Memory.js";
import { stripHtml } from "../../utils/stripHtml.js";
import { summarizeHistory } from "../../utils/summarizeHistory.js";
import { formatStructuredNoteContext } from "./chatService.js";
import { getChatTools } from "./tools/chatTools.js";

const DEFAULT_RECENT_HISTORY_TOKEN_BUDGET = 8000;

const getRecentHistoryTokenBudget = () => {
  const configuredBudget = Number.parseInt(
    process.env.CHAT_RECENT_HISTORY_TOKEN_BUDGET,
    10,
  );

  return Number.isFinite(configuredBudget) && configuredBudget > 0
    ? configuredBudget
    : DEFAULT_RECENT_HISTORY_TOKEN_BUDGET;
};

/**
 * Provider-independent estimate for a message's token cost: word-like pieces
 * are split into roughly four-character tokens, punctuation/symbols count
 * individually, and message framing adds overhead. This is approximate, not a
 * tokenizer's exact count.
 */
const estimateMessageTokens = (message) => {
  let serializedMessage;
  try {
    serializedMessage = JSON.stringify(message ?? {});
  } catch (_) {
    serializedMessage = String(message?.content ?? "");
  }

  const pieces = serializedMessage.match(/[\p{L}\p{N}_]+|[^\s]/gu) || [];
  const contentTokens = pieces.reduce((total, piece) => {
    // CJK characters commonly map close to one token each; other word-like
    // pieces average several characters per token across common tokenizers.
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

const getRecentHistoryWithinTokenBudget = (history, tokenBudget) => {
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
    } = body || {};

    let effectiveHistory = history;
    let sessionSummary = summary;

    const recentHistoryTokenBudget = getRecentHistoryTokenBudget();
    const historyTokenCount = history.reduce(
      (total, item) => total + estimateMessageTokens(item),
      0,
    );

    if (historyTokenCount > recentHistoryTokenBudget) {
      const { recentHistory, olderMessages } = getRecentHistoryWithinTokenBudget(
        history,
        recentHistoryTokenBudget,
      );

      if (olderMessages.length > 0) {
        try {
          const consolidatedSummary = await summarizeHistory(olderMessages, sessionSummary);
          if (consolidatedSummary) {
            sessionSummary = consolidatedSummary;
            if (activeSession) {
              activeSession.summary = consolidatedSummary;
            }
          }
        } catch (sumErr) {
          console.warn("⚠️ [ChatContextResolver] Conversation summarization failed:", sumErr.message);
        }
      }

      effectiveHistory = recentHistory;
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

    // Retrieve User Facts & Memories (Direct Indexed DB Fetch)
    let memoryContext = "";
    if (user?._id) {
      try {
        const memories = await Memory.find({ user: user._id })
          .sort({ lastAccessedAt: -1 })
          .limit(4)
          .lean();
        if (memories?.length > 0) {
          memoryContext = `\n--- USER MEMORIES ---\nFacts previously noted about the user:\n${memories
            .map((m) => `- [${m.category}] ${m.content}`)
            .join("\n")}\n--- END MEMORIES ---\n`;
        }
      } catch (_) {}
    }

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

    // Available tools for current chat mode (in note editor drawer, create_note is excluded)
    const tools = getChatTools(currentMode, { isNoteScoped });

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
