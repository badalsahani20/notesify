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
    modelId.toLowerCase().includes("glm");

  const isGlm = modelId.toLowerCase().includes("glm");
  const isDeepseek = modelId.toLowerCase().includes("deepseek");

  const bodyPayload = {
    model: modelId,
    messages: messages,
    stream: stream,
    max_tokens: maxTokens,
    cache_control: { type: "ephemeral" },
  };
  
  if (stream) {
    bodyPayload.stream_options = { include_usage: true };
  }

  if (isGlm) {
    bodyPayload.provider = {
      order: [
        "open-inference/fp4",
        "relace",
        "wafer/us",
        "wafer/nvfp4",
        "gmicloud/fp8",
      ],
      allow_fallbacks: true,
    };
  } else if (isDeepseek) {
    bodyPayload.provider = {
      order: [
        "relace/fp4",
        "deepinfra/fp8",
        "digitalocean",
        "wafer/fast",
      ],
      allow_fallbacks: true,
    };
  }

  let reasoningEffort = null;
  if (typeof includeReasoning === "string") {
    reasoningEffort = includeReasoning.toLowerCase();
  } else if (includeReasoning && typeof includeReasoning === "object" && includeReasoning.effort) {
    reasoningEffort = includeReasoning.effort.toLowerCase();
  }

  if (includeReasoning === false || reasoningEffort === "none") {
    // Explicitly disable reasoning (e.g. for grammar checking or fast deterministic tasks)
    bodyPayload.include_reasoning = false;
    bodyPayload.reasoning = { effort: "none" };
  } else if (reasoningEffort) {
    // OpenRouter standardized effort levels: "minimal" | "low" | "medium" | "high" | "max"
    bodyPayload.include_reasoning = true;
    bodyPayload.reasoning = { effort: reasoningEffort };
  } else {
    // Native adaptive reasoning: allow the model to scale its own thinking tokens
    // up to a safe token ceiling without forcing artificial effort levels.
    bodyPayload.include_reasoning = true;
    bodyPayload.reasoning = { max_tokens: reasoningMaxTokens };
  }

  if (tools) {
    bodyPayload.tools = tools;
  }

  if (maxToolCalls !== null && maxToolCalls !== undefined) {
    bodyPayload.max_tool_calls = maxToolCalls;
  }

  console.log(
    `🤖 [OpenRouter] Executing model: "${modelId}" | Stream: ${stream} | Reasoning: ${JSON.stringify(bodyPayload.reasoning || false)} | Tools: ${tools?.map(t => t.type || t.function?.name).join(", ") || "none"} | MaxToolCalls: ${maxToolCalls ?? "default"}`
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

  if (data?.usage) {
    const cachedTokens = data.usage.prompt_tokens_details?.cached_tokens ?? 0;
    console.log(
      `📊 [OpenRouter Usage] Prompt tokens: ${data.usage.prompt_tokens} (Cached: ${cachedTokens}), Completion tokens: ${data.usage.completion_tokens}`
    );
  }

  console.log(`✅ [OpenRouter] Successfully generated response via model: "${modelId}"`);
  return content;
};
