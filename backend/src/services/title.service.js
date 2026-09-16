import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGroq, executeOpenRouter, QUICK_MODEL, TITLE_GENERATION_MODEL } from "./ai.service.js";
import { stripHtml } from "../utils/stripHtml.js";

const getGenAI = () =>
  process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

export const TITLE_MODEL =
  process.env.TITLE_MODEL || TITLE_GENERATION_MODEL || QUICK_MODEL || "openai/gpt-oss-20b";

/**
 * Generate a short, high-quality 3-6 word title from plain text note or conversation content.
 * Pure Stateless Contract: Input = content (string), Output = title (string).
 * Zero side effects / zero DB mutations.
 * 3-Tier AI Fallback Chain: Gemini 2.5 Flash -> Groq -> OpenRouter -> Plain Text Fallback.
 */
export const generateTitleFromText = async (text) => {
  const plainText = typeof text === "string" ? stripHtml(text).trim() : "";
  if (!plainText || plainText.length < 5) {
    return "Untitled Note";
  }

  const source = plainText;

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
  const genAI = getGenAI();
  if (genAI) {
    try {
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-3.5-flash-lite",
      });
      const result = await geminiModel.generateContent(
        `Generate a short, specific, high-quality title (3 to 6 words) for this note content. Do NOT wrap in quotes, do NOT include markdown formatting or trailing punctuation. Return ONLY the title string.\n\nNote Content:\n${source.slice(
          0,
          1500,
        )}`,
      );
      rawTitle = result.response?.text?.() || "";
      if (rawTitle) {
        successfulProvider = "Gemini 3.5 Flash Lite";
      }
    } catch (geminiErr) {
      console.warn(
        "❌ [TitleService] Provider [Gemini 3.5 Flash Lite] failed:",
        geminiErr.message,
      );
    }
  } else {
    console.log("ℹ️ [TitleService] Provider [Gemini] skipped (GEMINI_API_KEY missing)");
  }

  // 2. Fall back to Groq if Gemini wasn't available or failed
  if (!rawTitle && process.env.GROQ_API_KEY) {
    try {
      rawTitle = await executeGroq(titleMessages, false, "openai/gpt-oss-20b");
      if (rawTitle) {
        successfulProvider = "Groq (openai/gpt-oss-20b)";
      }
    } catch (groqErr) {
      console.warn(
        "❌ [TitleService] Provider [Groq (openai/gpt-oss-20b)] failed:",
        groqErr.message,
      );
    }
  } else if (!rawTitle) {
    console.log("ℹ️ [TitleService] Provider [Groq] skipped (GROQ_API_KEY missing)");
  }

  // 3. Fall back to OpenRouter (using TITLE_MODEL)
  if (!rawTitle) {
    try {
      const modelName = TITLE_MODEL;
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
    .replace(/^(here is (a |the )?(short |suggested )?title|suggested title|title)\s*:\s*/i, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const isMetaEcho =
    /^(here is|here's|untitled note|new note)/i.test(title) ||
    /return only|no quotes|3 to 6 words/i.test(title);

  if (!title || isMetaEcho) {
    const finalFallback = fallbackTitle || "Untitled Note";
    console.warn(`⚠️ [TitleService] All AI providers failed or returned generic title. Using fallback: "${finalFallback}"`);
    return finalFallback;
  }

  const finalTitle = title.slice(0, 54);
  console.log(`✅ [TitleService] Successfully generated title via [${successfulProvider}]: "${finalTitle}"`);
  return finalTitle;
};

/**
 * Strips conversational filler, conversational prefixes, and personal greetings
 * from a raw conversation turn to produce clean topic text.
 */
export const sanitizeConversationText = (text = "") => {
  return text
    .replace(/^(user|assistant|system|iris)\s*:\s*/gi, "")
    .replace(/^\[Attached Image[^\]]*\]\s*/gi, "")
    .replace(/\b(hey|hello|hi|yo|sup|please|can you|could you|i want to know|tell me about|explain to me|help me with|show me|review this)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^["'`*_#\s,.:;-]+|["'`*_#\s,.:;-]+$/g, "")
    .trim();
};

/**
 * Dedicated high-quality session title generator for AI conversations.
 * Produces a concise 3-7 word topic bookmark without "User:", greetings, or transcripts.
 */
export const generateConversationTitle = async (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "New Conversation";
  }

  // Extract up to the first 4 meaningful turns (user & assistant)
  const meaningfulTurns = messages
    .filter((m) => m && m.content && typeof m.content === "string")
    .slice(0, 4)
    .map((m) => {
      const role = m.role === "assistant" ? "Assistant" : "User";
      const clean = sanitizeConversationText(stripHtml(m.content));
      return clean ? `${role}: ${clean.slice(0, 300)}` : "";
    })
    .filter(Boolean);

  if (meaningfulTurns.length === 0) {
    return "New Conversation";
  }

  const conversationSummary = meaningfulTurns.join("\n");

  // Fallback title derived from sanitized first user query
  const firstUserMsg = messages.find((m) => m.role === "user");
  const sanitizedFirst = sanitizeConversationText(stripHtml(firstUserMsg?.content || ""));
  const words = sanitizedFirst.split(/\s+/).filter(Boolean);
  const fallbackTitle = words.length > 0
    ? words.slice(0, 6).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : "New Conversation";

  const systemPrompt =
    "You are a concise session title generator for an AI note-taking app. " +
    "Generate a specific, natural, 3 to 6 word title summarizing the central topic or task of this conversation. " +
    "STRICT RULES:\n" +
    "- Return ONLY the title string.\n" +
    "- No quotes, no markdown, no punctuation at the end.\n" +
    "- Do NOT include transcript labels like 'User:', 'Assistant:', or message numbers.\n" +
    "- Do NOT include conversational filler like 'Hey', 'Can you', 'Yo', 'I want', etc.\n" +
    "- Do NOT include names of users or AI assistants.\n" +
    "- Never return 'New Chat' or 'Conversation'.";

  const titleMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Conversation Context:\n${conversationSummary}\n\nTitle:` },
  ];

  let rawTitle = "";
  let successfulProvider = "";

  // 1. Try Gemini AI
  const genAI = getGenAI();
  if (genAI) {
    try {
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
      const prompt = `${systemPrompt}\n\nConversation Context:\n${conversationSummary}\n\nTitle:`;
      const result = await geminiModel.generateContent(prompt);
      rawTitle = result.response?.text?.() || "";
      if (rawTitle) successfulProvider = "Gemini 3.5 Flash Lite";
    } catch (err) {
      console.warn("❌ [TitleService:Conversation] Gemini failed:", err.message);
    }
  }

  // 2. Fall back to Groq
  if (!rawTitle && process.env.GROQ_API_KEY) {
    try {
      rawTitle = await executeGroq(titleMessages, false, "openai/gpt-oss-20b");
      if (rawTitle) successfulProvider = "Groq (openai/gpt-oss-20b)";
    } catch (err) {
      console.warn("❌ [TitleService:Conversation] Groq failed:", err.message);
    }
  }

  // 3. Fall back to OpenRouter
  if (!rawTitle) {
    try {
      rawTitle = await executeOpenRouter(TITLE_MODEL, titleMessages, false, false);
      if (rawTitle) successfulProvider = `OpenRouter (${TITLE_MODEL})`;
    } catch (err) {
      console.warn("❌ [TitleService:Conversation] OpenRouter failed:", err.message);
    }
  }

  // 4. Sanitize and validate
  let cleaned = rawTitle
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^(here is (a |the )?(short |suggested )?title|suggested title|title)\s*:\s*/i, "")
    .replace(/^(user|assistant|system|iris)\s*:\s*/gi, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const isInvalid =
    !cleaned ||
    /^(here is|here's|untitled|new chat|conversation|title)/i.test(cleaned) ||
    /return only|no quotes|3 to 6 words/i.test(cleaned);

  if (isInvalid) {
    console.warn(`⚠️ [TitleService:Conversation] Providers returned invalid title. Using fallback: "${fallbackTitle}"`);
    return fallbackTitle;
  }

  const finalTitle = cleaned.slice(0, 54);
  console.log(`✅ [TitleService:Conversation] Generated via [${successfulProvider}]: "${finalTitle}"`);
  return finalTitle;
};

export const generateTitle = generateTitleFromText;
