export type STTLanguage = "auto" | "en" | "hi" | "bn" | string;

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
  cost?: number;
}

export interface STTOptions {
  language?: STTLanguage;
}

export interface LanguageOption {
  code: STTLanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_STT_LANGUAGES: LanguageOption[] = [
  { code: "auto", label: "Auto Detect", nativeLabel: "Auto" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
];
