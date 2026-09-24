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

  // 6. Default chat model
  return DEFAULT_CHAT_MODEL;
};

export const selectOptimalModel = classifyChatIntent;
