import { GoogleGenerativeAI } from "@google/generative-ai";

export const PRIMARY_MODEL = "deepseek/deepseek-v4-flash-0731";
export const TEACHING_MODELS = [
  "z-ai/glm-5.3-flash",
  "deepseek/deepseek-v4-flash-0731",
];
export const DEFAULT_CHAT_MODEL = "z-ai/glm-5.3-flash";
export const QUICK_MODEL = "inclusionai/ling-3.0-flash";
export const TITLE_GENERATION_MODEL = "meta-llama/llama-3.1-8b-instruct";
export const COMPLEX_ANALYSIS_MODEL = "inclusionai/ling-3.0-flash";
export const VISUALIZATION_MODEL = "z-ai/glm-5.3-flash";
export const VISUALIZATION_FALLBACK_MODEL = "qwen/qwen3.7-flash";
export const NOTES_GENERATION_MODEL = "openai/gpt-oss-120b";
export const GRAMMAR_MODEL = "meta-llama/llama-3.1-8b-instruct"
export const FALLBACK_MODEL = "openai/gpt-oss-120b";
export const GROQ_CHEAP_MODEL = "openai/gpt-oss-20b";
export const GROQ_STRONG_MODEL = "openai/gpt-oss-120b";

export const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
};

export const getOpenRouterApiKey = () =>
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENROUTER_API ||
  process.env.OPEN_ROUTER_KEY ||
  process.env.OPENROUTER_KEY ||
  process.env.OPEN_ROUTER ||
  process.env.OPENROUTER;

export const ensureAiApiKey = () => {
  if (!process.env.GEMINI_API_KEY && !getOpenRouterApiKey()) {
    throw new Error(`No AI provider API keys configured (GEMINI or OPENROUTER)`);
  }
};
