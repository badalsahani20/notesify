import { getGeminiClient, ensureAiApiKey, getOpenRouterApiKey, QUICK_MODEL, GRAMMAR_MODEL } from "../config/aiModels.js";
import { executeOpenRouter } from "./openRouterClient.js";

export const executeGemini = async (messages, stream = false) => {
  const model = getGeminiClient();
  if (!model) throw new Error("GEMINI_API_KEY is missing");

  // Format messages array into Gemini prompt string, extracting text from structured content arrays
  const prompt = Array.isArray(messages)
    ? messages
        .map((m) => {
          if (typeof m.content === "string") return m.content;
          if (Array.isArray(m.content)) {
            return m.content
              .map((c) => (typeof c === "string" ? c : c?.text || ""))
              .filter(Boolean)
              .join("\n");
          }
          return typeof m.content === "object" && m.content?.text
            ? m.content.text
            : JSON.stringify(m.content);
        })
        .join("\n\n")
    : String(messages);

  if (stream) {
    const result = await model.generateContentStream(prompt);
    return result.stream;
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const generateContentWithFallback = async (
  promptOrMessages,
  stream = true,
  includeReasoning = true
) => {
  ensureAiApiKey();
  const messages = Array.isArray(promptOrMessages)
    ? promptOrMessages
    : [{ role: "user", content: promptOrMessages }];
  const errors = [];

  if (getOpenRouterApiKey()) {
    try {
      return await executeOpenRouter(GRAMMAR_MODEL, messages, stream, includeReasoning);
    } catch (err) {
      errors.push(`${GRAMMAR_MODEL} failed: ${err.message}`);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await executeGemini(messages, stream);
    } catch (err) {
      errors.push(`Gemini failed: ${err.message}`);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await executeOpenRouter(QUICK_MODEL, messages, stream, includeReasoning);
    } catch (err) {
      errors.push(`${QUICK_MODEL}/OpenRouter failed: ${err.message}`);
    }
  }

  throw new Error(`No AI feature keys configured or all providers failed: ${errors.join(" | ")}`);
};
