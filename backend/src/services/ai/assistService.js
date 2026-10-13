import { generateContentWithFallback } from "./transport/geminiClient.js";

const diffWords = (text1, text2) => {
  const words1 = text1.split(/(\s+)/);
  const words2 = text2.split(/(\s+)/);

  const diffs = [];
  let i = 0;
  let j = 0;

  while (i < words1.length || j < words2.length) {
    if (i < words1.length && j < words2.length && words1[i] === words2[j]) {
      diffs.push({ type: "equal", value: words1[i] });
      i++;
      j++;
    } else {
      if (i < words1.length && (j >= words2.length || words1[i] !== words2[j])) {
        diffs.push({ type: "delete", value: words1[i] });
        i++;
      }
      if (j < words2.length && (i >= words1.length || words1[i] !== words2[j])) {
        diffs.push({ type: "insert", value: words2[j] });
        j++;
      }
    }
  }
  return diffs;
};

const mapDiffsToError = (diffs) => {
  const errors = [];
  let currentOffset = 0;

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];

    if (diff.type === "equal") {
      currentOffset += diff.value.length;
    } else if (diff.type === "delete") {
      const from = currentOffset;
      const to = currentOffset + diff.value.length;

      let replacement = "";
      if (i + 1 < diffs.length && diffs[i + 1].type === "insert") {
        replacement = diffs[i + 1].value;
        i++;
      }

      errors.push({
        from,
        to,
        message: replacement
          ? `Suggested edit: "${replacement}"`
          : `Remove extra text`,
        suggestion: replacement,
      });

      currentOffset = to;
    } else if (diff.type === "insert") {
      errors.push({
        from: currentOffset,
        to: currentOffset,
        message: `Add "${diff.value}"`,
        suggestion: diff.value,
      });
    }
  }

  return errors;
};

export const checkGrammar = async (text) => {
  const prompt = `You are a note editor. Return only the final Markdown, with no preface or commentary.\nCorrect grammar, spelling, punctuation, and awkward phrasing without changing meaning.\n\nText:\n${text}`;

  try {
    const correctedText = await generateContentWithFallback(prompt);
    const differences = diffWords(text, correctedText);
    const errorCoordinates = mapDiffsToError(differences);

    return {
      original: text,
      corrected: correctedText,
      errors: errorCoordinates,
    };
  } catch (error) {
    console.error("AI Assist Grammar Error:", error.message);
    throw error;
  }
};

const actionPrompts = {
  summarize: (text) => `You are a note editor. Return only the final Markdown, with no preface or commentary.\nProduce concise, information-dense bullets.\n\nNote:\n${text}`,
  explain: (text) => `You are a note editor. Return only the final Markdown, with no preface or commentary.\nExplain clearly for a beginner.\n\nNote:\n${text}`,
  rewrite: (text) => `You are a note editor. Return only the final Markdown, with no preface or commentary.\nImprove clarity and flow while preserving meaning.\n\nText:\n${text}`,
  continue: (text) => `You are a note editor. Return only the final Markdown, with no preface or commentary.\nExtend the text naturally, matching its tone and structure.\n\nText:\n${text}`,
};

export const runAiAssist = async ({ action, text, stream = false }) => {
  if (!text || !text.trim()) {
    throw new Error("Text is required for AI assist");
  }

  if (action === "grammar") {
    const result = await checkGrammar(text);
    return {
      action: "grammar",
      suggestion: result.corrected,
      original: result.original,
      errors: result.errors,
    };
  }

  const promptBuilder = actionPrompts[action];
  if (!promptBuilder) {
    throw new Error("Unsupported AI action");
  }

  try {
    const result = await generateContentWithFallback(promptBuilder(text), stream);
    if (stream) return result;

    let suggestion = result;
    if (typeof suggestion === "string" && suggestion.startsWith("```")) {
      suggestion = suggestion.replace(/^```[a-z]*\n?|```$/gi, "").trim();
    }

    return {
      action,
      suggestion,
      original: text,
      errors: [],
    };
  } catch (error) {
    console.error("AI Assist Error:", error.message);
    throw error;
  }
};

export const getDynamicPrompts = () => {
  return [
    { title: "Summarize Note", action: "summarize" },
    { title: "Explain Concept", action: "explain" },
    { title: "Improve Grammar", action: "grammar" },
    { title: "Continue Writing", action: "continue" },
  ];
};
