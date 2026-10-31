import { generateContentWithFallback } from "./transport/geminiClient.js";

const GRAMMAR_SYSTEM_PROMPT = `You are an expert note editor. Return only the final Markdown, with no preface or commentary.
Correct grammar, spelling, punctuation, and awkward phrasing without changing meaning.`;

export const buildGrammarMessages = (text) => [
  {
    role: "system",
    content: [
      {
        type: "text",
        text: GRAMMAR_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
  },
  {
    role: "user",
    content: `Text:\n${text}`,
  },
];

const SUMMARIZE_SYSTEM_PROMPT = `You are an expert note summarizer. Analyze the entire document, including its structure, headings, tables, lists, code blocks, and examples.

Produce a concise, information-dense Markdown summary that:
- Preserves key concepts, facts, technical details, and important examples.
- Consolidates redundant information without losing unique insights.
- Retains essential table data, formulas, code behavior, and practical takeaways.
- Maintains technical accuracy and context; do not introduce unsupported claims.
- Prioritizes high-value information over aggressive compression.
- Uses clear headings and bullets for easy revision and retrieval.

Return ONLY the final Markdown summary, without conversational filler or a preface.`;

const EXPLAIN_SYSTEM_PROMPT = `You are an expert explainer. Explain the provided content clearly, accurately, and in a way that builds understanding.

- Identify the main ideas and explain them in a logical order.
- Clarify complex concepts, unfamiliar terms, and important relationships using examples or analogies where helpful.
- Preserve the original meaning, factual accuracy, essential details, and relevant nuances.
- Adapt the depth, language, and format to the subject matter and its complexity.
- Follow the source's scope. Add context when needed for understanding, but avoid unnecessary expansion or unrelated information.
- Consolidate overlapping ideas and avoid repetition.
- When explaining code: walk through it section by section. For short, focused snippets, explain line by line. For larger sections, present the focused block and explain the core logic directly underneath before moving forward.
- Use headings, lists, tables, formulas, code, or other appropriate formats only when they improve clarity.
- Do not invent facts or present uncertain claims as established facts.

Return ONLY the final Markdown explanation, without a preface or conversational commentary.`;

const REWRITE_SYSTEM_PROMPT = `You are an expert editor. Improve the clarity, readability, flow, and consistency of the provided note while preserving its original meaning, intent, tone, and level of detail.

- Preserve factual and technical accuracy, including formulas, code behavior, and terminology.
- Maintain the original structure, hierarchy, and formatting unless changes improve readability.
- Correct grammar, awkward phrasing, redundancy, and inconsistencies.
- Avoid unnecessary verbosity, unsupported additions, or changes to the author's intent.
- Adapt editing choices to the content type and context.
- Keep the original language unless explicitly asked to translate.

Return ONLY the polished Markdown text, without prefaces, explanations, or commentary.`;

const CONTINUE_SYSTEM_PROMPT = `You are an expert note co-author. Continue the document naturally from the exact cursor insertion point.

- Use the preceding context to maintain continuity, avoid repetition, and preserve the document's meaning and structure.
- If a current line or section is provided for completion, complete that specific section appropriately.
- If subsequent context is present, write only the missing content needed to bridge the preceding and subsequent sections. Stop before duplicating or entering the subsequent content.
- Match the document's language, tone, formatting, terminology, and level of detail.
- Preserve factual accuracy and ensure the continuation fits the subject and surrounding content.
- Do not repeat existing explanations, examples, tables, code, definitions, or headings unless explicitly required to complete the section.
- NEVER append an empty table, placeholder table, or unrequested summary table at the end of the continuation.
- Use appropriate Markdown and supported editor formatting where helpful. Avoid unnecessary structure or verbosity.
- If the context does not establish what should come next, make a reasonable, context-grounded continuation without inventing unsupported details.

Return ONLY the Markdown content to insert, without prefaces, explanations, or commentary.`;

const NOTE_CREATION_SYSTEM_PROMPT = `You are an expert note writer and editor. Fulfill the user's request with clear, accurate, well-structured content.

- Return ONLY the final Markdown, without prefaces, commentary, or conversational filler.
- Match the document's language, style, structure, and level of detail.
- Prioritize clarity and conciseness without omitting important details.
- Use appropriate Markdown formatting, examples, or code when useful. Only include a table if data is genuinely multi-dimensional or for direct comparisons; NEVER append empty, placeholder, or unprompted summary tables at the end.
- Preserve factual accuracy and use standard terminology.
- Avoid unnecessary verbosity, repetition, and unsupported claims.
- If the request is ambiguous, make reasonable, context-aware assumptions.
- For technical content, follow the versions and conventions established by the context; otherwise, use broadly accepted practices.
- Integrate naturally with the surrounding content and section hierarchy.`;

const buildActionMessages = (systemPrompt, userPayload) => [
  {
    role: "system",
    content: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
  },
  {
    role: "user",
    content: userPayload,
  },
];

const actionPrompts = {
  summarize: (text) => buildActionMessages(SUMMARIZE_SYSTEM_PROMPT, `Document:\n${text}`),
  explain: (text) => buildActionMessages(EXPLAIN_SYSTEM_PROMPT, `Content:\n${text}`),
  rewrite: (text) => buildActionMessages(REWRITE_SYSTEM_PROMPT, `Text:\n${text}`),
  continue: (text) => buildActionMessages(CONTINUE_SYSTEM_PROMPT, `Context & Boundaries:\n${text}`),
  noteCreation: (text) => buildActionMessages(NOTE_CREATION_SYSTEM_PROMPT, `Context & Request:\n${text}`),
};

export const runAiAssist = async ({ action, text, stream = false }) => {
  if (!text || !text.trim()) {
    throw new Error("Text is required for AI assist");
  }

  if (action === "grammar") {
    // Grammar checks are purely syntactic and do not require chain-of-thought tokens
    const correctedText = await generateContentWithFallback(
      buildGrammarMessages(text),
      false,
      false,
    );

    return {
      action: "grammar",
      suggestion: correctedText,
      original: text,
    };
  }

  const promptBuilder = actionPrompts[action];
  if (!promptBuilder) {
    throw new Error("Unsupported AI action");
  }

  try {
    const messages = promptBuilder(text);
    const result = await generateContentWithFallback(messages, stream);
    if (stream) return result;

    let suggestion = result;
    if (typeof suggestion === "string" && suggestion.startsWith("```")) {
      suggestion = suggestion.replace(/^```[a-z]*\n?|```$/gi, "").trim();
    }

    return {
      action,
      suggestion,
      original: text,
    };
  } catch (error) {
    console.error("AI Assist Error:", error.message);
    throw error;
  }
};

