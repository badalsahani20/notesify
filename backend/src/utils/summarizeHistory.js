import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeOpenRouter, QUICK_MODEL } from "../services/ai/index.js";
import { client as groqClient } from "./groqClient.js";

const SUMMARIZER_SYSTEM_INSTRUCTION = `You are an expert technical conversation summarizer.
Your job is to produce a state-preserving, comprehensive summary of the conversation so far.

CRITICAL RETENTION RULES:
1. Preserve State, Not Just a Recap: Retain the ongoing status of technical tasks, decisions made, architecture choices, and user constraints.
2. Decisions & Rationale: Record what approaches were selected or rejected and why.
3. Unresolved & Pending: Note any unresolved bugs, pending questions, or planned next steps.
4. Technical Names: Keep exact names of components, files, functions, APIs, models, and dependencies.
5. User Preferences: Retain user preferences, tech stack constraints, and working style.
6. Conciseness & Range: Keep the summary cohesive, technical, and structured, targeting 300 to 600 words. Avoid conversational filler or greetings.`;

/**
 * Summarizes older conversation history, consolidating with any existing summary.
 * 3-Tier Multi-Provider Fallback:
 *  Tier 1: Google Gemini Flash (1M TPM context)
 *  Tier 2: OpenRouter (Ling 3.0 Flash / Qwen 3.7 Flash)
 *  Tier 3: Groq (openai/gpt-oss-20b)
 *
 * @param {Array<{ role: string, content: string }>} messagesToSummarize - Full older messages
 * @param {string} existingSummary - Any previous consolidated summary
 * @returns {Promise<string>} Updated consolidated summary (300-600 words)
 */
export const summarizeHistory = async (messagesToSummarize, existingSummary = "") => {
  if (!messagesToSummarize || messagesToSummarize.length === 0) {
    return existingSummary || "";
  }

  // Preserve messages in full — no arbitrary 500-char clipping
  const fullHistoryStr = messagesToSummarize
    .map((m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role.toUpperCase()}: ${content}`;
    })
    .join("\n\n");

  const promptContent = existingSummary
    ? `Prior Consolidated Summary:\n${existingSummary}\n\nOlder Messages Leaving Active Window To Consolidate:\n${fullHistoryStr}\n\nProduce an updated, unified summary (300-600 words) capturing the entire technical state and conversation context.`
    : `Conversation History To Summarize:\n${fullHistoryStr}\n\nProduce a comprehensive, state-preserving summary (300-600 words) capturing the technical state and conversation context.`;

  // ── Tier 1: Gemini Flash ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash-lite",
        systemInstruction: SUMMARIZER_SYSTEM_INSTRUCTION,
        generationConfig: {
          maxOutputTokens: 2500,
        },
      });

      const result = await model.generateContent(promptContent);
      const text = result.response?.text?.()?.trim();
      if (text) {
        console.log("✅ [SummarizeHistory] Summary generated via Tier 1 (Gemini Flash)");
        return text;
      }
    } catch (geminiErr) {
      console.warn(
        "⚠️ [SummarizeHistory] Tier 1 (Gemini) failed, falling back to OpenRouter:",
        geminiErr.message
      );
    }
  }

  // ── Tier 2: OpenRouter (Ling 3.0 Flash / Quick Model) ──
  try {
    const summarizerModel = QUICK_MODEL || "inclusionai/ling-3.0-flash";
    const orResult = await executeOpenRouter(
      summarizerModel,
      [
        { role: "system", content: SUMMARIZER_SYSTEM_INSTRUCTION },
        { role: "user", content: promptContent },
      ],
      false,
      false, // Reasoning disabled for summarization
      2500
    );

    if (orResult && typeof orResult === "string" && orResult.trim()) {
      console.log(
        `✅ [SummarizeHistory] Summary generated via Tier 2 (OpenRouter: ${summarizerModel})`
      );
      return orResult.trim();
    }
  } catch (orErr) {
    console.warn(
      "⚠️ [SummarizeHistory] Tier 2 (OpenRouter) failed, falling back to Groq:",
      orErr.message
    );
  }

  // ── Tier 3: Groq (openai/gpt-oss-20b) ──
  if (groqClient?.chat?.completions) {
    try {
      const response = await groqClient.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: SUMMARIZER_SYSTEM_INSTRUCTION },
          { role: "user", content: promptContent },
        ],
        max_tokens: 2500,
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      if (text) {
        console.log("✅ [SummarizeHistory] Summary generated via Tier 3 (Groq: openai/gpt-oss-20b)");
        return text;
      }
    } catch (groqErr) {
      console.warn("⚠️ [SummarizeHistory] Tier 3 (Groq) failed:", groqErr.message);
    }
  }

  return existingSummary || "";
};
