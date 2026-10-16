import { transcribeAudio } from "../services/stt/stt.service.js";
import { checkDailyQuota, recordAiUsage } from "./ai.controller.js";

/**
 * Controller for handling audio transcription requests.
 * Accepts multipart/form-data with an "audio" file field.
 */
export async function transcribe(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required under the 'audio' field",
      });
    }

    // 1. Quota Check - Prevent bypass when daily AI limits are reached
    if (req.user?._id) {
      const quota = await checkDailyQuota(req.user._id);
      if (!quota.allowed) {
        return res.status(429).json({
          success: false,
          code: quota.code || "AI_TOKEN_LIMIT_EXCEEDED",
          message: quota.message || "Daily AI token limit reached. Resets at 00:00 UTC.",
          used: quota.used,
          limit: quota.limit,
        });
      }
    }

    const { language } = req.body;
    const { buffer, mimetype, originalname, size } = req.file;

    // Minimum file sanity check (at least 500 bytes of audio)
    if (size < 500) {
      return res.status(400).json({
        success: false,
        message: "Audio recording is too short or empty",
      });
    }

    const result = await transcribeAudio({
      audioBuffer: buffer,
      mimeType: mimetype || "audio/webm",
      filename: originalname || "recording.webm",
      language: language?.trim() || undefined,
    });

    // 2. Track usage against user's daily quota
    if (req.user?._id && result.text) {
      const estimatedTokens = Math.max(
        50,
        Math.ceil((result.text.length / 4) + (result.durationSeconds || 1) * 10)
      );
      void recordAiUsage(req.user._id, {
        model: "openai/whisper-large-v3-turbo",
        promptTokens: estimatedTokens,
        completionTokens: Math.ceil(result.text.length / 4),
        totalTokens: estimatedTokens,
      }).catch((err) => console.warn("[STT Controller] Failed to record usage:", err.message));
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[STT Controller] Transcription failed:", error.message);
    const statusCode = error.message?.includes("API key") ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to transcribe audio",
    });
  }
}
