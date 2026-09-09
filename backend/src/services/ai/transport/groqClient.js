import { client as groqNativeClient } from "../../../utils/groqClient.js";
import { executeOpenRouter } from "./openRouterClient.js";

/**
 * Dedicated Groq transport client.
 * Calls Groq's high-speed inference engine directly, with automatic fallback
 * to OpenRouter if Groq SDK is unavailable or encounters an error.
 */
export const executeGroq = async (
  messages,
  stream = false,
  modelId = "openai/gpt-oss-120b"
) => {
  if (groqNativeClient?.chat?.completions) {
    try {
      const response = await groqNativeClient.chat.completions.create({
        model: modelId,
        messages,
        stream,
      });
      if (stream) return response;
      return response.choices?.[0]?.message?.content || "";
    } catch (groqErr) {
      console.warn(
        `⚠️ [Groq Native] Request with ${modelId} failed, falling back to OpenRouter:`,
        groqErr.message
      );
    }
  }
  return await executeOpenRouter(modelId, messages, stream);
};
