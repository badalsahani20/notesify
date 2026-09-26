import {
  PRIMARY_MODEL,
  TEACHING_MODELS,
  DEFAULT_CHAT_MODEL,
  COMPLEX_ANALYSIS_MODEL,
  VISUALIZATION_MODEL,
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
  if (hasAttachedImage) return VISUALIZATION_MODEL;

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
    return PRIMARY_MODEL;
  }

  // 3. DIAGRAMS / GRAPHS / CHARTS
  const isDiagramOrGraph =
    /\b(diagram|chart|graph|flowchart|wireframe|mockup|screenshot|visualize|architecture|workflow|sequence diagram|erd|uml|mindmap|tree)\b/.test(
      msg,
    );
  if (isDiagramOrGraph) return PRIMARY_MODEL;

  // 4. STUDY MODE
  if (chatMode === "study") {
    const chosenModel = TEACHING_MODELS[0];
    console.log(
      `🎓 [Study Mode Active] Routing to Teaching Model: ${chosenModel}`,
    );
    return chosenModel;
  }

  // 5. Coding and debugging requests benefit from the analysis model even in
  // casual mode. Keep this after study mode so study routing remains stable.
  const isCodingRequest =
    /\b(code|coding|debug|debugging|bug|error|implement|function|api|typescript|javascript|python|react|node\.js|sql|regex|algorithm|stack trace)\b/.test(
      msg,
    );
  if (isCodingRequest) {
    console.log(
      `🧑‍💻 [Coding Request] Routing to analysis model: ${COMPLEX_ANALYSIS_MODEL}`,
    );
    return COMPLEX_ANALYSIS_MODEL;
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
