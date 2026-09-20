import { transcribeAudio } from "../services/stt/stt.service.js";

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

    const { language } = req.body;
    const { buffer, mimetype, originalname, size } = req.file;

    // Minimum file sanity check (at least 1KB of audio)
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
