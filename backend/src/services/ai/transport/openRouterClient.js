import { getOpenRouterApiKey } from "../config/aiModels.js";

export const executeOpenRouter = async (
  modelId,
  messages,
  stream = false,
  includeReasoning = null,
  maxTokens = 5000,
  tools = null,
  maxToolCalls = null,
  reasoningMaxTokens = 1500
) => {
  const apiKey = getOpenRouterApiKey();

  if (!apiKey) throw new Error("No OpenRouter API Key found");

  const isMandatoryReasoningModel =
    modelId.toLowerCase().includes("glm") ||
    modelId.toLowerCase().includes("r1") ||
    modelId.toLowerCase().includes("reasoner") ||
    modelId.toLowerCase().includes("/o1") ||
    modelId.toLowerCase().includes("/o3");

  const isQwenFlash = modelId.toLowerCase().includes("qwen");

  const bodyPayload = {
    model: modelId,
    messages: messages,
    stream: stream,
    max_tokens: maxTokens,
    provider: {
      ignore: ["open-inference"],
    },
  };

  if (isMandatoryReasoningModel) {
    // These models strictly require reasoning or they deny the request
    bodyPayload.include_reasoning = true;
    // OpenRouter rejects reasoning.effort together with reasoning.max_tokens.
    // Use the explicit budget for mandatory reasoning models.
    bodyPayload.reasoning = { max_tokens: reasoningMaxTokens };
  } else if (includeReasoning === false || (!includeReasoning && isQwenFlash)) {
    // Specifically disable reasoning for Qwen 3.7 Flash and when reasoning is toggled off
    bodyPayload.include_reasoning = false;
    bodyPayload.reasoning = { effort: "none" };
  } else if (includeReasoning === true) {
    bodyPayload.include_reasoning = true;
    // Use a hard reasoning budget instead of an effort level so long internal
    // deliberations cannot consume the whole completion allowance.
    bodyPayload.reasoning = { max_tokens: reasoningMaxTokens };
  }

  if (tools) {
    bodyPayload.tools = tools;
  }

  if (maxToolCalls !== null && maxToolCalls !== undefined) {
    bodyPayload.max_tool_calls = maxToolCalls;
  }

  console.log(
    `🤖 [OpenRouter] Executing model: "${modelId}" | Stream: ${stream} | Reasoning: ${bodyPayload.include_reasoning ?? false} | Tools: ${tools?.map(t => t.type || t.function?.name).join(", ") || "none"} | MaxToolCalls: ${maxToolCalls ?? "default"}`
  );

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.BACKEND_URL || "http://localhost:5500",
        "X-Title": "Notesify AI Assistant",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.warn(`❌ [OpenRouter] Model "${modelId}" returned ${response.status}:`, JSON.stringify(errorData));
    throw new Error(
      `OpenRouter returned ${response.status}: ${JSON.stringify(errorData)}`
    );
  }

  if (stream) {
    console.log(`✅ [OpenRouter] Stream connected successfully for model: "${modelId}"`);
    return response.body;
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (data.error) {
    console.warn(`❌ [OpenRouter] Model "${modelId}" error:`, data.error);
    throw new Error(
      `OpenRouter model error: ${data.error.message ?? JSON.stringify(data.error)}`
    );
  }

  if (!content) throw new Error(`OpenRouter (${modelId}) returned no content`);

  if (
    typeof content === "string" &&
    content.startsWith("Error") &&
    content.includes("model output error")
  ) {
    console.warn(`❌ [OpenRouter] Model "${modelId}" output error string detected`);
    throw new Error(
      `Model output error (${modelId}): ${content.slice(0, 300)}`
    );
  }

  console.log(`✅ [OpenRouter] Successfully generated response via model: "${modelId}"`);
  return content;
};
