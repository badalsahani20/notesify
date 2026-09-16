import { getGeminiClient, ensureAiApiKey, getOpenRouterApiKey, QUICK_MODEL, GRAMMAR_MODEL } from "../config/aiModels.js";
import { executeOpenRouter } from "./openRouterClient.js";

export const executeGemini = async (messages, stream = false) => {
  const model = getGeminiClient();
  if (!model) throw new Error("GEMINI_API_KEY is missing");

  // Format messages array into Gemini prompt string
  const prompt = Array.isArray(messages)
    ? messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
    : String(messages);

  if (stream) {
    const result = await model.generateContentStream(prompt);
    return result.stream;
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const generateContentWithFallback = async (prompt, stream = true) => {
  ensureAiApiKey();
  const message = [{ role: "user", content: prompt }];
  const errors = [];

  if (getOpenRouterApiKey()) {
    try {
      return await executeOpenRouter(GRAMMAR_MODEL, message, stream);
    } catch (err) {
      errors.push(`${GRAMMAR_MODEL} failed: ${err.message}`);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await executeGemini(message, stream);
    } catch (err) {
      errors.push(`Gemini failed: ${err.message}`);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await executeOpenRouter(QUICK_MODEL, message, stream);
    } catch (err) {
      errors.push(`${QUICK_MODEL}/OpenRouter failed: ${err.message}`);
    }
  }

  throw new Error(`No AI feature keys configured or all providers failed: ${errors.join(" | ")}`);
};
