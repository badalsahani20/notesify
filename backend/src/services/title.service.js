import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGroq, executeOpenRouter, QUICK_MODEL } from "./ai.service.js";
import { stripHtml } from "../utils/stripHtml.js";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export const TITLE_MODEL =
  process.env.TITLE_MODEL || "meta-llama/llama-3.1-8b-instruct";

/**
 * Generate a short, high-quality 3-6 word title from plain text note or conversation content.
 * Pure Stateless Contract: Input = content (string), Output = title (string).
 * Zero side effects / zero DB mutations.
 * 3-Tier AI Fallback Chain: Gemini 2.5 Flash -> Groq -> OpenRouter -> Plain Text Fallback.
 */
export const generateTitleFromText = async (text) => {
  const plainText = typeof text === "string" ? stripHtml(text).trim() : "";
  const source = plainText || "New Note";

  const fallbackTitle = source
    .replace(/\s+/g, " ")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .slice(0, 54)
    .trim();

  const titleMessages = [
    {
      role: "system",
      content:
        "Generate a short, concise title (3 to 6 words maximum) for this content. Be specific to the main topic. No quotes, no markdown formatting, no trailing punctuation. Return ONLY the title string.",
    },
    {
      role: "user",
      content: `${source.slice(0, 1500)}\n\nTitle:`,
    },
  ];

  let rawTitle = "";
  let successfulProvider = "";

  console.log(`[TitleService] 🚀 Generating title for text (${source.length} chars)...`);

  // 1. Try Gemini AI first if GEMINI_API_KEY is available
  if (genAI) {
    try {
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });
      const result = await geminiModel.generateContent(
        `Generate a short, specific, high-quality title (3 to 6 words) for this note content. Do NOT wrap in quotes, do NOT include markdown formatting or trailing punctuation. Return ONLY the title string.\n\nNote Content:\n${source.slice(
          0,
          1500,
        )}`,
      );
      rawTitle = result.response?.text?.() || "";
      if (rawTitle) {
        successfulProvider = "Gemini 2.5 Flash";
      }
    } catch (geminiErr) {
      console.warn(
        "❌ [TitleService] Provider [Gemini 2.5 Flash] failed:",
        geminiErr.message,
      );
    }
  } else {
    console.log("ℹ️ [TitleService] Provider [Gemini] skipped (GEMINI_API_KEY missing)");
  }

  // 2. Fall back to Groq if Gemini wasn't available or failed
  if (!rawTitle && process.env.GROQ_API_KEY) {
    try {
      rawTitle = await executeGroq(titleMessages, false, "openai/gpt-oss-120b");
      if (rawTitle) {
        successfulProvider = "Groq (openai/gpt-oss-120b)";
      }
    } catch (groqErr) {
      console.warn(
        "❌ [TitleService] Provider [Groq (openai/gpt-oss-120b)] failed:",
        groqErr.message,
      );
    }
  } else if (!rawTitle) {
    console.log("ℹ️ [TitleService] Provider [Groq] skipped (GROQ_API_KEY missing)");
  }

  // 3. Fall back to OpenRouter (using TITLE_MODEL / QUICK_MODEL)
  if (!rawTitle) {
    try {
      const modelName = TITLE_MODEL || QUICK_MODEL;
      rawTitle = await executeOpenRouter(
        modelName,
        titleMessages,
        false,
        false,
      );
      if (rawTitle) {
        successfulProvider = `OpenRouter (${modelName})`;
      }
    } catch (orErr) {
      console.error(
        "❌ [TitleService] Provider [OpenRouter] failed:",
        orErr.message,
      );
    }
  }

  // 4. Final title formatting and clean-up
  const title = rawTitle
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^title\s*:\s*/i, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !title ||
    /generate|descriptive|content|input|task|return only|no quotes/i.test(title)
  ) {
    const finalFallback = fallbackTitle || "Untitled Note";
    console.warn(`⚠️ [TitleService] All AI providers failed or returned generic title. Using fallback: "${finalFallback}"`);
    return finalFallback;
  }

  const finalTitle = title.slice(0, 54);
  console.log(`✅ [TitleService] Successfully generated title via [${successfulProvider}]: "${finalTitle}"`);
  return finalTitle;
};

export const generateTitle = generateTitleFromText;
