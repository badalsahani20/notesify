import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Notes from "../models/notes.model.js";
import AiAssistCache from "../models/aiAssistCache.model.js";
import catchAsync from "../utils/catchAsync.js";
import { generateConversationTitle } from "../services/title.service.js";
import {
  runAiAssist,
  irisAgent,
  irisStreamHandler,
  resolveChatContext,
} from "../services/ai.service.js";
import GlobalChatSession from "../models/globalChatSession.model.js";
import { parseIrisResponse } from "../utils/parseIrisResponse.js";
import getEffectiveDailyLimit, {
  getEffectiveDailyLimits,
  getStartOfUtcDay,
} from "../utils/getEffectiveDailyLimit.js";
import agentRunService from "../services/ai/agent/agentRunService.js";
import {cleanSessionTitle, hashText} from "../utils/hashText.js"
import { uploadImageToCloudinary } from "../services/imageUpload.service.js";
import {
  buildChatAttachmentContext,
  createChatAttachmentBundle,
  getChatAttachmentBundleForUser,
} from "../services/chatAttachment.service.js";
import { SseStreamParser } from "../utils/sseParser.js";


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
    (noteText && noteText.trim()) ||
    (selectedText && selectedText.trim()) ||
    (note ? note.content : "");

  if (!sourceText || !sourceText.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Text is required for AI assist" });
  }

  const inputHash = hashText(sourceText);

  // 2. Check Cache First (skip non-cacheable actions like "continue")
  const isCacheableAction = action !== "continue";
  const cached = isCacheableAction
    ? await AiAssistCache.findOne({
        user: req.user._id,
        note: note?._id || null,
        action,
        sourceType,
        inputHash,
      }).lean()
    : null;

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

  // 2. Check daily token quota
  const rateLimitResult = await checkDailyQuota(req.user._id);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      code: rateLimitResult.code || "AI_TOKEN_LIMIT_EXCEEDED",
      message: rateLimitResult.message,
      used: rateLimitResult.used,
      limit: rateLimitResult.limit,
      tier: rateLimitResult.tier,
    });
  }

  // 3. Call AI Service (Stream or Static)
  let result;
  result = await runAiAssist({
    action,
    text: sourceText,
    stream: !!stream,
  });

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

      // Save the streamed result to cache after completion (skip non-cacheable actions)
      if (isCacheableAction) {
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
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }

      // Record token usage on successful completion
      const promptTokens = Math.ceil((sourceText?.length || 0) / 3.8);
      const completionTokens = Math.ceil((finalSuggestion?.length || 0) / 3.8);
      void recordAiUsage(req.user._id, {
        model: "ai-assist",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      }).catch((err) => console.error("Failed to record assist usage:", err));
    } catch (err) {
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
    if (isCacheableAction) {
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
            original: result.original || "",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    // Record token usage on successful static generation
    const promptTokens = Math.ceil((sourceText?.length || 0) / 3.8);
    const completionTokens = Math.ceil((result?.suggestion?.length || 0) / 3.8);
    void recordAiUsage(req.user._id, {
      model: "ai-assist",
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    }).catch((err) => console.error("Failed to record assist usage:", err));
  } catch (error) {
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
  let activeAttachmentBundle = null;

  if (isGlobalChat) {
    if (sessionId) {
      session = await GlobalChatSession.findOne({
        _id: sessionId,
        user: req.user._id,
      });
    }
    if (session) {
      let needsSave = false;
      let currentMaxSeq = 0;
      history = session.messages.map((m) => {
        if (!m.id) {
          m.id = crypto.randomUUID();
          needsSave = true;
        }
        if (typeof m.seq !== "number" || m.seq <= currentMaxSeq) {
          m.seq = currentMaxSeq + 1;
          needsSave = true;
        }
        currentMaxSeq = m.seq;
        return {
          id: m.id,
          seq: m.seq,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
        };
      });
      if (needsSave) {
        session.save().catch((err) => console.warn("Failed to persist legacy message IDs/seq:", err.message));
      }
      summary = session.summary || "";
      activeAttachmentBundle = session.activeAttachmentBundle || null;
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
        chatMode: req.body.chatMode || "casual",
      });
    }

    activeSessionId = session._id;
    activeSession = session;
    activeAttachmentBundle = session.activeAttachmentBundle || null;
  }

  if (activeSession && req.body.chatMode && activeSession.chatMode !== req.body.chatMode) {
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
    activeAttachmentBundle,
  };
};

// Set up SSE headers and fire the keep-alive comment with continuous heartbeat
const openSseConnection = (res, activeSessionId) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Expose-Headers", "X-Session-Id");
  if (activeSessionId)
    res.setHeader("X-Session-Id", activeSessionId.toString());
  res.write(": keep-alive\n\n");

  const keepAliveTimer = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(keepAliveTimer);
      return;
    }
    try {
      res.write(": keep-alive\n\n");
    } catch (_) {
      clearInterval(keepAliveTimer);
    }
  }, 4000);

  res.on("close", () => clearInterval(keepAliveTimer));
  res.on("finish", () => clearInterval(keepAliveTimer));
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
  attachmentBundleId = null,
) => {
  const isImageUrl =
    typeof imageBase64 === "string" && /^https?:\/\//i.test(imageBase64);
  const safeUserContent = imageBase64
    ? `${isImageUrl ? `[Attached Image](${imageBase64})` : "[Attached Image]"}\n${message}`.trim()
    : message;

  const sessionToUpdate =
    activeSession || (await GlobalChatSession.findById(activeSessionId));
  if (!sessionToUpdate) return;

  const safeAssistantContent =
    finalReply?.trim() ||
    (toolCalls.some((t) => t.tool === "ask_question")
      ? "I asked a clarifying question to help proceed."
      : toolCalls.length > 0
        ? "Action completed."
        : "");

  if (!safeAssistantContent && toolCalls.length === 0) {
    console.warn(
      "Skipping chat persistence because assistant reply and tool calls were both empty.",
    );
    return;
  }

  const lastSeq =
    sessionToUpdate.messages.length > 0
      ? sessionToUpdate.messages[sessionToUpdate.messages.length - 1].seq || sessionToUpdate.messages.length
      : 0;

  sessionToUpdate.messages.push(
    { id: crypto.randomUUID(), seq: lastSeq + 1, role: "user", content: safeUserContent },
    { id: crypto.randomUUID(), seq: lastSeq + 2, role: "assistant", content: safeAssistantContent, toolCalls },
  );
  if (summary) sessionToUpdate.summary = summary;
  if (attachmentBundleId) sessionToUpdate.activeAttachmentBundle = attachmentBundleId;
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

export const uploadChatAttachmentController = catchAsync(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const bundle = await createChatAttachmentBundle({
    files,
    userId: req.user._id,
    name: req.body.folderName || files[0]?.originalname || "Uploaded documents",
  });

  res.status(201).json({ success: true, data: { bundle } });
});

//  Main chat controller

export const chatWithAiController = catchAsync(async (req, res) => {
  const {
    message,
    imageBase64,
    pdfContext,
    chatAttachmentId,
    stream,
    modelTier,
    useReasoning,
    enableWeb,
    chatMode,
  } =
    req.body;

  if ((!message || !message.trim()) && !imageBase64 && !chatAttachmentId) {
    return res
      .status(400)
      .json({ success: false, message: "Message or Image is required" });
  }

  // 1. Check daily token quota before doing ANY session creation or processing
  const quotaResult = await checkDailyQuota(req.user._id);
  if (!quotaResult.allowed) {
    return res.status(429).json({
      success: false,
      code: quotaResult.code || "AI_TOKEN_LIMIT_EXCEEDED",
      message: quotaResult.message,
      used: quotaResult.used,
      limit: quotaResult.limit,
      tier: quotaResult.tier,
    });
  }

  // 2. Resolve session & history
  let sessionData = await resolveSession(req);
  let {
    isGlobalChat,
    history,
    activeSessionId,
    activeSession,
  } = sessionData;

  // If the user sends a new message while an interaction was pending,
  // treat the previous interaction as skipped/abandoned and clear it.
  if (activeSession && activeSession.pendingInteraction) {
    const abandonedRunId = activeSession.pendingInteraction.runId;
    if (abandonedRunId) {
      void agentRunService.cancelRun({
        runId: abandonedRunId,
        userId: req.user._id,
      }).catch((cancelErr) => {
        console.warn("⚠️ [IrisRun] Failed to cancel abandoned run:", cancelErr.message);
      });
    }
    activeSession.pendingInteraction = null;
    void GlobalChatSession.findByIdAndUpdate(activeSession._id, {
      $set: { pendingInteraction: null },
    }).catch(() => {});
  }

  const activeAttachmentBundleId =
    chatAttachmentId || sessionData.activeAttachmentBundle || null;
  const attachmentContext = activeAttachmentBundleId
    ? await buildChatAttachmentContext({
        bundleId: activeAttachmentBundleId,
        userId: req.user._id,
      })
    : "";
  const modelPdfContext = [pdfContext, attachmentContext].filter(Boolean).join("\n\n");

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

  // Trigger background Cloudinary upload if an unhosted image/data URI was sent
  let cloudinaryUploadPromise = null;
  if (imageBase64 && typeof imageBase64 === "string" && !/^https?:\/\//i.test(imageBase64)) {
    cloudinaryUploadPromise = uploadImageToCloudinary(imageBase64);
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
    taskContext,
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
          pdfContext: modelPdfContext,
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
      taskContext,
      pdfContext: modelPdfContext,
      imageBase64,
      stream: isStreaming,
      modelTier,
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
    // Do not send the extracted folder text back over SSE. The browser keeps
    // only the bundle id; the server resolves it again for future turns.
    pdfContextToEmit = pdfContext || "";

    // Record token usage atomically in MongoDB
    if (agentResult.tokenUsage) {
      void recordAiUsage(req.user._id, {
        model: agentResult.model,
        ...agentResult.tokenUsage,
      }).catch((err) => console.error("Failed to record AI token usage:", err));
    }

    // Resolve Cloudinary URL if uploaded in background
    let persistedImageUrl = imageBase64;
    if (cloudinaryUploadPromise) {
      try {
        const uploadedUrl = await cloudinaryUploadPromise;
        if (uploadedUrl && /^https?:\/\//i.test(uploadedUrl)) {
          persistedImageUrl = uploadedUrl;
        }
      } catch (uploadErr) {
        console.warn("⚠️ [Cloudinary] Resolution failed before persistence:", uploadErr.message);
      }
    }

    // Persist before closing the SSE response. If this fails, the client gets
    // a proper SSE error event instead of a half-closed chunked response.
    if (isGlobalChat && activeSessionId) {
      await persistToDb(
        message,
        finalReply,
        persistedImageUrl,
        activeSessionId,
        activeSession,
        sessionSummary,
        toolCalls,
        activeAttachmentBundleId,
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
      chatMode: activeSession?.chatMode || chatMode || "casual",
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

  const activeAttachmentBundle = await getChatAttachmentBundleForUser({
    bundleId: session.activeAttachmentBundle,
    userId: req.user._id,
  });

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
      activeAttachmentBundle,
    },
  });
});

// DELETE /api/ai/sessions/:sessionId — delete one global chat session
export const deleteChatSessionController = catchAsync(async (req, res) => {
  const session = await GlobalChatSession.findOneAndDelete({
    _id: req.params.sessionId,
    user: req.user._id,
    $or: [{ scope: "global" }, { scope: { $exists: false } }],
  });

  if (!session) {
    return res
      .status(404)
      .json({ success: false, message: "Chat session not found" });
  }

  res.status(200).json({
    success: true,
    data: { sessionId: String(session._id) },
  });
});

// GET /api/ai/sessions — sidebar: paginated session metadata (no messages)
export const getAllSessionsController = catchAsync(async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 30, 1), 50);
  const filter = {
    user: req.user._id,
    $or: [{ scope: "global" }, { scope: { $exists: false } }],
    "messages.0": { $exists: true },
  };

  if (req.query.cursor) {
    try {
      const cursor = JSON.parse(
        Buffer.from(String(req.query.cursor), "base64url").toString("utf8"),
      );
      const cursorDate = new Date(cursor.updatedAt);

      if (cursor.id && mongoose.isValidObjectId(cursor.id) && !Number.isNaN(cursorDate.getTime())) {
        filter.$and = [
          {
            $or: [
              { updatedAt: { $lt: cursorDate } },
              { updatedAt: cursorDate, _id: { $lt: cursor.id } },
            ],
          },
        ];
      }
    } catch {
      // Ignore an invalid cursor and return the first page.
    }
  }

  const sessions = await GlobalChatSession.find(filter)
    .select("title updatedAt") // only what the sidebar needs
    .sort({ updatedAt: -1, _id: -1 }) // newest first
    .limit(limit + 1)
    .lean();

  const hasMore = sessions.length > limit;
  const page = hasMore ? sessions.slice(0, limit) : sessions;
  const lastSession = page[page.length - 1];
  const nextCursor = hasMore && lastSession
    ? Buffer.from(JSON.stringify({
        id: String(lastSession._id),
        updatedAt: lastSession.updatedAt,
      })).toString("base64url")
    : null;

  res.status(200).json({
    success: true,
    data: {
      sessions: page.map((session) => ({
        ...session,
        title: cleanSessionTitle(session.title),
      })),
      hasMore,
      nextCursor,
    },
  });
});

// GET /api/public/prompts — dynamic quick prompts for the chat empty state
export const getDynamicPromptsController = catchAsync(async (req, res) => {
  const studentPrompts = [
    "Explain any concept in simple terms",
    "Give me a quick crash course on any subject",
    "Simplify something that feels confusing",
    "Teach me a topic from scratch",
    "Summarize a complex topic quickly",
    "Generate ideas for a project or topic",
    "Turn rough thoughts into structured notes",
    "Help me improve my writing clarity",
    "Give me a structured learning path",
    "Help me plan something from start to finish",
    "Translate complex ideas into plain English",
  ];

  const devPrompts = [
    "Explain how a system works",
    "Break down a complex concept",
    "Teach me a new backend concept",
    "How do modern web apps scale?",
    "Explain how APIs work in real-world apps",
    "What happens behind the scenes in a request?",
    "How does authentication actually work?",
    "Explain caching in simple terms",
    "How do databases handle large data?",
    "Compare different backend architectures",
    "How does Docker fit into development?",
    "Explain how frontend and backend connect",
    "What are common system design patterns?",
    "How do real-time systems work?",
    "Explain trade-offs in system design",
    "Help me choose the right tech stack",
    "Optimize frontend performance",
    "Structure a scalable project",
    "Guide me step-by-step to build a feature",
    "Design a backend or system architecture",
    "Help me think through a problem logically",
  ];

  res.status(200).json({
    success: true,
    data: {
      studentPrompts,
      devPrompts,
    },
  });
});

export async function recordAiUsage(
  userId,
  { model = "default", promptTokens = 0, completionTokens = 0, totalTokens = 0 } = {}
) {
  const now = new Date();
  const startOfToday = getStartOfUtcDay(now);
  const sanitizedModel = String(model).replace(/[\.\$]/g, "_");

  const effectiveTotal =
    totalTokens > 0 ? totalTokens : (promptTokens + completionTokens);

  // Atomic update: if lastResetAt is before today's UTC boundary OR missing, reset daily stats
  const resetUpdate = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { "aiUsage.lastResetAt": { $lt: startOfToday } },
        { "aiUsage.lastResetAt": { $exists: false } },
        { aiUsage: { $exists: false } },
      ],
    },
    {
      $set: {
        "aiUsage.dailyCount": 1,
        "aiUsage.dailyTokens": effectiveTotal,
        "aiUsage.dailyInputTokens": promptTokens,
        "aiUsage.dailyOutputTokens": completionTokens,
        "aiUsage.lastResetAt": now,
        [`aiUsage.modelBreakdown.${sanitizedModel}.totalTokens`]: effectiveTotal,
        [`aiUsage.modelBreakdown.${sanitizedModel}.promptTokens`]: promptTokens,
        [`aiUsage.modelBreakdown.${sanitizedModel}.completionTokens`]: completionTokens,
      },
    }
  );

  // If lastResetAt is already today's UTC day, increment atomically
  if (!resetUpdate) {
    await User.findOneAndUpdate(
      { _id: userId },
      {
        $inc: {
          "aiUsage.dailyCount": 1,
          "aiUsage.dailyTokens": effectiveTotal,
          "aiUsage.dailyInputTokens": promptTokens,
          "aiUsage.dailyOutputTokens": completionTokens,
          [`aiUsage.modelBreakdown.${sanitizedModel}.totalTokens`]: effectiveTotal,
          [`aiUsage.modelBreakdown.${sanitizedModel}.promptTokens`]: promptTokens,
          [`aiUsage.modelBreakdown.${sanitizedModel}.completionTokens`]: completionTokens,
        },
      }
    );
  }
}

export async function checkDailyQuota(userId) {
  const now = new Date();
  const startOfToday = getStartOfUtcDay(now);

  const user = await User.findById(userId).select("plan aiUsage");
  if (!user) return { allowed: false, code: "USER_NOT_FOUND", reason: "User not found" };

  const limits = getEffectiveDailyLimits(user);

  const isNewDay =
    !user.aiUsage?.lastResetAt || user.aiUsage.lastResetAt < startOfToday;
  const effectiveTokens = isNewDay ? 0 : user.aiUsage?.dailyTokens || 0;
  const effectiveCount = isNewDay ? 0 : user.aiUsage?.dailyCount || 0;

  if (effectiveTokens >= limits.tokenLimit) {
    return {
      allowed: false,
      code: "AI_TOKEN_LIMIT_EXCEEDED",
      message: `Daily AI token limit reached (used ${effectiveTokens.toLocaleString()} of ${limits.tokenLimit.toLocaleString()} tokens today). Resets at 00:00 UTC.`,
      used: effectiveTokens,
      limit: limits.tokenLimit,
      tier: limits.tier,
    };
  }

  return {
    allowed: true,
    used: effectiveTokens,
    count: effectiveCount,
    limit: limits.tokenLimit,
    tier: limits.tier,
  };
}

async function checkAndIncrementRateLimit(userId) {
  const quota = await checkDailyQuota(userId);
  return {
    allowed: quota.allowed,
    code: quota.code,
    message: quota.message,
    used: quota.used,
    limit: quota.limit,
  };
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
