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
  modelId = "openai/gpt-oss-120b",
  tools = null
) => {
  if (groqNativeClient?.chat?.completions) {
    try {
      // Only keep standard function tools (exclude provider-specific tools like openrouter:web_search)
      const validTools = Array.isArray(tools)
        ? tools.filter((t) => t.type === "function" || !t.type)
        : null;

      const payload = {
        model: modelId,
        messages,
        stream,
        ...(validTools && validTools.length > 0 ? { tools: validTools } : {}),
      };

      const response = await groqNativeClient.chat.completions.create(payload);

      if (stream) {
        async function* toSseStream() {
          const encoder = new TextEncoder();
          for await (const chunk of response) {
            yield encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          yield encoder.encode(`data: [DONE]\n\n`);
        }
        return toSseStream();
      }

      return response.choices?.[0]?.message?.content || "";
    } catch (groqErr) {
      console.warn(
        `⚠️ [Groq Native] Request with ${modelId} failed, falling back to OpenRouter:`,
        groqErr.message
      );
    }
  }

  return await executeOpenRouter(modelId, messages, stream, false, 5000, tools);
};
