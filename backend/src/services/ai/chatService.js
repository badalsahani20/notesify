import {
  PRIMARY_MODEL,
  TEACHING_MODELS,
  DEFAULT_CHAT_MODEL,
  COMPLEX_ANALYSIS_MODEL,
  VISUALIZATION_MODEL,
  VISUALIZATION_FALLBACK_MODEL,
  getOpenRouterApiKey,
} from "./config/aiModels.js";
import { executeOpenRouter } from "./transport/openRouterClient.js";
import { executeGemini } from "./transport/geminiClient.js";
import { classifyChatIntent } from "./router/modelRouter.js";

/**
 * Formats a StructuredNoteContext into a clear, LLM-readable prompt section.
 */
export const formatStructuredNoteContext = (context) => {
  if (!context) return "";
  if (typeof context === "string") return context;

  const {
    hasSelection,
    selection,
    activeBlock,
    surroundingBlocks = [],
    headingPath = [],
  } = context;

  const sections = [];

  if (headingPath && headingPath.length > 0) {
    sections.push(`[Document Section Hierarchy]:\n${headingPath.join(" > ")}`);
  }

  if (hasSelection && selection?.text) {
    sections.push(`[User specifically highlighted this text in their editor]:\n${selection.text}`);
  } else if (surroundingBlocks.length > 0) {
    const formattedBlocks = surroundingBlocks
      .map((b) => {
        const isActive = activeBlock && b.id === activeBlock.id ? " (current block / cursor focus)" : "";
        return `[${b.type}${isActive}]: ${b.text}`;
      })
      .join("\n");
    sections.push(`[Editor Context (surrounding blocks)]:\n${formattedBlocks}`);
  }

  return sections.join("\n\n");
};

export const chatWithAi = async ({
  message,
  history = [],
  summary = "",
  noteContext = "",
  webContext = "",
  systemPrompt = "",
  pdfContext = "",
  imageBase64 = null,
  stream = false,
  useReasoning = true,
  enableWeb = true,
  chatMode = "casual",
  tools = null,
  isNoteScoped = false,
  extraMessages = [],
}) => {
  const noteContextText = typeof noteContext === "object"
    ? formatStructuredNoteContext(noteContext)
    : noteContext;

  const selectedModel = classifyChatIntent(
    message,
    imageBase64,
    history,
    noteContextText,
    pdfContext,
    chatMode
  );

  const noteMutationRules = `- update_note with mode="append" adds material; content must contain only the new material. Use mode="replace" only when the user explicitly asks to rewrite, overwrite, or start over.
- Write note content in clean Markdown.
- After a successful note change, briefly confirm what you did.`;

const noteScopedRules = `WORKSPACE (NOTE EDITOR)
- You're chatting inside the editor for the active note.
- The editor context below (selection, active block, headings) comes first. If the question is about the highlighted text or current block, answer directly without tools.
- Call get_note_content only for whole-note questions, full summaries, or work outside the visible context.
${noteMutationRules}`;

const workspaceRules = `WORKSPACE
- Use create_note for a new note and update_note for an existing one. Never create a duplicate when the user is modifying or expanding an existing note.
- If [ACTIVE NOTE] is present and the user refers to it ("this note", "current note", "my note"), or you're continuing its topic, update it by its id.
- A bare "this" is ambiguous: resolve it from the conversation, not automatically to the active note.
- Call get_note_content when you need the full content or version before answering or updating.
- If the target is genuinely ambiguous, ask.
${noteMutationRules}`;

const buildBaseConstitution = (isNoteScoped) => `You are Iris, the AI assistant for Notesify. You help users understand, create, and organize notes.

${isNoteScoped ? noteScopedRules : workspaceRules}

QUESTIONS & QUIZZES
For quizzes, clarifying questions, preferences, or ranking, use the ask_question tool instead of writing the questions as text. Set purpose="quiz" only when testing the user's knowledge; set purpose="clarification", purpose="preference", or the appropriate purpose otherwise. Write a short conversational intro message before calling ask_question. For quizzes, generate 5 questions by default and never exceed 15. Do not apply the 5-question default to clarification, preference, or ranking prompts. Keep question prompts concise (1-2 sentences), titles short (2-4 words), and each option under 5 words without parenthetical explanations. For rank_priority, options must be the actual items to rank—never include "all", "none", or "other" options. Always invoke the ask_question tool directly through function/tool calling; NEVER output pseudo-tags like "[Tool requested: ...]" in your response text.

VISUALIZATIONS
When a diagram or formula clearly helps, use:
[IRIS_VIZ type="mermaid|math" title="Title"]
content
[/IRIS_VIZ]
For Mermaid, always quote node labels: A["Label"].`;

  let fullSystemPrompt = buildBaseConstitution(isNoteScoped);

  fullSystemPrompt += `\n\nMEMORY POLICY
- Never debate, narrate, or speculate about what should be saved.
- Do not save quiz results, temporary topics, assistant conclusions, session context, or facts inferred from the conversation.
- Only use save_memory when the user explicitly asks you to remember, save, store, or keep a personal fact/preference/goal in memory.
- If the user has not made an explicit memory request, do not call save_memory and continue normally.`;

  if (systemPrompt) {
    fullSystemPrompt += `\n\n${systemPrompt}`;
  }

  if (summary) {
    fullSystemPrompt += `\n\n--- PREVIOUS CONVERSATION SUMMARY ---\n${summary}\n--- END SUMMARY ---`;
  }

  if (pdfContext) {
    fullSystemPrompt += `\n\n--- ATTACHED PDF DOCUMENT CONTENT ---\n${pdfContext.slice(0, 12000)}\n--- END PDF ---`;
  }

  if (noteContextText) {
    fullSystemPrompt += `\n\n${noteContextText}`;
  }

  if (webContext) {
    fullSystemPrompt += `\n\n${webContext}`;
  }

  // Web search awareness & inline citations
  if (enableWeb === true) {
    fullSystemPrompt += `\n\n--- WEB RESEARCH & INLINE CITATIONS ---
You have access to live internet tools (openrouter:web_search, openrouter:web_fetch). Use them when the request requires current, changing, or external verification data. Keep search queries concise and keyword-focused.

INLINE CITATIONS:
When providing facts, statistics, research findings, quotes, or information from web searches or external sources:
- Always cite sources inline immediately following the specific statement or claim, formatted as a markdown link with sequential numbers or domain names: e.g. [1](url) or [2](url) or [domain.com](url).
- Example: "The James Webb Space Telescope launched in December 2021 [1](https://example.com/jwst-launch)."
- Always link directly to the source URL. Never group all sources only at the bottom without inline citations in the body text.`;
  }

  const safeHistory = history.map((h) => {
    let content = typeof h.content === "string" ? h.content : JSON.stringify(h.content);
    // Strip any leaked or previously poisoned [Tool requested: ...] pseudo-tags from history content
    if (content) {
      content = content.replace(/\[Tool requested:\s*[^\]]+\]/gi, "").trim();
    }
    if (h.role === "assistant" && Array.isArray(h.toolCalls) && h.toolCalls.length > 0) {
      const toolSummaries = h.toolCalls
        .filter((tc) => {
          const name = tc.tool || tc.function?.name;
          // Interactive UI question tools must never be injected as pseudo-tags into the prompt
          return name !== "ask_question" && name !== "render_quiz" && name !== "generate_quiz";
        })
        .map((tc) => {
          const name = tc.tool || tc.function?.name || "tool";
          const title = tc.args?.title || tc.data?.title || "";
          const noteId = tc.data?._id || tc.args?.noteId || tc.args?.id || "";
          const target = title ? ` for "${title}"` : "";
          const idInfo = noteId ? ` (Note ID: "${noteId}")` : "";
          if (tc.status === "success") {
            return `[Tool result: ${name} succeeded${target}${idInfo}]`;
          }
          if (tc.status === "error") {
            return `[Tool result: ${name} failed${target}${idInfo}${tc.error ? ` — ${tc.error}` : ""}]`;
          }
          return `[Tool result: ${name} executed${target}${idInfo}]`;
        })
        .join("\n");
      if (toolSummaries) {
        content = content ? `${content}\n\n${toolSummaries}` : toolSummaries;
      }
    }
    return { role: h.role, content };
  });

  const messages = [
    { role: "system", content: fullSystemPrompt },
    ...safeHistory,
    {
      role: "user",
      content: imageBase64
        ? [
            { type: "text", text: message },
            {
              type: "image_url",
              image_url: {
                url:
                  imageBase64.startsWith("data:") ||
                  imageBase64.startsWith("http://") ||
                  imageBase64.startsWith("https://")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ]
        : message,
    },
    ...(Array.isArray(extraMessages) ? extraMessages : []),
  ];

const openRouterWebTools =
    enableWeb === true
      ? [
          {
            type: "openrouter:web_search",
            parameters: {
              engine: "exa",
              max_results: 4,
              max_total_results: 8,
              search_context_size: "medium",
            },
          },
          {
            type: "openrouter:web_fetch",
            parameters: {
              engine: "openrouter",
              max_content_tokens: 25000,
            },
          },
        ]
      : [];

  const explicitMemoryRequest = /\b(remember|save|store|keep\s+(?:this|that)\s+in\s+mind|don't\s+forget|do\s+not\s+forget)\b/i.test(
    typeof message === "string" ? message : ""
  );
  const filteredTools = (tools || []).filter((tool) => {
    const toolName = tool?.function?.name || tool?.name;
    return toolName !== "save_memory" || explicitMemoryRequest;
  });
  const effectiveTools = [...filteredTools, ...openRouterWebTools];
  const finalTools = effectiveTools.length > 0 ? effectiveTools : null;
  const maxToolCalls = finalTools ? 4 : null;

  // Tier 1: OpenRouter (Primary selectedModel)
  if (getOpenRouterApiKey()) {
    try {
      const isVisualConvo = !!imageBase64;
      const activeModel =
        selectedModel ||
        (isVisualConvo ? VISUALIZATION_MODEL : DEFAULT_CHAT_MODEL);
      console.log(`🔥 Attempting Primary Model: ${activeModel}`);

      const isThinkingSupportedModel =
        activeModel === DEFAULT_CHAT_MODEL ||
        TEACHING_MODELS.includes(activeModel) ||
        activeModel === PRIMARY_MODEL ||
        activeModel === COMPLEX_ANALYSIS_MODEL;

      const shouldReason = useReasoning && isThinkingSupportedModel;

      const reply = await executeOpenRouter(
        activeModel,
        messages,
        stream,
        shouldReason,
        5000,
        finalTools,
        maxToolCalls
      );
      console.log(`✅ Chat answered by ${activeModel} (Tier 1)`);
      return stream ? { stream: reply } : { reply };
    } catch (orError) {
      console.error("❌ TIER 1 (OpenRouter) FAILED:", orError.message);
    }
  }

  // Tier 2: OpenRouter Fallback
  if (getOpenRouterApiKey()) {
    try {
      const tier2Model = imageBase64 ? VISUALIZATION_FALLBACK_MODEL : PRIMARY_MODEL;
      console.log(`Attempting Tier 2: OpenRouter (${tier2Model})`);
      const reply = await executeOpenRouter(
        tier2Model,
        messages,
        stream,
        useReasoning,
        5000,
        finalTools,
        maxToolCalls
      );
      console.log(`Chat answered by ${tier2Model} (Tier 2)`);
      return stream ? { stream: reply } : { reply };
    } catch (error) {
      console.warn("⚠️ TIER 2 (OpenRouter) FAILED:", error.message);
    }
  }

  // Tier 3: Gemini Flash Fallback
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("💎 Attempting Secondary: Gemini Flash...");
      const reply = await executeGemini(messages, stream);
      console.log("✅ Chat answered by Gemini Flash (Tier 3)");
      return stream ? { stream: reply } : { reply };
    } catch (geminiError) {
      console.warn("⚠️ TIER 3 (Gemini) FAILED:", geminiError.message);
    }
  }

  throw new Error("I'm having trouble connecting to my brain right now. Please try again in a moment.");
};
