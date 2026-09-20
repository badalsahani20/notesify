import api from "@/lib/api";
import type { STTOptions, TranscriptionResult } from "./types";

export class STTClient {
  /**
   * Transcribe an audio Blob via the Notesify STT endpoint.
   * @param audio - Audio blob from AudioRecorder
   * @param options - Optional language parameters
   */
  public static async transcribe(
    audio: Blob,
    options?: STTOptions
  ): Promise<TranscriptionResult> {
    if (!audio || audio.size === 0) {
      throw new Error("No audio provided for transcription");
    }

    const formData = new FormData();
    const filename = audio.type.includes("mp4") ? "recording.mp4" : "recording.webm";
    formData.append("audio", audio, filename);

    // Only pass language if user selected a specific language (not "auto")
    if (options?.language && options.language !== "auto") {
      formData.append("language", options.language);
    }

    const response = await api.post<TranscriptionResult & { success: boolean }>(
      "/stt/transcribe",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (!response.data || typeof response.data.text !== "string") {
      throw new Error("Invalid transcription response received from server");
    }

    return {
      text: response.data.text.trim(),
      language: response.data.language,
      durationSeconds: response.data.durationSeconds,
      cost: response.data.cost,
    };
  }
}
