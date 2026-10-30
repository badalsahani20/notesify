import {
  PRIMARY_MODEL,
  DEFAULT_CHAT_MODEL,
  COMPLEX_ANALYSIS_MODEL,
  QUICK_MODEL,
} from "../config/aiModels.js";

export const classifyChatIntent = (
  message = "",
  imageBase64 = null,
  history = [],
  noteContext = "",
  pdfContext = "",
  enableWeb = false,
  modelTier = null,
  useReasoning = true,
) => {
  // Explicit Model Tier Overrides
  if (modelTier === "fast") {
    console.log(
      `⚡ [ModelRouter] Fast mode active: Routing to ${DEFAULT_CHAT_MODEL} (GLM - minimal effort)`,
    );
    return DEFAULT_CHAT_MODEL;
  }

  if (modelTier === "thinking") {
    console.log(
      `🧠 [ModelRouter] Thinking mode active: Routing to ${DEFAULT_CHAT_MODEL} (GLM - medium effort)`,
    );
    return DEFAULT_CHAT_MODEL;
  }

  if (modelTier === "pro") {
    console.log(
      `✨ [ModelRouter] Pro mode active: Routing to ${DEFAULT_CHAT_MODEL} (GLM - high effort)`,
    );
    return DEFAULT_CHAT_MODEL;
  }

  const msg = message.toLowerCase();

  // 1. VISUAL CONVO
  const hasAttachedImage = !!imageBase64;
  if (hasAttachedImage) return DEFAULT_CHAT_MODEL || COMPLEX_ANALYSIS_MODEL;

  // Calculate total context size
  const historyText = history
    .map((h) =>
      typeof h.content === "string" ? h.content : JSON.stringify(h.content),
    )
    .join(" ");
  const totalContextLength =
    (noteContext?.length || 0) +
    (pdfContext?.length || 0) +
    historyText.length +
    message.length;

  // 2. LARGE CONTEXT OVERRIDE
  if (totalContextLength > 150000) {
    console.log(
      `📦 Large context detected (${totalContextLength} characters). Overriding routing to use ${PRIMARY_MODEL} (DeepSeek).`,
    );
    return DEFAULT_CHAT_MODEL || PRIMARY_MODEL || COMPLEX_ANALYSIS_MODEL;
  }

  // 3. Current, research-heavy requests, or when Web search is toggled ON benefit from the primary model.
  const isResearchRequest =
    enableWeb === true ||
    / (latest|today|current|recent|news|research|sources?|cite|citation|according to|compare) /.test(
      msg,
    );
  if (isResearchRequest) {
    console.log(
      `🔎 [Research/Web Request] Routing to primary model: ${PRIMARY_MODEL}`,
    );
    return PRIMARY_MODEL;
  }

  // 7. Default chat model
  return DEFAULT_CHAT_MODEL || QUICK_MODEL;
};

export const selectOptimalModel = classifyChatIntent;
