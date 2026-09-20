import { useState, useRef, useCallback, useEffect } from "react";
import { AudioRecorder } from "@/services/audio/audioRecorder";
import { STTClient } from "@/services/stt/STTClient";
import type { STTLanguage, TranscriptionResult } from "@/services/stt/types";
import { toast } from "sonner";

const STT_LANGUAGE_STORAGE_KEY = "notesify_stt_language";
const MAX_RECORDING_SECONDS = 60;

export interface UseSTTOptions {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
  maxDurationSeconds?: number;
}

export const useSTT = (options: UseSTTOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const [selectedLanguage, setSelectedLanguageState] = useState<STTLanguage>(() => {
    try {
      return (localStorage.getItem(STT_LANGUAGE_STORAGE_KEY) as STTLanguage) || "auto";
    } catch {
      return "auto";
    }
  });

  const setSelectedLanguage = useCallback((lang: STTLanguage) => {
    setSelectedLanguageState(lang);
    try {
      localStorage.setItem(STT_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize recorder
  if (!recorderRef.current) {
    recorderRef.current = new AudioRecorder();
  }

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      recorderRef.current?.cancel();
    };
  }, [clearTimer]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    setIsRecording(false);
    setRecordingDuration(0);
    recorderRef.current?.cancel();
  }, [clearTimer]);

  const stopRecording = useCallback(async (): Promise<TranscriptionResult | null> => {
    if (!recorderRef.current || !recorderRef.current.isRecording()) {
      return null;
    }

    clearTimer();
    setIsRecording(false);
    setRecordingDuration(0);

    let audioBlob: Blob | null = null;
    try {
      audioBlob = await recorderRef.current.stop();
    } catch (err: any) {
      console.error("[useSTT] Failed to stop recorder:", err);
      toast.error("Failed to capture audio recording");
      return null;
    }

    if (!audioBlob) {
      // Too short (< 400ms) or empty
      return null;
    }

    setIsTranscribing(true);
    try {
      const result = await STTClient.transcribe(audioBlob, {
        language: selectedLanguage,
      });

      options.onTranscriptionComplete?.(result);
      return result;
    } catch (err: any) {
      console.error("[useSTT] Transcription failed:", err);
      const message = err.response?.data?.message || err.message || "Failed to transcribe audio";
      toast.error(message);
      options.onError?.(err);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [clearTimer, selectedLanguage, options]);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;

    if (!AudioRecorder.isSupported()) {
      toast.error("Audio recording is not supported in this browser environment");
      return;
    }

    try {
      setRecordingDuration(0);
      await recorderRef.current?.start({
        maxDurationSeconds: options.maxDurationSeconds ?? MAX_RECORDING_SECONDS,
        onMaxDurationReached: () => {
          toast.info(`Maximum recording duration reached (${MAX_RECORDING_SECONDS}s)`);
          void stopRecording();
        },
      });

      setIsRecording(true);
      clearTimer();
      const startTimestamp = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimestamp) / 1000));
      }, 500);
    } catch (err: any) {
      console.error("[useSTT] Failed to start recording:", err);
      toast.error(err.message || "Could not access microphone");
      setIsRecording(false);
      clearTimer();
    }
  }, [isRecording, isTranscribing, options.maxDurationSeconds, clearTimer, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    selectedLanguage,
    setSelectedLanguage,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: AudioRecorder.isSupported(),
  };
};
