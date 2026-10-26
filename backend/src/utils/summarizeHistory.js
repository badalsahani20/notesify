import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_CHAT_MODEL, executeOpenRouter, QUICK_MODEL } from "../services/ai/index.js";
import { client as groqClient } from "./groqClient.js";

const SUMMARIZER_SYSTEM_INSTRUCTION = `You are an expert conversation context extractor for Notesify.
Your task is to extract and update a concise, structured technical context block from conversation messages.
Do NOT write a narrative story or conversational recap. Do NOT duplicate recent transcript dialogue.

Extract and consolidate only actionable, durable information into these concise sections:
- Current Goal: What the user is actively working on.
- Decisions: Architecture choices, libraries, parameters, and rationale.
- Technical State: File paths, database models, API routes, variable names, and implementation status.
- Constraints: Hard requirements, platform limitations, or design rules.
- Unresolved Issues: Bugs, blockers, missing pieces, or open questions.
- Next Steps: Immediate planned actions.
- User Preferences: Relevant technical or communication preferences explicitly stated.

Rules:
1. Be ultra-dense, structured, and factual (target 250–450 words total).
2. If new messages supersede an earlier decision or fix a previous bug, update the state—never keep outdated facts as current truth.
3. Omit empty sections. Never fabricate details.`;

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
    ? `Prior Extracted Context:\n${existingSummary}\n\nNew Unprocessed Messages to Integrate:\n${fullHistoryStr}\n\nUpdate and consolidate the structured technical context according to your instructions. Preserve unresolved items and update superseded decisions.`
    : `Messages to Extract Context From:\n${fullHistoryStr}\n\nExtract the structured technical context according to your instructions.`;

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
    const summarizerModel = DEFAULT_CHAT_MODEL || "deepseek/deepseek-v4-flash-0731";
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
