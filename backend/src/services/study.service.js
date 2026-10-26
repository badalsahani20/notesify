import { executeOpenRouter, PRIMARY_MODEL, QUICK_MODEL } from "./ai.service.js";

// ─── MODEL PERSONALITIES ──────────────────────────────────────────────────────
// Each model has a distinct quiz personality — a different style of questioning.
// To add a new model (e.g. Claude, Gemini): add a key here and pass modelStyle
// from the frontend. No other changes needed.

const QUIZ_PERSONALITIES = {
  // Socratic — asks "why" and "how", distractors target misconceptions
  deepseek: `You are a Socratic study coach powered by DeepSeek.
Your questioning style:
- Ask "why" and "how" more than "what".
- For MCQs, design distractors that test common misconceptions, not random wrong answers.
- Short-answer questions should require synthesis, not just recall.
- Explanations should reveal the reasoning chain, not just confirm the answer.
- Calibrate difficulty based on the depth of the source material.`,

  // Structured — precise, STEM-friendly, foundational → advanced ordering
  qwen: `You are a structured quiz engine powered by Qwen.
Your questioning style:
- Prefer precise, unambiguous wording.
- For technical content, include edge-case questions.
- MCQ distractors should be plausible near-misses, not obvious fakes.
- Explanations should be concise and reference the exact concept from the note.
- Rank questions from foundational → advanced.`,

  // Creative — scenario-based, real-world, multi-perspective (placeholder for Gemini)
  gemini: `You are a creative quiz designer powered by Gemini.
Your questioning style:
- Use scenario-based and real-world application questions.
- Encourage multi-perspective thinking.
- Mix factual recall with analytical reasoning.
- Explanations should connect the concept to a broader real-world context.`,
};

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

const executeStudyGeneration = async (systemPrompt, userPrompt) => {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await executeOpenRouter(PRIMARY_MODEL, messages, false, false);
    return raw;
  } catch (err) {
    console.warn("⚠️ Primary model failed, falling back to Qwen:", err.message);
    const raw = await executeOpenRouter(
      QUICK_MODEL,
      messages,
      false,
      false,
    );
    return raw;
  }
};

/**
 * Checks if the note content is actually meaningful enough for study material.
 * Detects gibberish, random keyboard mashing, or extreme brevity.
 */
const validateStudyContent = async (noteContent) => {
  if (!noteContent || noteContent.trim().length < 100) {
    return {
      isValid: false,
      reason: "Note is too short (minimum 100 characters).",
    };
  }

  const systemPrompt = `You are a Content Auditor. Your only task is to determine if the provided text contains meaningful, educational information that can be turned into a quiz or flashcards.
  
  Reject (isValid: false) if:
  - The text is gibberish or random keyboard mashing (e.g., "asdfasdf", "hjklhjkl").
  - The text is just a list of random words with no context.
  - The text is too shallow or lacks factual substance.
  
  Approve (isValid: true) if:
  - The text explains concepts, facts, stories, or instructions.
  
  Return ONLY JSON: { "isValid": boolean, "reason": "short explanation if false" }`;

  try {
    // Use the faster model for this simple check
    const raw = await executeOpenRouter(
      QUICK_MODEL,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Audit this text:\n\n${noteContent.slice(0, 1000)}` },
      ],
      false,
      false,
      100 // Set maxTokens to 100 for the audit
    );

    const result = safeParseStudyJson(raw, "content-audit");
    return result;
  } catch (err) {
    console.error("❌ Content audit failed, bypassing:", err.message);
    return { isValid: true }; // Bypass on error to avoid blocking the user
  }
};

/**
 * Safely parses a JSON string returned by the model.
 * Strips markdown code fences if the model ignored the instruction.
 *
 * @param {string} raw          - Raw string from the model
 * @param {string} context      - Label used in error messages ("flashcards" | "quiz")
 * @returns {object} Parsed JSON object
 */
const safeParseStudyJson = (raw, context) => {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?|```$/gi, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error(
      `❌ JSON parse failed for ${context}:`,
      cleaned.slice(0, 200),
    );
    throw new Error(
      `AI returned malformed JSON for ${context}. Please try regenerating.`,
    );
  }
};

// ─── EXPORTED SERVICES ───────────────────────────────────────────────────────

/**
 * Generates flashcards from a note's plain-text content.
 * Optionally uses chat history to identify and target weak spots.
 *
 * @param {string} noteContent               - Plain text of the note (HTML already stripped)
 * @param {object} options
 * @param {number}   options.count           - Number of cards to generate (default: 12)
 * @param {Array}    options.chatHistory     - Recent Iris chat turns for weak-spot detection
 * @param {string}   options.modelStyle      - "deepseek" | "qwen" | "gemini" (default: "deepseek")
 * @returns {Promise<Array>} Array of { front, back, difficulty } card objects
 */
export const generateFlashcardsFromNote = async (
  noteContent,
  { count = 12, chatHistory = [], modelStyle = "deepseek" } = {},
) => {
  // 1. Semantic Validation
  const audit = await validateStudyContent(noteContent);
  if (audit.isValid === false) {
    throw new Error(audit.reason || "Content is not suitable for flashcards.");
  }

  const personality =
    QUIZ_PERSONALITIES[modelStyle] ?? QUIZ_PERSONALITIES.deepseek;

  const weakSpotHint =
    chatHistory.length > 0
      ? `\n\nIMPORTANT — The user has been studying this topic via chat. Here are their recent questions/struggles:\n${chatHistory
          .filter((h) => h.role === "user")
          .slice(-6)
          .map((h) => `- ${h.content.slice(0, 200)}`)
          .join("\n")}\nPrioritize flashcards that address these weak spots.`
      : "";

  const systemPrompt = `${personality}\n\nTask: Generate exactly ${count} flashcards from the provided note.\nEach card must have:\n- "front": a concise question or term\n- "back": a clear answer or definition\n- "difficulty": one of "easy", "medium", "hard"\n\nReturn ONLY valid JSON. No markdown, no code fences, no explanation.\nFormat: { "cards": [{ "front": "...", "back": "...", "difficulty": "medium" }] }`;

  const userPrompt = `Note content:\n${noteContent.slice(0, 7500)}${weakSpotHint}`;

  const raw = await executeStudyGeneration(systemPrompt, userPrompt);
  const parsed = safeParseStudyJson(raw, "flashcards");

  if (!Array.isArray(parsed?.cards))
    throw new Error("AI response missing 'cards' array.");
  return parsed.cards;
};

/**
 * Generates quiz questions from a note's plain-text content.
 * Supports MCQ, True/False, and Short Answer. Chat history drives weak-spot weighting.
 *
 * @param {string} noteContent               - Plain text of the note (HTML already stripped)
 * @param {object} options
 * @param {number}   options.count           - Number of questions (default: 10)
 * @param {string[]} options.types           - Question types (default: all three)
 * @param {Array}    options.chatHistory     - Recent Iris chat turns for weak-spot targeting
 * @param {string}   options.modelStyle      - "deepseek" | "qwen" | "gemini" (default: "deepseek")
 * @returns {Promise<Array>} Array of question objects
 */
export const generateQuizFromNote = async (
  noteContent,
  {
    count = 10,
    types = ["mcq", "true_false", "short_answer"],
    chatHistory = [],
    modelStyle = "deepseek",
  } = {},
) => {
  // 1. Semantic Validation
  const audit = await validateStudyContent(noteContent);
  if (audit.isValid === false) {
    throw new Error(audit.reason || "Content is not suitable for a quiz.");
  }

  const personality =
    QUIZ_PERSONALITIES[modelStyle] ?? QUIZ_PERSONALITIES.deepseek;

  const weakSpotHint =
    chatHistory.length > 0
      ? `\n\nIMPORTANT — Conversation context (user's recent struggles/questions):\n${chatHistory
          .filter((h) => h.role === "user")
          .slice(-6)
          .map((h) => `- ${h.content.slice(0, 200)}`)
          .join("\n")}\nWeight more questions toward these weak areas.`
      : "";

  const typeInstructions = {
    mcq: "For MCQ: provide exactly 4 options (A/B/C/D). One must be correct. Distractors should test misconceptions.",
    true_false: 'For True/False: answer must be exactly "True" or "False".',
    short_answer:
      "For Short Answer: expected answer should be 1–2 sentences. Accept minor wording variations.",
  };
  const activeInstructions = types
    .map((t) => typeInstructions[t])
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `${personality}\n\nTask: Generate exactly ${count} quiz questions from the provided note.\nAllowed question types: ${types.join(", ")}.\n\n${activeInstructions}\n\nEvery question must include an "explanation" field — a concise reason why the answer is correct, referencing the note.\n\nReturn ONLY valid JSON. No markdown, no code fences.\nFormat:\n{\n  "questions": [\n    {\n      "type": "mcq",\n      "question": "...",\n      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],\n      "answer": "A. ...",\n      "explanation": "..."\n    }\n  ]\n}`;

  const userPrompt = `Note content:\n${noteContent.slice(0, 7500)}${weakSpotHint}`;

  const raw = await executeStudyGeneration(systemPrompt, userPrompt);
  const parsed = safeParseStudyJson(raw, "quiz");

  if (!Array.isArray(parsed?.questions))
    throw new Error("AI response missing 'questions' array.");
  return parsed.questions;
};
