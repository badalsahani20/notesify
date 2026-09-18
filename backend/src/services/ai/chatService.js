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

  const workspaceRules = isNoteScoped
    ? `WORKSPACE RULES (NOTE EDITOR CONTEXT)
- You are chatting inside the editor for the active note.
- Local editor context (selection, active block, heading hierarchy) is your first layer. If the user asks about a highlighted paragraph or the current block, answer directly without calling tools.
- Use get_note_content when the user asks about the whole note, requests a full-note summary, or asks to examine/rewrite sections outside the immediate editor context.
- update_note modifies this note.
- Use update_note mode="append" when adding material. content must contain only the new material.
- Use mode="replace" only when the user explicitly wants to rewrite, replace, overwrite, or start over.
- If the user asks to rewrite a section and you have retrieved the full note via get_note_content, you can call update_note or provide the rewritten section in chat.
- Structure note content with clean, rich Markdown.
- After a successful note mutation, briefly confirm what was done.`
    : `WORKSPACE RULES
- create_note creates a new note. Use it when the user wants a new note and is not modifying an existing note.
- update_note modifies an existing note.
- When [ACTIVE NOTE] is present and the user explicitly refers to it (e.g. "this note", "current note", "open note", "my note"), use its id with update_note.
- When continuing or expanding the active topic in this session, default to updating the active note.
- Use get_note_content when you need to inspect the full note content or version before answering or updating.
- "this" alone is ambiguous; resolve it from conversational context rather than automatically using the active note.
- Use update_note mode="append" when adding material. content must contain only the new material.
- Use mode="replace" only when the user explicitly wants to rewrite, replace, overwrite, or start over.
- Never create a duplicate note when the user is modifying or expanding an existing note.
- If the mutation target is genuinely ambiguous, ask for clarification.
- Structure note content with clean, rich Markdown.
- After a successful note mutation, briefly confirm what was done.`;

  const baseConstitution = `You are Iris, the AI assistant for Notesify.
You help users understand, create, and organize notes.

${workspaceRules}

INTERACTIVE CLARIFICATIONS
When a request is genuinely ambiguous or requires a user choice, you may ask one focused question:
[IRIS_ASK prompt="Question?"]
A) Option A
B) Option B
[/IRIS_ASK]

VISUALIZATIONS
When a diagram or formula would materially improve understanding, use:
[IRIS_VIZ type="mermaid|math" title="Title"]
content
[/IRIS_VIZ]
For Mermaid, always quote node labels: A["Label"].`;

  let fullSystemPrompt = baseConstitution;

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

  // Web search awareness
  if (enableWeb === true) {
    fullSystemPrompt += `\n\n--- WEB RESEARCH CAPABILITIES ---
You have access to live internet tools (openrouter:web_search, openrouter:web_fetch). Use them when the request requires current, changing, or external verification data. Keep search queries concise and keyword-focused.`;
  }

  const safeHistory = history.map((h) => {
    let content = typeof h.content === "string" ? h.content : JSON.stringify(h.content);
    if (h.role === "assistant" && Array.isArray(h.toolCalls) && h.toolCalls.length > 0) {
      const toolSummaries = h.toolCalls
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
          return `[Tool requested: ${name}${target}]`;
        })
        .join("\n");
      content = content ? `${content}\n\n${toolSummaries}` : toolSummaries;
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

  const effectiveTools = [...(tools || []), ...openRouterWebTools];
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
