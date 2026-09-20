import Notes from "../../models/notes.model.js";
import Memory from "../../models/Memory.js";
import { stripHtml } from "../../utils/stripHtml.js";
import { summarizeHistory } from "../../utils/summarizeHistory.js";
import { formatStructuredNoteContext } from "./chatService.js";
import { getChatTools } from "./tools/chatTools.js";

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
  const { noteContext: reqNoteContext, structuredContext, hasSelection, message, contextChanged, noteId: bodyNoteId } = body;
  const noteId = bodyNoteId || sessionData?.noteId;
  const history = sessionData?.history || [];
  let noteContext = "";
  let noteFetched = false;

  const isNoteQuery =
    noteId && (hasSelection || shouldFetchNote(message, history, contextChanged));
  const shouldIncludeContext = Boolean(isNoteQuery);

  if (shouldIncludeContext) {
    if (structuredContext) {
      noteContext = formatStructuredNoteContext(structuredContext);
    } else if (reqNoteContext) {
      noteContext = hasSelection
        ? `[User specifically highlighted this text in their editor]:\n${reqNoteContext}`
        : `[user's current editor context]:\n${reqNoteContext}`;
    } else if (user?._id) {
      const note = await Notes.findOne({
        _id: noteId,
        user: user._id,
      }).lean();
      if (note?.content) {
        noteContext = `Title: ${note.title || "Untitled"}\n\n${stripHtml(note.content).slice(0, 1500)}`;
        noteFetched = true;
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
      hasSelection = false,
      contextChanged = false,
      chatMode,
      clientToolResults,
    } = body || {};

    // Context-aware history management (Large Context Window Strategy)
    // 1. Keep approximately the last 16 messages in full (untruncated)
    // 2. Older messages outside the recent window are consolidated into a state-preserving rolling summary
    const RECENT_MESSAGE_COUNT = 16;
    const SUMMARY_TRIGGER_COUNT = 24;

    let effectiveHistory = history;
    let sessionSummary = summary;

    if (history && history.length > RECENT_MESSAGE_COUNT) {
      const recentHistory = history.slice(-RECENT_MESSAGE_COUNT);
      const olderMessages = history.slice(0, -RECENT_MESSAGE_COUNT);

      if (history.length >= SUMMARY_TRIGGER_COUNT && olderMessages.length > 0) {
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
      noteId: noteId || null,
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
          .limit(8)
          .lean();
        if (memories?.length > 0) {
          memoryContext = `\n--- USER MEMORIES ---\nFacts previously noted about the user:\n${memories
            .map((m) => `- [${m.category}] ${m.content}`)
            .join("\n")}\n--- END MEMORIES ---\n`;
        }
      } catch (_) {}
    }

    const activeNoteId = noteId || null;
    let activeNoteTitle;
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

    const userName = user?.name ? `User: ${user.name}` : "";
    const finalSystemPrompt = [userName, memoryContext, activeNoteContext].filter(Boolean).join("\n");

    const currentMode = activeSession?.chatMode || chatMode || "casual";
    const isNoteScoped = !isGlobalChat || Boolean(noteId);

    // Available tools for current chat mode (in note editor drawer, create_note is excluded)
    const tools = getChatTools(currentMode, { isNoteScoped });

    return {
      effectiveHistory,
      sessionSummary,
      noteContext,
      noteFetched,
      finalSystemPrompt,
      currentMode,
      isNoteScoped,
      activeNoteId,
      tools,
    };
  }
}

export const chatContextResolver = new ChatContextResolver();
export const resolveChatContext = (args) => chatContextResolver.resolve(args);
