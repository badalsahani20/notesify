import {
  PRIMARY_MODEL,
  TEACHING_MODELS,
  DEFAULT_CHAT_MODEL,
  COMPLEX_ANALYSIS_MODEL,
} from "../config/aiModels.js";

export const classifyChatIntent = (
  message = "",
  imageBase64 = null,
  history = [],
  noteContext = "",
  pdfContext = "",
  chatMode = "casual",
  enableWeb = false,
) => {
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
    return PRIMARY_MODEL || DEFAULT_CHAT_MODEL || COMPLEX_ANALYSIS_MODEL;
  }

  // 4. STUDY MODE
  if (chatMode === "study") {
    const chosenModel = TEACHING_MODELS[0];
    console.log(
      `🎓 [Study Mode Active] Routing to Teaching Model: ${chosenModel}`,
    );
    return chosenModel;
  }


  // 6. Current, research-heavy requests, or when Web search is toggled ON benefit from the primary model.
  const isResearchRequest =
    enableWeb === true ||
    /\b(latest|today|current|recent|news|research|sources?|cite|citation|according to|compare)\b/.test(
      msg,
    );
  if (isResearchRequest) {
    console.log(
      `🔎 [Research/Web Request] Routing to primary model: ${PRIMARY_MODEL}`,
    );
    return PRIMARY_MODEL;
  }

  // 7. Default chat model
  return DEFAULT_CHAT_MODEL;
};

export const selectOptimalModel = classifyChatIntent;
