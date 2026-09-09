import crypto from "crypto";
import User from "../models/user.model.js";
import Notes from "../models/notes.model.js";
import AiAssistCache from "../models/aiAssistCache.model.js";
import catchAsync from "../utils/catchAsync.js";
import { generateTitle } from "../services/title.service.js";
import {
  checkGrammar,
  chatWithAi,
  formatStructuredNoteContext,
  runAiAssist,
  getDynamicPrompts,
  performWebSearch,
  crawlUrl,
  detectTools,
} from "../services/ai.service.js";
import GlobalChatSession from "../models/globalChatSession.model.js";
import { stripHtml } from "../utils/stripHtml.js";
import { parseIrisResponse } from "../utils/parseIrisResponse.js";
import getEffectiveDailyLimit from "../utils/getEffectiveDailyLimit.js";
import { SseStreamParser } from "../utils/sseParser.js";
import Memory from "../models/Memory.js";
import { extractCleanSearchQuery } from "../services/ai/tools/searchQueryExtractor.js";
import { summarizeHistory } from "../utils/summarizeHistory.js";

const normalizeForHash = (text = "") => text.replace(/\s+/g, " ").trim();

/**
 * Fetch note context when the message is plausibly about the note.
 * First turn always fetches. Follow-ups fetch on broad note-related keywords.
 * Clearly off-topic messages (greetings, math, general questions) are skipped.
 */
const shouldFetchNote = (message = "", history = [], contextChanged = false) => {
  // If the frontend explicitly tells us the editor content changed, we must include it!
  if (contextChanged) return true;
  
  // If this is the very first message of the chat, always fetch the note context.
  if (!history || history.length === 0) return true;

  // Otherwise, we rely on the LLM's vast context window history. 
  // We no longer use arbitrary regex keywords that trigger false positives!
  return false;
};

const mightNeedWeb = (msg) => {
  const lower = msg.toLowerCase();
  return (
    /https?:\/\/[^\s]+/.test(msg) || // ✅ matches actual URLs
    /\b(search(?:ing|es|ed)?|google|look up|find online|browse|web|internet|website|article|link|url)\b/.test(
      lower,
    ) || // ✅ explicit search intents
    /\b(latest|recent|new|news|now|current|today|release|update|version|stock|price|rate|conversion|weather)\b/.test(
      lower,
    ) || // Timely keywords
    /\b(api|documentation|lib|package|framework|how to install)\b/.test(
      lower,
    ) || // Technical gaps
    /[\$\€]/.test(msg) // Currency triggers
  );
};

const hashText = (text = "") =>
  crypto
    .createHash("sha256")
    .update(normalizeForHash(text), "utf8")
    .digest("hex");

const cleanSessionTitle = (title = "") => {
  const cleaned = title
    .replace(/^title\s*:\s*/i, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !cleaned ||
    /generate|descriptive|return only|no quotes|input content|task:/i.test(
      cleaned,
    )
  ) {
    return "New Chat";
  }

  return cleaned.slice(0, 54);
};

export const checkGrammarController = catchAsync(async (req, res) => {
  const { noteId } = req.params;

  const note = await Notes.findOne({ _id: noteId, user: req.user._id });
  if (!note) {
    return res.status(404).json({ success: false, message: "Note not found" });
  }

  const sourceText = stripHtml(note.content);
  const result = await checkGrammar(sourceText);
  note.grammarErrors = result.errors;
  await note.save();

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const aiAssistController = catchAsync(async (req, res) => {
  const { noteId, action, selectedText, noteText, stream } = req.body;

  if (!action) {
    return res
      .status(400)
      .json({ success: false, message: "action is required" });
  }

  // 1. Resolve Note and Source Text
  let note = null;
  // noteId is null when the note hasn't been saved yet (stateless mode for new notes)
  if (noteId && noteId !== "new") {
    note = await Notes.findOne({ _id: noteId, user: req.user._id });
    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }
  }

  const hasSelection = Boolean(selectedText && selectedText.trim());
  const sourceType = hasSelection ? "selection" : "note";
  const sourceText =
    (selectedText && selectedText.trim()) ||
    (noteText && noteText.trim()) ||
    (note ? stripHtml(note.content) : "");

  if (!sourceText || !sourceText.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Text is required for AI assist" });
  }

  const inputHash = hashText(sourceText);

  // 2. Check Cache First
  const cached = await AiAssistCache.findOne({
    user: req.user._id,
    note: note?._id || null,
    action,
    sourceType,
    inputHash,
  }).lean();

  if (cached?.response) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: {
        ...cached.response,
        sourceType,
      },
    });
  }

  // Reserve a daily credit only after validation and cache lookup.
  // If the model request fails, the credit is refunded below.
  let creditReserved = false;
  const rateLimitResult = await checkAndIncrementRateLimit(req.user._id);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      code: "AI_DAILY_LIMIT_EXCEEDED",
      message: `Daily AI usage limit reached. Used ${rateLimitResult.used} of ${rateLimitResult.limit} today.`,
    });
  }
  creditReserved = true;

  // 3. Call AI Service (Stream or Static)
  let result;
  try {
    result = await runAiAssist({
      action,
      text: sourceText,
      stream: !!stream,
    });
  } catch (error) {
    if (creditReserved) await refundDailyCount(req.user._id);
    throw error;
  }

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let finalSuggestion = "";
    const parser = new SseStreamParser();
    const responseDecoder = new TextDecoder();

    try {
      for await (const chunk of result) {
        let chunkText = "";

        if (typeof chunk.text === "function") {
          // Gemini Path
          chunkText = chunk.text();
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: chunkText } }] })}\n\n`,
          );
          finalSuggestion += chunkText;
        } else {
          // OpenRouter Path
          const rawChunkText = responseDecoder.decode(chunk, { stream: true });
          res.write(rawChunkText);

          // Use parser to safely reconstruct fragmented lines for backend caching
          const events = parser.processChunk(chunk);
          for (const data of events) {
            if (data.type === "error" || data.error) {
              const errorMsg =
                data.message || data.error?.message || "AI model error";
              throw new Error(errorMsg);
            }

            finalSuggestion += data.choices?.[0]?.delta?.content || "";
          }
        }
      }

      if (!finalSuggestion.trim()) {
        throw new Error("AI model returned an empty response");
      }

      // Save the streamed result to cache after completion
      await AiAssistCache.findOneAndUpdate(
        {
          user: req.user._id,
          note: note?._id || null,
          action,
          sourceType,
          inputHash,
        },
        {
          user: req.user._id,
          note: note?._id || null,
          action,
          sourceType,
          inputHash,
          noteUpdatedAt: note?.updatedAt || new Date(),
          response: {
            action,
            suggestion: finalSuggestion,
            original: sourceText,
            errors: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (err) {
      if (creditReserved) {
        await refundDailyCount(req.user._id);
        creditReserved = false;
      }
      console.error("AI Assist Stream Error:", err.message);
      res.write(
        `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`,
      );
    } finally {
      res.end();
    }
    return;
  }

  // 🛡️ Static Path
  try {
    if (action === "grammar" && !hasSelection && note) {
      note.grammarErrors = result.errors;
      await note.save();
    }

    await AiAssistCache.findOneAndUpdate(
      {
        user: req.user._id,
        note: note?._id || null,
        action,
        sourceType,
        inputHash,
      },
      {
        user: req.user._id,
        note: note?._id || null,
        action,
        sourceType,
        inputHash,
        noteUpdatedAt: note?.updatedAt || new Date(),
        response: {
          action: result.action,
          suggestion: result.suggestion,
          errors: result.errors || [],
          original: result.original || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (creditReserved) await refundDailyCount(req.user._id);
    throw error;
  }

  res.status(200).json({
    success: true,
    cached: false,
    data: {
      ...result,
      sourceType,
    },
  });
});

// Chat controller helpers

/* Resolve or create the global chat session and load history */
const resolveSession = async (req) => {
  const { sessionId } = req.body;
  const noteId = req.body.noteId || null;
  const isGlobalChat =
    !noteId &&
    typeof req.body.noteId === "undefined" &&
    typeof req.body.noteContext === "undefined" &&
    typeof req.body.structuredContext === "undefined";

  let session = null;
  let history = [];
  let summary = "";

  if (isGlobalChat) {
    if (sessionId) {
      session = await GlobalChatSession.findOne({
        _id: sessionId,
        user: req.user._id,
      });
    }
    if (session) {
      history = session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      summary = session.summary || "";
    }
  } else {
    history = Array.isArray(req.body.history) ? req.body.history : [];
  }

  let activeSessionId = sessionId;
  let activeSession = session;

  if (isGlobalChat && !activeSessionId) {
    const newSession = await GlobalChatSession.create({
      user: req.user._id,
      messages: [],
      chatMode: req.body.chatMode || "casual",
    });
    activeSessionId = newSession._id;
    activeSession = newSession;
  } else if (activeSession && req.body.chatMode && activeSession.chatMode !== req.body.chatMode) {
    // If user changed the mode during an existing session, update it
    activeSession.chatMode = req.body.chatMode;
    await activeSession.save();
  }

  return {
    isGlobalChat,
    noteId,
    session,
    history,
    summary: summary || "",
    activeSessionId,
    activeSession,
  };
};

// Run tool detection (web search / URL crawl) and return context + tool name
const resolveToolContext = async (message, res, isStreaming) => {
  let toolContext = "";
  let toolUsed = null;

  if (!mightNeedWeb(message)) return { toolContext, toolUsed };

  const toolDecision = await detectTools(message);

  if (toolDecision.tool === "search_web") {
    toolUsed = "search_web";
    if (isStreaming)
      res.write(
        `data: ${JSON.stringify({ type: "tool_call", tool: "search_web" })}\n\n`,
      );
    const searchResults = await performWebSearch(toolDecision.query);
    toolContext = `\n[WEB SEARCH RESULTS for "${toolDecision.query}"]\n${searchResults}\n[/end of web search results]\n`;
  } else if (toolDecision.tool === "crawl_url") {
    toolUsed = "crawl_url";
    if (isStreaming)
      res.write(
        `data: ${JSON.stringify({ type: "tool_call", tool: "crawl_url" })}\n\n`,
      );
    const pageContent = await crawlUrl(toolDecision.query);
    toolContext = `\n[WEBPAGE CONTENT from ${toolDecision.query}]\n${pageContent.slice(0, 6000)}\n[END WEBPAGE]\n`;
  }

  return { toolContext, toolUsed };
};

// Fetch note context from the DB or frontend payload (skipped when a tool was used)
const resolveNoteContext = async (
  req,
  { isGlobalChat, noteId, history, toolUsed },
) => {
  const { noteContext: reqNoteContext, structuredContext, hasSelection, message, contextChanged } = req.body;
  let noteContext = "";
  let noteFetched = false;

  // Only fetch note context if the message is actually about the note/editor context.
  // We allow this even if a tool was used, so you can compare web data with note data.
  const isNoteQuery =
    noteId && (hasSelection || shouldFetchNote(message, history, contextChanged));
  const shouldIncludeContext = !!isNoteQuery;

  if (shouldIncludeContext) {
    if (structuredContext) {
      noteContext = formatStructuredNoteContext(structuredContext);
    } else if (reqNoteContext) {
      noteContext = hasSelection
        ? `[User specifically highlighted this text in their editor]:\n${reqNoteContext}`
        : `[user's current editor context]:\n${reqNoteContext}`;
    } else {
      const note = await Notes.findOne({
        _id: noteId,
        user: req.user._id,
      }).lean();
      if (note?.content) {
        noteContext = `Title: ${note.title || "Untitled"}\n\n${stripHtml(note.content).slice(0, 1500)}`;
        noteFetched = true;
      }
    }
  }

  return { noteContext, noteFetched };
};

// Set up SSE headers and fire the keep-alive comment
const openSseConnection = (res, activeSessionId) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Expose-Headers", "X-Session-Id");
  if (activeSessionId)
    res.setHeader("X-Session-Id", activeSessionId.toString());
  res.write(": keep-alive\n\n");
};

// Pipe OpenRouter SSE chunks to the client and accumulate the full reply
const streamAiResponse = async (
  stream,
  res,
  noteFetched,
  userId,
  userMessage = "",
  shouldSearchWeb = false
) => {
  const decoder = new TextDecoder();
  let finalReply = "";
  const parser = new SseStreamParser();
  let memoryToolArgs = "";
  let memoryToolIndex = -1;
  let quizToolArgs = "";
  let quizToolIndex = -1;

  // Web tools & citations tracking
  const webSearchToolCalls = new Map(); // index -> { query, emitted, lastEmittedQuery }
  const webFetchToolCalls = new Map(); // index -> { url, emitted, lastEmittedUrl }
  const citationsMap = new Map(); // normalizedUrl -> { url, title, content }
  const toolCalls = [];

  const cleanInitialQuery = extractCleanSearchQuery(userMessage);

  // Immediately notify the client if web search is enabled for this turn
  if (shouldSearchWeb) {
    webSearchToolCalls.set(0, {
      query: cleanInitialQuery,
      emitted: true,
      lastEmittedQuery: cleanInitialQuery,
    });
    res.write(
      `data: ${JSON.stringify({
        type: "tool_call",
        tool: "search_web",
        query: cleanInitialQuery,
      })}\n\n`
    );
  }

  if (noteFetched) {
    res.write(
      `data: ${JSON.stringify({ type: "tool_call", tool: "get_note_content" })}\n\n`,
    );
  }

  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    res.write(text);

    const events = parser.processChunk(chunk);

    for (const data of events) {
      const choice = data.choices?.[0];

      // Check if model emitted reasoning formulating a refined search query
      if (choice?.delta?.reasoning) {
        const r = choice.delta.reasoning;
        const qMatch =
          r.match(/(?:call\s+)?(?:openrouter_)?web_search.*?query\s*(?:is|as|=|:)?\s*["']([^"'\n]+)["']/i) ||
          r.match(/query\s*:\s*["']([^"'\n]+)["']/i) ||
          r.match(/searching\s+for\s+["']([^"'\n]+)["']/i);
        if (qMatch && qMatch[1] && qMatch[1].trim().length > 2) {
          const refined = qMatch[1].trim();
          let state = webSearchToolCalls.get(0);
          if (!state) {
            state = { query: refined, emitted: true, lastEmittedQuery: refined };
            webSearchToolCalls.set(0, state);
          }
          if (state.lastEmittedQuery !== refined) {
            state.query = refined;
            state.lastEmittedQuery = refined;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                tool: "search_web",
                query: refined,
              })}\n\n`
            );
          }
        }
      }

      // 1. Intercept choice annotations (citations)
      if (choice?.delta?.annotations && Array.isArray(choice.delta.annotations)) {
        let hasNewCitation = false;
        for (const ann of choice.delta.annotations) {
          if (ann?.type === "url_citation" && ann.url_citation?.url) {
            const rawUrl = String(ann.url_citation.url).trim();
            const normUrl = rawUrl.toLowerCase();
            if (!citationsMap.has(normUrl)) {
              citationsMap.set(normUrl, {
                url: rawUrl,
                title: ann.url_citation.title || "",
                content: ann.url_citation.content || "",
              });
              hasNewCitation = true;
            }
          }
        }
        if (hasNewCitation) {
          // If server tool executed without client delta.tool_calls, ensure search_web event was emitted
          if (webSearchToolCalls.size === 0) {
            const q = cleanInitialQuery || "web sources";
            webSearchToolCalls.set(0, { query: q, emitted: true, lastEmittedQuery: q });
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                tool: "search_web",
                query: q,
              })}\n\n`
            );
          }

          res.write(
            `data: ${JSON.stringify({
              type: "tool_call",
              tool: "web_citations",
              citations: Array.from(citationsMap.values()),
            })}\n\n`
          );
        }
      }

      // 2. Intercept and detect tool calls delta
      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const toolName = tc.function?.name;
          const toolIndex = tc.index ?? 0;

          if (
            toolName === "openrouter:web_search" ||
            webSearchToolCalls.has(toolIndex)
          ) {
            let state = webSearchToolCalls.get(toolIndex);
            if (!state) {
              state = { query: "", emitted: false, lastEmittedQuery: "" };
              webSearchToolCalls.set(toolIndex, state);
            }
            if (tc.function?.arguments) {
              state.query += tc.function.arguments;
            }

            let parsedQuery = "";
            try {
              if (state.query) {
                const parsed = JSON.parse(state.query);
                if (parsed.query) parsedQuery = parsed.query;
              }
            } catch (_) {
              const qMatch = state.query.match(/"query"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
              if (qMatch) parsedQuery = qMatch[1];
            }

            if (!state.emitted || (parsedQuery && state.lastEmittedQuery !== parsedQuery)) {
              state.emitted = true;
              state.lastEmittedQuery = parsedQuery;
              res.write(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  tool: "search_web",
                  query: parsedQuery,
                })}\n\n`,
              );
            }
          } else if (
            toolName === "openrouter:web_fetch" ||
            webFetchToolCalls.has(toolIndex)
          ) {
            let state = webFetchToolCalls.get(toolIndex);
            if (!state) {
              state = { url: "", emitted: false, lastEmittedUrl: "" };
              webFetchToolCalls.set(toolIndex, state);
            }
            if (tc.function?.arguments) {
              state.url += tc.function.arguments;
            }

            let parsedUrl = "";
            try {
              if (state.url) {
                const parsed = JSON.parse(state.url);
                if (parsed.url) parsedUrl = parsed.url;
              }
            } catch (_) {
              const uMatch = state.url.match(/"url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
              if (uMatch) parsedUrl = uMatch[1];
            }

            if (!state.emitted || (parsedUrl && state.lastEmittedUrl !== parsedUrl)) {
              state.emitted = true;
              state.lastEmittedUrl = parsedUrl;
              res.write(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  tool: "crawl_url",
                  url: parsedUrl,
                })}\n\n`,
              );
            }
          } else if (toolName === "generate_quiz") {
            quizToolIndex = tc.index;
            if (tc.function?.arguments) {
              quizToolArgs += tc.function.arguments;
            }
          } else if (toolName === "save_memory") {
            memoryToolIndex = tc.index;
            if (tc.function?.arguments) {
              memoryToolArgs += tc.function.arguments;
            }
          } else if (memoryToolIndex !== -1 && tc.index === memoryToolIndex) {
            if (tc.function?.arguments) {
              memoryToolArgs += tc.function.arguments;
            }
          } else if (quizToolIndex !== -1 && tc.index === quizToolIndex) {
            if (tc.function?.arguments) quizToolArgs += tc.function.arguments;
          }
        }
      }

      finalReply +=
        choice?.delta?.content ||
        choice?.message?.content ||
        data.content ||
        data.text ||
        "";
    }
  }

  // Record completed web search calls into toolCalls
  for (const [_, state] of webSearchToolCalls) {
    let finalQuery = "";
    try {
      if (state.query) {
        const parsed = JSON.parse(state.query);
        finalQuery = parsed.query || "";
      }
    } catch (_) {}
    toolCalls.push({
      tool: "search_web",
      query: finalQuery || state.lastEmittedQuery || "",
    });
  }

  // Record completed web fetch calls into toolCalls
  for (const [_, state] of webFetchToolCalls) {
    let finalUrl = "";
    try {
      if (state.url) {
        const parsed = JSON.parse(state.url);
        finalUrl = parsed.url || "";
      }
    } catch (_) {}
    toolCalls.push({
      tool: "crawl_url",
      url: finalUrl || state.lastEmittedUrl || "",
    });
  }

  // Record citations into toolCalls and ensure search_web is present if citations exist or web was searched
  if (citationsMap.size > 0 || shouldSearchWeb) {
    const finalCitations = Array.from(citationsMap.values());
    if (finalCitations.length > 0) {
      toolCalls.push({
        tool: "web_citations",
        citations: finalCitations,
      });
    }
    if (!toolCalls.some((t) => t.tool === "search_web")) {
      const q = webSearchToolCalls.get(0)?.query || cleanInitialQuery || "web sources";
      toolCalls.push({ tool: "search_web", query: q });
    }
    // Emit final clean citations snapshot to client if any citations exist
    if (finalCitations.length > 0) {
      res.write(
        `data: ${JSON.stringify({
          type: "tool_call",
          tool: "web_citations",
          citations: finalCitations,
        })}\n\n`
      );
    }
  }

  // Execute memory save if triggered
  if (memoryToolIndex !== -1 && memoryToolArgs) {
    try {
      const args = JSON.parse(memoryToolArgs);
      // Only save if we have both
      if (args.category && args.content && userId) {
        // we need to dynamically import or require saveMemory to avoid circular deps
        import("../services/memoryService.js").then(({ saveMemory }) => {
          saveMemory(userId, args).catch(console.error);
        });
        res.write(
          `data: ${JSON.stringify({ type: "tool_call", tool: "save_memory" })}\n\n`,
        );

        // Register the tool call in toolCalls so it gets saved to the session database
        toolCalls.push({
          tool: "save_memory",
          category: args.category,
          content: args.content,
        });

        // Fallback: If the model didn't stream any text before calling the tool, generate a friendly reply
        if (!finalReply.trim()) {
          finalReply = `Got it! I've saved that to my memory: "${args.content}"`;
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`,
          );
        }
      }
    } catch (err) {
      console.error(
        `Failed to parse save_memory arguments: ${err.message}. Raw args:`,
        memoryToolArgs,
      );
    }
  }

  if (quizToolIndex !== -1 && quizToolArgs) {
    try {
      const args = JSON.parse(quizToolArgs);
      if (args.questions && args.questions.length > 0) {
        res.write(
          `data: ${JSON.stringify({ type: "tool_call", tool: "render_quiz", quizData: args.questions })}\n\n`,
        );
        toolCalls.push({ tool: "render_quiz", quizData: args.questions });
      }
    } catch (err) {
      console.error(
        `Failed to parse generate_quiz arguments: ${err.message}. Raw args:`,
        quizToolArgs,
      );
    }
  }

  return { finalReply, toolCalls };
};

// Save the completed turn to the global-chat session in MongoDB
const persistToDb = async (
  message,
  finalReply,
  imageBase64,
  activeSessionId,
  activeSession,
  summary = "",
  toolCalls = [],
) => {
  const isImageUrl =
    typeof imageBase64 === "string" && /^https?:\/\//i.test(imageBase64);
  const safeUserContent = imageBase64
    ? `${isImageUrl ? `[Attached Image](${imageBase64})` : "[Attached Image]"}\n${message}`.trim()
    : message;

  const sessionToUpdate =
    activeSession || (await GlobalChatSession.findById(activeSessionId));
  if (!sessionToUpdate) return;

  if (!finalReply?.trim() && toolCalls.length === 0) {
    console.warn(
      "Skipping chat persistence because assistant reply and tool calls were both empty.",
    );
    return;
  }

  sessionToUpdate.messages.push(
    { role: "user", content: safeUserContent },
    { role: "assistant", content: finalReply, toolCalls },
  );
  if (summary) sessionToUpdate.summary = summary;
  await sessionToUpdate.save();

  const shouldGenerateTitle =
    (!sessionToUpdate.title || sessionToUpdate.title === "New Chat") &&
    sessionToUpdate.messages.filter((msg) => msg.role === "user").length >= 2;

  if (shouldGenerateTitle) {
    console.log("🏷️ Generating title for session:", activeSessionId);

    // Use only the first user message + first assistant reply.
    // Avoids noise from system prompts, tool calls, and image blobs.
    const firstUser = sessionToUpdate.messages.find((m) => m.role === "user");
    const firstAssistant = sessionToUpdate.messages.find((m) => m.role === "assistant");
    const titleContext = [
      firstUser ? `User: ${firstUser.content}` : "",
      firstAssistant ? `Assistant: ${firstAssistant.content}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    generateTitle(titleContext)
      .then((title) => {
        console.log("✅ Title generated:", title);
        return GlobalChatSession.findByIdAndUpdate(activeSessionId, {
          title,
        }).exec();
      })
      .catch((err) => console.error("❌ Title update failed:", err.message));
  }
};

//  Main chat controller

export const chatWithAiController = catchAsync(async (req, res) => {
  const { message, imageBase64, pdfContext, stream, useReasoning, enableWeb, chatMode } =
    req.body;

  if ((!message || !message.trim()) && !imageBase64) {
    return res
      .status(400)
      .json({ success: false, message: "Message or Image is required" });
  }

  // 1. Resolve session & history
  let sessionData = await resolveSession(req);
  let {
    isGlobalChat,
    history,
    summary: sessionSummary,
    activeSessionId,
    activeSession,
  } = sessionData;

  // Context-aware history management (Large Context Window Strategy)
  // 1. Keep approximately the last 16 messages in full (untruncated)
  // 2. Older messages outside the recent window are consolidated into a state-preserving rolling summary
  const RECENT_MESSAGE_COUNT = 16;
  const SUMMARY_TRIGGER_COUNT = 24;

  let effectiveHistory = history;

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
        console.warn("⚠️ [ChatController] Conversation summarization failed:", sumErr.message);
      }
    }

    effectiveHistory = recentHistory;
  }

  if (isGlobalChat && req.body.sessionId && !sessionData.session) {
    return res
      .status(404)
      .json({ success: false, message: "Session not found" });
  }

  // 2. Open SSE early so the browser isn't waiting blind
  const isStreaming = !!stream;
  const shouldSearchWeb = enableWeb === true; // Only enable web tools when explicitly toggled on

  if (isStreaming) {
    openSseConnection(res, activeSessionId);
  }

  // 3. Note context (always fetched when relevant to note context)
  const { noteContext, noteFetched } = await resolveNoteContext(req, {
    ...sessionData,
    toolUsed: null,
  });

  console.log("📊 [AI_TELEMETRY_BACKEND]", {
    userId: req.user._id,
    noteId: req.body.noteId || null,
    hasSelection: req.body.hasSelection || false,
    contextChanged: req.body.contextChanged || false,
    contextLength: (noteContext || "").length,
    noteFetched,
    isGlobalChat: sessionData.isGlobalChat,
    timestamp: new Date().toISOString(),
  });

  // 4. Retrieve User Facts & Memories (Direct Indexed DB Fetch, NO vector search on chat messages)
  let result;
  try {
    let memoryContext = "";
    if (req.user?._id) {
      try {
        const memories = await Memory.find({ user: req.user._id })
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

    const userName = req.user?.name
      ? `You are talking to a user named ${req.user.name}. Address them politely when appropriate.`
      : "";
    let finalSystemPrompt = `${userName}${memoryContext}`;

    const currentMode = activeSession?.chatMode || chatMode || "casual";

    // Autonomous tools: save_memory tool allows LLM to store information on demand
    const saveMemoryTool = {
      type: "function",
      function: {
        name: "save_memory",
        description:
          "Save an important personal fact, preference, goal, or detail explicitly shared by the user about themselves into long-term memory.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["PROFILE", "PREFERENCE", "GOAL", "PROJECT", "SKILL", "OTHER"],
              description: "Category of the memory",
            },
            content: {
              type: "string",
              description: "The concise factual detail to remember about the user",
            },
          },
          required: ["category", "content"],
        },
      },
    };

    const quizTool = {
      type: "function",
      function: {
        name: "generate_quiz",
        description: `Generate a multiple-choice quiz based on the user's request and context.
CRITICAL: Before calling this tool, you MUST generate a conversational message (e.g. 'Here is a quick quiz to test your knowledge:'). After calling the tool, DO NOT output any more text. DO NOT include the correct answer or explanation in the tool call.

MCQ GENERATION RULES:
- Ask exactly one concept per question.
- Question: 20-60 words (hard limit: 75).
- Options: exactly 4.
- Option length: 2-10 words (hard limit: 12).
- Distractors should be plausible but clearly incorrect.
- Prefer direct or scenario-based questions.
- Avoid unnecessary context and filler.
- The entire card should be readable in under 15 seconds.`,
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "A unique identifier for this question (e.g. q1)",
                  },
                  question: { type: "string", description: "The quiz question" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "4 possible answers",
                  },
                },
                required: ["id", "question", "options"],
              },
            },
          },
          required: ["questions"],
        },
      },
    };

    const tools = [
      saveMemoryTool,
      ...(currentMode === "study" ? [quizTool] : []),
    ];

    const effectiveReasoning = useReasoning === true || useReasoning === "true";

    result = await chatWithAi({
      message,
      history: effectiveHistory,
      summary: sessionSummary || req.body.summary || "",
      noteContext: noteContext,
      webContext: "",
      systemPrompt: finalSystemPrompt,
      pdfContext: pdfContext || "",
      imageBase64,
      stream: isStreaming,
      useReasoning: effectiveReasoning,
      enableWeb: shouldSearchWeb,
      chatMode: activeSession?.chatMode || chatMode || "casual",
      tools: tools,
    });
  } catch (aiError) {
    console.error("❌ All AI models failed:", aiError.message);
    if (isStreaming) {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: "AI service unavailable" })}\n\n`,
      );
      res.end();
    }
    return;
  }

  // 6. Stream or return the response
  let finalReply = "";

  let toolCalls = [];

  if (isStreaming) {
    try {
      const responseObj = await streamAiResponse(
        result.stream,
        res,
        noteFetched,
        req.user._id,
        message,
        shouldSearchWeb
      );
      finalReply = responseObj.finalReply;
      toolCalls = responseObj.toolCalls;
      // Send metadata (like extracted PDF text) after the stream completes
      if (result.pdfContext) {
        res.write(
          `data: ${JSON.stringify({ type: "metadata", pdfContext: result.pdfContext })}\n\n`,
        );
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError.message);
    } finally {
      res.end();
    }
  } else {
    finalReply = result.reply;
  }

  // 7. Persist to DB (global chat only)
  if (isGlobalChat && activeSessionId) {
    await persistToDb(
      message,
      finalReply,
      imageBase64,
      activeSessionId,
      activeSession,
      result.summary,
      toolCalls
    );
  }

  if (isStreaming) return;

  // 8. Static JSON response
  res.status(200).json({
    success: true,
    data: {
      reply: finalReply,
      segments: parseIrisResponse(finalReply),
      history: [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: finalReply, toolCalls },
      ],
      sessionId: activeSessionId,
      pdfContext: result.pdfContext,
      chatMode: activeSession?.chatMode || chatMode || "study",
    },
  });
});

// GET /api/ai/chat/session/:sessionId — load messages for a specific session
export const getChatSessionController = catchAsync(async (req, res) => {
  const session = await GlobalChatSession.findOne({
    _id: req.params.sessionId,
    user: req.user._id,
  }).lean();

  if (!session) {
    return res
      .status(404)
      .json({ success: false, message: "Session not found" });
  }

  res.status(200).json({
    success: true,
    data: {
      messages: session.messages.map((message) => ({
        ...message,
        segments:
          message.role === "assistant"
            ? parseIrisResponse(message.content)
            : undefined,
      })),
      title: cleanSessionTitle(session.title),
      chatMode: session.chatMode,
    },
  });
});

// GET /api/ai/sessions — sidebar: list all sessions (no messages, just metadata)
export const getAllSessionsController = catchAsync(async (req, res) => {
  const sessions = await GlobalChatSession.find({ user: req.user._id })
    .select("title updatedAt") // only what the sidebar needs
    .sort({ updatedAt: -1 }) // newest first
    .limit(20) // cap at 20 — sidebar doesn't need more
    .lean();

  res.status(200).json({
    success: true,
    data: {
      sessions: sessions.map((session) => ({
        ...session,
        title: cleanSessionTitle(session.title),
      })),
    },
  });
});

// GET /api/public/prompts — dynamic quick prompts for the chat empty state
export const getDynamicPromptsController = catchAsync(async (req, res) => {
  const prompts = await getDynamicPrompts();

  res.status(200).json({
    success: true,
    data: prompts,
  });
});

async function incrementDailyCount(userId) {
  const now = new Date();
  // Midnight of today in server's local time
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Atomic update: if lastResetAt is before today OR doesn't exist, reset to 1.
  const resetUpdate = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { "aiUsage.lastResetAt": { $lt: startOfToday } },
        { "aiUsage.lastResetAt": { $exists: false } },
        { aiUsage: { $exists: false } },
      ],
    },
    { $set: { "aiUsage.dailyCount": 1, "aiUsage.lastResetAt": now } },
  );

  // If the above didn't match anything, it means lastResetAt is today. Just increment.
  if (!resetUpdate) {
    await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { "aiUsage.dailyCount": 1 } },
    );
  }
}

async function refundDailyCount(userId) {
  await User.findOneAndUpdate(
    { _id: userId, "aiUsage.dailyCount": { $gt: 0 } },
    { $inc: { "aiUsage.dailyCount": -1 } },
  );
}

async function checkAndIncrementRateLimit(userId) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Fetch only the fields we need — don't load the whole user document
  const user = await User.findById(userId).select("aiUsage");
  if (!user) return { allowed: false, reason: "User not found" };

  const limit = getEffectiveDailyLimit(user);

  // If their last reset was yesterday (or earlier), or missing, their effective count is 0
  const isNewDay =
    !user.aiUsage?.lastResetAt || user.aiUsage.lastResetAt < startOfToday;
  const effectiveCount = isNewDay ? 0 : user.aiUsage?.dailyCount || 0;

  if (effectiveCount >= limit) {
    return { allowed: false, used: effectiveCount, limit };
  }

  // Under the limit — record this usage
  await incrementDailyCount(userId);
  return { allowed: true, used: effectiveCount + 1, limit };
}
