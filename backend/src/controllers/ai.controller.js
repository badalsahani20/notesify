import mongoose from "mongoose";
import User from "../models/user.model.js";
import Notes from "../models/notes.model.js";
import AiAssistCache from "../models/aiAssistCache.model.js";
import catchAsync from "../utils/catchAsync.js";
import { generateConversationTitle } from "../services/title.service.js";
import {
  checkGrammar,
  runAiAssist,
  getDynamicPrompts,
  irisAgent,
  irisStreamHandler,
  resolveChatContext,
} from "../services/ai.service.js";
import GlobalChatSession from "../models/globalChatSession.model.js";
import { stripHtml } from "../utils/stripHtml.js";
import { parseIrisResponse } from "../utils/parseIrisResponse.js";
import getEffectiveDailyLimit from "../utils/getEffectiveDailyLimit.js";
import { SseStreamParser } from "../utils/sseParser.js";
import agentRunService from "../services/ai/agent/agentRunService.js";
import {cleanSessionTitle, hashText} from "../utils/hashText.js"


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

/* Resolve or create the conversation and load history */
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
        toolCalls: m.toolCalls,
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
      scope: "global",
      noteId: null,
      messages: [],
      chatMode: req.body.chatMode || "casual",
    });
    activeSessionId = newSession._id;
    activeSession = newSession;
  } else if (!isGlobalChat && noteId && noteId !== "new" && mongoose.isValidObjectId(noteId)) {
    session = await GlobalChatSession.findOne({
      user: req.user._id,
      scope: "note",
      noteId,
    });

    if (!session) {
      session = await GlobalChatSession.create({
        user: req.user._id,
        scope: "note",
        noteId,
        title: "Note Chat",
        messages: [],
        chatMode: req.body.chatMode || "study",
      });
    }

    activeSessionId = session._id;
    activeSession = session;
  } else if (activeSession && req.body.chatMode && activeSession.chatMode !== req.body.chatMode) {
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

const writeSseError = (res, message = "AI service unavailable") => {
  if (res.writableEnded || res.destroyed) return;

  try {
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
  } catch (writeError) {
    console.error("❌ Failed to write SSE error:", writeError.message);
  }
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

  const userTurnCount = sessionToUpdate.messages.filter((msg) => msg.role === "user").length;
  const isUntitled = !sessionToUpdate.title || sessionToUpdate.title === "New Chat";


  const shouldGenerateTitle =
    (isUntitled && userTurnCount >= 1) ||
    (sessionToUpdate.title === "New Conversation" && userTurnCount === 2);

  if (shouldGenerateTitle) {
    console.log("🏷️ Generating conversation title for session:", activeSessionId);

    generateConversationTitle(sessionToUpdate.messages)
      .then((title) => {
        const cleanTitle = cleanSessionTitle(title);
        console.log("✅ Conversation title generated:", cleanTitle);
        return GlobalChatSession.findByIdAndUpdate(activeSessionId, {
          title: cleanTitle,
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
    activeSessionId,
    activeSession,
  } = sessionData;

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

  // 3. Resolve chat context. This happens after SSE starts, so convert any
  // setup failure into an SSE error instead of letting Express destroy the socket.
  let resolvedContext;
  try {
    resolvedContext = await resolveChatContext({
      user: req.user,
      body: req.body,
      sessionData,
    });
  } catch (err) {
    console.error("❌ Chat context resolution failed:", err);
    if (isStreaming) {
      writeSseError(res, "Unable to prepare the chat context");
      res.end();
      return;
    }
    throw err;
  }

  const {
    effectiveHistory,
    sessionSummary,
    noteContext,
    noteFetched,
    finalSystemPrompt,
    currentMode,
    isNoteScoped,
    activeNoteId,
    tools,
  } = resolvedContext;

  const effectiveReasoning = useReasoning === true || useReasoning === "true";

  let runId = null;

  if (activeSessionId) {
    try {
      const run = await agentRunService.createRun({
        conversationId: activeSessionId,
        userId: req.user._id,
        input: {
          message,
          hasImage: Boolean(imageBase64),
          chatMode: currentMode,
        },
        agentState: {
          currentRound: 0,
          history: effectiveHistory,
          summary: sessionSummary || "",
          systemPrompt: finalSystemPrompt,
          noteContext,
          activeNoteId,
          chatMode: currentMode,
          useReasoning: effectiveReasoning,
          enableWeb: shouldSearchWeb,
          extraMessages: [],
          noteFetched,
          isNoteScoped,
          tools,
          pdfContext: pdfContext || "",
        },
      });

      // Keep the id immediately. If starting the run fails, we can still mark
      // the queued record as failed instead of leaving it stuck forever.
      runId = run.runId;

      console.info("[IrisRun] created", {
        runId,
        conversationId: activeSessionId,
        userId: String(req.user._id),
        scope: isNoteScoped ? "note" : "global",
        activeNoteId: activeNoteId || null,
      });

      const startedRun = await agentRunService.startRun({
        runId,
        userId: req.user._id,
      });

      if (!startedRun) {
        throw new Error("Unable to start agent run");
      }
    } catch (err) {
      console.error("❌ Agent run setup failed:", err);

      if (runId) {
        await agentRunService.markFailed({
          runId,
          userId: req.user._id,
          error: err.message,
        });
      }

      if (isStreaming) {
        writeSseError(res, "Unable to start the AI run");
        res.end();
        return;
      }
      throw err;
    }
  }

  let finalReply = "";
  let toolCalls = [];
  let pdfContextToEmit = pdfContext || "";

  try {
    const agentResult = await irisAgent.run({
      message,
      history: effectiveHistory,
      summary: sessionSummary || req.body.summary || "",
      noteContext,
      noteFetched,
      systemPrompt: finalSystemPrompt,
      pdfContext: pdfContext || "",
      imageBase64,
      stream: isStreaming,
      useReasoning: effectiveReasoning,
      enableWeb: shouldSearchWeb,
      chatMode: currentMode,
      tools,
      isNoteScoped,
      userId: req.user._id,
      activeNoteId,
      res,

      // Stream handler invocation
      streamAiResponse: (stream, res, noteFetched, userId) =>
        irisStreamHandler.handle({
          stream,
          res,
          noteFetched,
          userId,
          fallbackNoteId: activeNoteId,
        }),
      executeServerTool: (toolName, args, uId, fallbackNoteId) =>
        irisStreamHandler.executeServerTool(
          toolName,
          args,
          uId,
          fallbackNoteId || activeNoteId,
        ),
    });

    if (runId && agentResult.status === "waiting_for_user") {
      const interaction = {
        ...agentResult.interaction,
        runId,
      };

      console.info("[IrisInteraction] checkpoint created", {
        runId,
        interactionId: interaction.interactionId,
        checkpointId: interaction.checkpointId,
        conversationId: activeSessionId,
        questionCount: interaction.questions?.length ?? 0,
      });

      const checkpoint = {
        checkpointId: interaction.checkpointId,
        interactionId: interaction.interactionId,
        type: interaction.type,
        toolName: "ask_question",
        toolArguments: {
          purpose: interaction.purpose,
          title: interaction.title,
          questions: interaction.questions,
        },
        assistantReply: agentResult.finalReply,
        toolCalls: agentResult.toolCalls,
      };

      const waitingRun = await agentRunService.markWaitingForUser({
        runId,
        userId: req.user._id,
        checkpoint,
      });

      if (!waitingRun) {
        throw new Error("Unable to pause agent run");
      }

      const sessionForInteraction =
        activeSession ||
        (await GlobalChatSession.findOne({
          _id: activeSessionId,
          user: req.user._id,
        }));

      if (!sessionForInteraction) {
        throw new Error("Conversation not found");
      }

      sessionForInteraction.pendingInteraction = interaction;
      await sessionForInteraction.save();
    }

    if (runId && agentResult.status === "completed") {
      await agentRunService.markCompleted({
        runId,
        userId: req.user._id,
        finalReply: agentResult.finalReply,
        toolCalls: agentResult.toolCalls,
      });
    }

    finalReply = agentResult.finalReply;
    toolCalls = agentResult.toolCalls;
    pdfContextToEmit = agentResult.pdfContext;

    // Persist before closing the SSE response. If this fails, the client gets
    // a proper SSE error event instead of a half-closed chunked response.
    if (isGlobalChat && activeSessionId) {
      await persistToDb(
        message,
        finalReply,
        imageBase64,
        activeSessionId,
        activeSession,
        sessionSummary,
        toolCalls,
      );
    }
  } catch (err) {
    console.error("❌ Controller error:", err);

    if (runId) {
      await agentRunService.markFailed({
        runId,
        userId: req.user._id,
        error: err.message,
      });
    }

    if (isStreaming) {
      writeSseError(res, "The AI request could not be completed");
    } else {
      throw err;
    }
  } finally {
    if (isStreaming && !res.writableEnded) {
      if (pdfContextToEmit) {
        res.write(
          `data: ${JSON.stringify({ type: "metadata", pdfContext: pdfContextToEmit })}\n\n`,
        );
      }
      res.end();
    }
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
      pdfContext: pdfContextToEmit,
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
      pendingInteraction: session.pendingInteraction || null,
    },
  });
});

// GET /api/ai/sessions — sidebar: list all sessions (no messages, just metadata)
export const getAllSessionsController = catchAsync(async (req, res) => {
  const sessions = await GlobalChatSession.find({
    user: req.user._id,
    $or: [{ scope: "global" }, { scope: { $exists: false } }],
  })
    .select("title updatedAt") // only what the sidebar needs
    .sort({ updatedAt: -1 }) // newest first
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

export const reportToolResultController = catchAsync(async (req, res) => {
  const { sessionId, toolCallId, tool, status, data, error } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId is required" });
  }

  const session = await GlobalChatSession.findOne({
    _id: sessionId,
    user: req.user._id,
  });

  if (!session) {
    return res.status(404).json({ success: false, message: "Session not found" });
  }

  let updated = false;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        if ((toolCallId && tc.id === toolCallId) || (!toolCallId && tc.tool === tool)) {
          tc.status = status;
          if (data) tc.data = data;
          if (error) tc.error = error;
          updated = true;
          break;
        }
      }
      if (updated) break;
    }
  }

  if (updated) {
    session.markModified("messages");
    await session.save();
  }

  return res.json({ success: true, updated });
});

export const answerInteractionController = catchAsync(async (req, res) => {
  const { answer } = req.body;

  if (
    answer === undefined ||
    answer === null ||
    (typeof answer === "string" && !answer.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "answer is required",
    });
  }

  const conversation = await GlobalChatSession.findOneAndUpdate(
    {
      user: req.user._id,
      "pendingInteraction.interactionId": req.params.interactionId,
      "pendingInteraction.status": "pending",
    },
    {
      $set: {
        "pendingInteraction.status": "resuming",
        "pendingInteraction.answer": answer,
        "pendingInteraction.answeredAt": new Date(),
      },
    },
    { new: true },
  );

  if (!conversation) {
    console.warn("[IrisInteraction] answer rejected: not pending", {
      interactionId: req.params.interactionId,
      userId: String(req.user._id),
    });
    return res.status(409).json({
      success: false,
      message: "Interaction is no longer pending",
    });
  }

  const claimedInteraction = conversation.pendingInteraction;
  const runId = claimedInteraction.runId;
  const answerContent =
    typeof claimedInteraction.answer === "string"
      ? claimedInteraction.answer
      : JSON.stringify(claimedInteraction.answer);
  const run = await agentRunService.getRun({
    runId,
    userId: req.user._id,
  });

  console.info("[IrisInteraction] answer claimed", {
    interactionId: req.params.interactionId,
    runId,
    conversationId: String(conversation._id),
    answerLength: answerContent.length,
    runStatus: run?.status || "missing",
  });

  if (!run || run.status !== "waiting_for_user") {
    await GlobalChatSession.findOneAndUpdate(
      {
        _id: conversation._id,
        user: req.user._id,
        "pendingInteraction.interactionId": req.params.interactionId,
        "pendingInteraction.status": "resuming",
      },
      {
        $set: {
          "pendingInteraction.status": "pending",
        },
      },
    );

    return res.status(409).json({
      success: false,
      message: "Agent run is no longer waiting for this interaction",
    });
  }

  const resumedRun = await agentRunService.resumeRun({
    runId,
    userId: req.user._id,
  });

  if (!resumedRun) {
    console.warn("[IrisInteraction] resume rejected: already resumed", {
      interactionId: req.params.interactionId,
      runId,
    });
    return res.status(409).json({
      success: false,
      message: "Interaction is already being resumed",
    });
  }

  console.info("[IrisInteraction] run resumed", {
    interactionId: req.params.interactionId,
    runId,
  });

  openSseConnection(res, conversation._id);

  const state = run.agentState || {};
  const checkpoint = run.checkpoint || {};
  const toolCallId = claimedInteraction.interactionId;
  const originalMessage = run.input?.message || "";

  const initialExtraMessages = [
    {
      role: "user",
      content: originalMessage,
    },
    {
      role: "assistant",
      content: checkpoint.assistantReply || null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: "ask_question",
            arguments: JSON.stringify(checkpoint.toolArguments || {}),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: toolCallId,
      name: "ask_question",
      content: JSON.stringify({ answer: claimedInteraction.answer }),
    },
  ];

  let finalReply = "";
  let toolCalls = [];

  try {
    const agentResult = await irisAgent.run({
      message: originalMessage,
      history: state.history || [],
      summary: state.summary || "",
      noteContext: state.noteContext || "",
      noteFetched: Boolean(state.noteFetched),
      systemPrompt: state.systemPrompt || "",
      pdfContext: state.pdfContext || "",
      stream: true,
      useReasoning: Boolean(state.useReasoning),
      enableWeb: Boolean(state.enableWeb),
      chatMode: state.chatMode || "casual",
      tools: state.tools || null,
      isNoteScoped: Boolean(state.isNoteScoped),
      userId: req.user._id,
      activeNoteId: state.activeNoteId || null,
      res,
      initialExtraMessages,
      startRound: 1,
      includeCurrentMessage: false,
      streamAiResponse: (stream, response, noteFetched, userId) =>
        irisStreamHandler.handle({
          stream,
          res: response,
          noteFetched,
          userId,
          fallbackNoteId: state.activeNoteId || null,
        }),
      executeServerTool: (toolName, args, userId, fallbackNoteId) =>
        irisStreamHandler.executeServerTool(
          toolName,
          args,
          userId,
          fallbackNoteId || state.activeNoteId || null,
        ),
    });

    finalReply = agentResult.finalReply || "";
    toolCalls = agentResult.toolCalls || [];

    if (agentResult.status === "waiting_for_user") {
      const nextInteraction = {
        ...agentResult.interaction,
        runId,
      };

      console.info("[IrisInteraction] next checkpoint created", {
        previousInteractionId: req.params.interactionId,
        nextInteractionId: nextInteraction.interactionId,
        runId,
        questionCount: nextInteraction.questions?.length ?? 0,
      });

      const nextCheckpoint = {
        checkpointId: nextInteraction.checkpointId,
        interactionId: nextInteraction.interactionId,
        type: nextInteraction.type,
        toolName: "ask_question",
        toolArguments: {
          purpose: nextInteraction.purpose,
          title: nextInteraction.title,
          questions: nextInteraction.questions,
        },
        assistantReply: agentResult.finalReply,
        toolCalls: agentResult.toolCalls,
      };

      const waitingRun = await agentRunService.markWaitingForUser({
        runId,
        userId: req.user._id,
        checkpoint: nextCheckpoint,
      });

      if (!waitingRun) {
        throw new Error("Unable to pause resumed agent run");
      }

      await persistToDb(
        answerContent,
        finalReply,
        null,
        conversation._id,
        conversation,
        state.summary || "",
        toolCalls,
      );

      await GlobalChatSession.findOneAndUpdate(
        {
          _id: conversation._id,
          user: req.user._id,
          "pendingInteraction.interactionId": req.params.interactionId,
        },
        {
          $set: {
            pendingInteraction: nextInteraction,
          },
        },
      );
    } else {
      console.info("[IrisRun] resumed run completed", {
        interactionId: req.params.interactionId,
        runId,
        responseLength: finalReply.length,
        toolCallCount: toolCalls.length,
      });
      await agentRunService.markCompleted({
        runId,
        userId: req.user._id,
        finalReply,
        toolCalls: [...(run.toolCalls || []), ...toolCalls],
      });

      await persistToDb(
        answerContent,
        finalReply,
        null,
        conversation._id,
        conversation,
        state.summary || "",
        toolCalls,
      );

      await GlobalChatSession.findOneAndUpdate(
        {
          _id: conversation._id,
          user: req.user._id,
          "pendingInteraction.interactionId": req.params.interactionId,
        },
        { $set: { pendingInteraction: null } },
      );
    }
  } catch (err) {
    console.error("[IrisInteraction] resume failed", {
      interactionId: req.params.interactionId,
      runId,
      error: err.message,
    });

    await agentRunService.markFailed({
      runId,
      userId: req.user._id,
      error: err.message,
    });

    await GlobalChatSession.findOneAndUpdate(
      {
        _id: conversation._id,
        user: req.user._id,
        "pendingInteraction.interactionId": req.params.interactionId,
      },
      {
        $set: {
          "pendingInteraction.status": "pending",
        },
      },
    );

    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Unable to resume interaction" })}\n\n`,
    );
  } finally {
    res.end();
  }
});
