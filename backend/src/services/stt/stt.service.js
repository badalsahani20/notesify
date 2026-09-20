import { getOpenRouterApiKey } from "../ai/config/aiModels.js";

const OPENROUTER_TRANSCRIPTION_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
const STT_MODEL = "openai/whisper-large-v3-turbo";

/**
 * Transcribes audio via OpenRouter Whisper Large V3 Turbo.
 * @param {Object} params
 * @param {Buffer} params.audioBuffer - Raw audio buffer from Multer
 * @param {string} [params.mimeType] - Mime type of the audio (e.g. "audio/webm", "audio/mp4")
 * @param {string} [params.language] - Optional ISO language code (e.g. "hi", "en", "bn")
 * @param {string} [params.filename] - Optional file name
 * @returns {Promise<{ text: string, language?: string, durationSeconds?: number, cost?: number }>}
 */
export async function transcribeAudio({
  audioBuffer,
  mimeType = "audio/webm",
  language,
  filename = "recording.webm",
}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("No OpenRouter API key configured on server");
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Empty audio buffer provided");
  }

  // Create multipart FormData using Node's native FormData and Blob
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", STT_MODEL);

  // Send language hint only if explicitly specified and not "auto"
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const response = await fetch(OPENROUTER_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage = errorBody?.error?.message || response.statusText || "Transcription request failed";
    console.error("[STT Service] OpenRouter error:", errorBody || response.status);
    throw new Error(`OpenRouter STT error (${response.status}): ${errorMessage}`);
  }

  const data = await response.json();

  // Normalize response
  return {
    text: (data.text || "").trim(),
    language: data.language || (language && language !== "auto" ? language : undefined),
    durationSeconds: data.duration ?? data.usage?.seconds ?? undefined,
    cost: data.usage?.cost ?? undefined,
  };
}
