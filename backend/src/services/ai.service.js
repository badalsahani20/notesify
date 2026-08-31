import { diffWords } from "diff";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mapDiffsToError } from "../utils/mapDiffsToError.js";
import { client } from "../utils/groqClient.js";
import { summarizeHistory } from "../utils/summarizeHistory.js";
import Prompt from "../models/prompts.model.js";
import { parseIrisResponse } from "../utils/parseIrisResponse.js";

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemma-4-26b-a4b-it" });

export const PRIMARY_MODEL = "deepseek/deepseek-v4-flash";
export const TEACHING_MODELS = [
  "inclusionai/ling-2.6-1t",
  "deepseek/deepseek-v4-flash",
];
export const DEFAULT_CHAT_MODEL = "z-ai/glm-5.3-flash";
export const QUICK_MODEL = "inclusionai/ling-2.6-flash";
export const COMPLEX_ANALYSIS_MODEL = "inclusionai/ling-2.6-1t";
export const VISUALIZATION_MODEL = "qwen/qwen3.7-flash";
export const NOTES_GENERATION_MODEL = "openai/gpt-oss-120b";

const FALLBACK_MODEL = "llama-3.3-70b-versatile";

const getEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
};

const getOpenRouterApiKey = () =>
  getEnv("OPEN_ROUTER", "OPENROUTER_API_KEY", "OPENROUTER_API");

// --- VALIDATION HELPERS ---
const ensureAiApiKey = () => {
  if (
    !process.env.GEMINI_API_KEY &&
    !getOpenRouterApiKey() &&
    !process.env.QWEN_API
  ) {
    throw new Error(
      `No AI provider API keys configured (GEMINI, OPENROUTER, or QWEN)`,
    );
  }
};

const ensureGroqApiKey = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ api key is missing");
  }
};

// --- CORE AI EXECUTION FUNCTIONS ---

export const executeOpenRouter = async (
  modelId,
  messages,
  stream = false,
  includeReasoning = null, // Default to auto-detect based on model
  maxTokens = 5000,
  tools = null,
) => {
  const isQwenModel = modelId.toLowerCase().includes("qwen");
  const apiKey =
    isQwenModel && process.env.QWEN_API
      ? process.env.QWEN_API
      : getOpenRouterApiKey();

  if (!apiKey) throw new Error("No OpenRouter or Qwen API Key found");

  const isReasoningModel =
    modelId.toLowerCase().includes("r1") ||
    modelId.toLowerCase().includes("reason") ||
    modelId.toLowerCase().includes("gpt-oss") ||
    modelId.toLowerCase().includes("deepseek") ||
    modelId.toLowerCase().includes("glm") ||
    modelId.toLowerCase().includes("ling-2.6");

  const shouldEnableReasoning =
    includeReasoning === true ||
    (includeReasoning !== false && isReasoningModel);

  const bodyPayload = {
    model: modelId,
    messages: messages,
    stream: stream,
    max_tokens: maxTokens,
  };

  if (shouldEnableReasoning || isReasoningModel) {
    bodyPayload.include_reasoning = true;
    bodyPayload.reasoning = { effort: "medium" };
  }

  if (tools) {
    bodyPayload.tools = tools;
  }

  console.log(
    `🤖 [OpenRouter] Executing model: "${modelId}" | Stream: ${stream} | Reasoning: ${shouldEnableReasoning} | Tools: ${tools?.map(t => t.type || t.function?.name).join(", ") || "none"}`,
  );

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.BACKEND_URL || "http://localhost:5500",
        "X-Title": "Notesify AI Assistant",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.warn(`❌ [OpenRouter] Model "${modelId}" returned ${response.status}:`, JSON.stringify(errorData));
    throw new Error(
      `OpenRouter returned ${response.status}: ${JSON.stringify(errorData)}`,
    );
  }

  //If streaming return the raw response body
  if (stream) {
    console.log(`✅ [OpenRouter] Stream connected successfully for model: "${modelId}"`);
    return response.body;
  }

  const data = await response.json();

  // OpenRouter sometimes returns 200 OK but embeds the error in the body.
  // Detect both the error object format and the "model output error" string pattern.
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (data.error) {
    console.warn(`❌ [OpenRouter] Model "${modelId}" error:`, data.error);
    throw new Error(
      `OpenRouter model error: ${data.error.message ?? JSON.stringify(data.error)}`,
    );
  }

  if (!content) throw new Error(`OpenRouter (${modelId}) returned no content`);

  // Detect inline error strings the model embeds in its output
  if (
    typeof content === "string" &&
    content.startsWith("Error") &&
    content.includes("model output error")
  ) {
    console.warn(`❌ [OpenRouter] Model "${modelId}" output error string detected`);
    throw new Error(
      `Model output error (${modelId}): ${content.slice(0, 300)}`,
    );
  }

  console.log(`✅ [OpenRouter] Successfully generated response via model: "${modelId}"`);
  return content;
};

const executeGemini = async (messages, stream = false) => {
  ensureAiApiKey();

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      let parts = [];
      if (typeof m.content === "string") {
        parts = [{ text: m.content }];
      } else if (Array.isArray(m.content)) {
        parts = m.content
          .map((part) => {
            if (part.type === "text") return { text: part.text };
            if (part.type === "image_url") {
              const base64Data = part.image_url.url.split(",")[1];
              const mimeType =
                part.image_url.url.split(";")[0].split(":")[1] || "image/jpeg";
              return {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              };
            }
            return null;
          })
          .filter(Boolean);
      }
      return { role: m.role === "assistant" ? "model" : "user", parts: parts };
    });

  const systemMessage = messages.find((m) => m.role === "system");
  const systemInstruction = systemMessage ? systemMessage.content : "";

  const geminiModel = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    ...(systemInstruction ? { systemInstruction } : {}),
  });

  console.log("🟦 Attempting Gemini (Fast Mode)...");

  if (stream) {
    const result = await geminiModel.generateContentStream({
      contents,
    });
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const content = chunk.text();
            if (content) {
              const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: content } }] })}\n\n`;
              controller.enqueue(encoder.encode(sseChunk));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  } else {
    const result = await geminiModel.generateContent({
      contents,
    });
    return result.response.text();
  }
};

export const executeGroq = async (
  messages,
  stream = false,
  modelName = null,
) => {
  ensureGroqApiKey();
  const selectedModel = modelName || FALLBACK_MODEL;

  console.log(`⚡ [Groq] Executing model: "${selectedModel}" | Stream: ${stream}`);

  if (stream) {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`❌ [Groq] Model "${selectedModel}" returned ${response.status}:`, JSON.stringify(errorData));
      throw new Error(
        `Groq returned ${response.status}: ${JSON.stringify(errorData)}`,
      );
    }

    console.log(`✅ [Groq] Stream connected successfully for model: "${selectedModel}"`);
    return response.body;
  }

  if (!client?.chat?.completions)
    throw new Error("Groq client not properly initialized");

  const response = await client.chat.completions.create({
    model: selectedModel,
    messages: messages,
  });
  console.log(`✅ [Groq] Successfully generated response via model: "${selectedModel}"`);
  return response.choices[0].message.content;
};

// Helper: prefer OpenRouter (ling) → Gemini → QWEN → GROQ
const generateContentWithFallback = async (prompt, stream = true) => {
  ensureAiApiKey();
  const message = [{ role: "user", content: prompt }];
  const errors = [];

  // 1) OpenRouter (preferred for `ling`)
  if (getOpenRouterApiKey()) {
    try {
      return await executeOpenRouter(NOTES_GENERATION_MODEL, message, stream);
    } catch (err) {
      errors.push(`${NOTES_GENERATION_MODEL} failed: ${err.message}`);
      console.warn(
        `⚠️ ${NOTES_GENERATION_MODEL} failed, trying fallback models:`,
        err.message,
      );
    }
  }

  // 2) Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await executeGemini(message, stream);
    } catch (err) {
      errors.push(`Gemini failed: ${err.message}`);
      console.warn("⚠️ Gemini failed, trying fallback models:", err.message);
    }
  }

  // 3) QWEN (via OpenRouter when QWEN_API is present)
  if (process.env.QWEN_API) {
    try {
      return await executeOpenRouter(VISUALIZATION_MODEL, message, stream);
    } catch (err) {
      errors.push(`${VISUALIZATION_MODEL}/OpenRouter failed: ${err.message}`);
      console.warn(
        `⚠️ ${VISUALIZATION_MODEL}/OpenRouter failed, trying fallback models:`,
        err.message,
      );
    }
  }

  // 4) GROQ / fallback
  if (process.env.GROQ_API_KEY) {
    try {
      return await executeGroq(message, stream);
    } catch (err) {
      errors.push(`Groq failed: ${err.message}`);
      console.warn("⚠️ Groq failed:", err.message);
    }
  }

  throw new Error(
    `No AI feature keys configured or all providers failed: ${errors.join(" | ")}`,
  );
};

// ROUTING & ORCHESTRATION

export const classifyChatIntent = (
  message = "",
  imageBase64 = null,
  history = [],
  noteContext = "",
  pdfContext = "",
  chatMode = "casual",
) => {
  const msg = message.toLowerCase();

  // 1. VISUAL CONVO (Strictly for current message with attached image)
  const hasAttachedImage = !!imageBase64;
  if (hasAttachedImage) return VISUALIZATION_MODEL;

  // Calculate total context size (history + note + pdf + active message)
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

  // 2. LARGE CONTEXT OVERRIDE (Safe fallback to DeepSeek when context exceeds 150,000 characters)
  if (totalContextLength > 150000) {
    console.log(
      `📦 Large context detected (${totalContextLength} characters). Overriding routing to use ${PRIMARY_MODEL} (DeepSeek).`,
    );
    return PRIMARY_MODEL;
  }

  // 3. DIAGRAMS / GRAPHS / CHARTS (Route text diagram requests to DeepSeek since it generates structural markdown/Mermaid best)
  const isDiagramOrGraph =
    /\b(diagram|chart|graph|flowchart|wireframe|mockup|screenshot|visualize|architecture|workflow|sequence diagram|erd|uml|mindmap|tree)\b/.test(
      msg,
    );
  if (isDiagramOrGraph) return PRIMARY_MODEL;

  // 4. TEACHING & STUDY MODE (Primary route when chatMode is 'study' or educational intent detected)
  const isTeachingKeyword =
    /\b(explain|teach|tutorial|how to|why does|concept|explain the difference|step by step|study help|tutor|what is|describe|example|problem|solve|understand|definition|guide|summary|lesson|learn)\b/.test(
      msg,
    );

  if (chatMode === "study" || isTeachingKeyword) {
    const isComplexTeaching =
      msg.length > 250 ||
      /\b(advanced|complex|architecture|algorithm|system|optimize|scale|theory|difference between|under the hood|internals|lifecycle|deep|derivation|proof|physics|chemistry|biology|calculus)\b/.test(
        msg,
      );
    const chosenModel = isComplexTeaching
      ? TEACHING_MODELS[0]
      : TEACHING_MODELS[1];
    console.log(
      `🎓 [Teaching Mode Active] Routing to Teaching Model: ${chosenModel}`,
    );
    return chosenModel;
  }

  // 5. COMPLEX_ANALYSIS / RING (High parameter complexity / precision focus)
  const isComplex =
    /\b(analyze|audit|evaluate|critique|proof|compare and contrast|contradiction|complex|debug|optimize|performance|algorithm|refactor|solve|derive|theorem|hypothesis|synthesis|mechanism|pathway|thesis|deconstruct|assess)\b/.test(
      msg,
    );
  if (isComplex) return COMPLEX_ANALYSIS_MODEL;

  // Default chat model
  return DEFAULT_CHAT_MODEL;
};

const getAiReply = async (
  message,
  imageBase64,
  systemPrompt,
  history,
  stream = false,
  useReasoning = false,
  tools = null,
  enableWeb = true,
  selectedModel = null,
) => {
  // Ensure history content is always text-only strings for safety
  const safeHistory = history.map((h) => ({
    role: h.role,
    content:
      typeof h.content === "string" ? h.content : JSON.stringify(h.content),
  }));

  const messages = [
    { role: "system", content: systemPrompt },
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
  ];

  // --- TIER 1: OPENROUTER (PRIMARY - DYNAMIC INTENT BASED) ---
  if (getOpenRouterApiKey()) {
    try {
      const isVisualConvo = !!imageBase64;

      const activeModel =
        selectedModel ||
        (isVisualConvo ? VISUALIZATION_MODEL : DEFAULT_CHAT_MODEL);
      console.log(`🔥 Attempting Primary Model: ${activeModel}`);

      // All three models support thinking/reasoning
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
        tools,
      );
      console.log(`✅ Chat answered by ${activeModel} (Tier 1)`);
      return reply;
    } catch (orError) {
      console.error("❌ TIER 1 (OpenRouter) FAILED:", orError.message);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      console.log(`Attempting Tier 2: OpenRouter (${PRIMARY_MODEL})`);
      const reply = await executeOpenRouter(
        PRIMARY_MODEL,
        messages,
        stream,
        useReasoning, // DeepSeek V4 supports reasoning
        5000,
        tools,
      );
      console.log(`Chat answered by ${PRIMARY_MODEL} (Tier 2)`);
      return reply;
    } catch (error) {
      console.warn("⚠️ TIER 2 (OpenRouter) FAILED:", error.message);
    }
  }

  let fallbackWebContext = "";
  if (enableWeb && mightNeedWeb(message)) {
    try {
      console.log(
        "🔍 Secondary failed or inactive. Executing Fallback Tool Pre-routing (Tavily/Jina)...",
      );
      const toolDecision = await detectTools(message);
      if (toolDecision.tool === "search_web") {
        const searchResults = await performWebSearch(toolDecision.query);
        fallbackWebContext = `\n--- FALLBACK WEB SEARCH RESULTS for "${toolDecision.query}" ---\n${searchResults}\n--- END RESULTS ---`;
      } else if (toolDecision.tool === "crawl_url") {
        const pageContent = await crawlUrl(toolDecision.query);
        fallbackWebContext = `\n--- FALLBACK URL CONTENT from ${toolDecision.query} ---\n${pageContent.slice(0, 6000)}\n--- END CONTENT ---`;
      }
    } catch (toolError) {
      console.warn("⚠️ Fallback tool execution failed:", toolError.message);
    }
  }

  let updatedSystemPrompt = systemPrompt;
  if (fallbackWebContext) {
    updatedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: The following are REAL-TIME FALLBACK WEB SEARCH RESULTS to answer the user's query:\n${fallbackWebContext}`;
  }

  // --- TIER 3: GROQ (TERTIARY FALLBACK) ---
  try {
    console.log("⚡ Attempting Tertiary: GROQ (Llama 70B)...");
    const groqMessages = [
      { role: "system", content: updatedSystemPrompt },
      ...safeHistory,
      {
        role: "user",
        content: imageBase64
          ? `[Image attached - Llama reading text only] ${message}`
          : message,
      },
    ];
    return await executeGroq(groqMessages, stream);
  } catch (groqError) {
    console.error("💀 ALL AI TIERS EXHAUSTED:", groqError.message);
  }

  // --- TIER 4: GEMINI FLASH (SECONDARY FALLBACK) ---
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("💎 Attempting Secondary: Gemini Flash...");
      const reply = await executeGemini(messages, stream);
      console.log("✅ Chat answered by Gemini Flash (Tier 2)");
      return reply;
    } catch (geminiError) {
      console.warn("⚠️ TIER 4 (Gemini) FAILED:", geminiError.message);
      throw new Error(
        "I'm having trouble connecting to my brain right now. Please try again in a moment.",
      );
    }
  }
};

// --- EXPORTED SERVICES ---

export const checkGrammar = async (text) => {
  const prompt = `You are a professional editor. Fix grammar, spelling, punctuation, and awkward phrasing while preserving meaning. Return only corrected text.\n\nText:\n${text}`;

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
    console.error("AI Service Error:", error.message);
    throw error;
  }
};

export const performWebSearch = async (query) => {
  try {
    if (!process.env.TAVILY_API) return "";
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API,
        query: query,
        include_answer: true,
        max_results: 3,
      }),
    });
    const data = await response.json();
    if (!data.results) return "No results found";

    // Use only the first user message + first assistant reply for clean, focused title generation.
    // Avoids noise from system prompts, tool calls, or image blobs that bloat the context.
    const firstUser = sessionToUpdate.messages.find((m) => m.role === "user");
    const firstAssistant = sessionToUpdate.messages.find(
      (m) => m.role === "assistant",
    );
    const titleContext = [
      firstUser ? `User: ${firstUser.content}` : "",
      firstAssistant ? `Assistant: ${firstAssistant.content}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return data.results
      .map((r) => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`)
      .join("\n\n");
  } catch (error) {
    console.error("Tavily Search Error:", error);
    return "Failed to search the web";
  }
};

export const crawlUrl = async (url) => {
  try {
    if (!process.env.JINA_API) return "";
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${process.env.JINA_API}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();
    return data.data?.content || data.content || "No content found.";
  } catch (error) {
    console.error("Jina Crawl Error", error);
    return "Failed to crawl URL.";
  }
};

export const mightNeedWeb = (message) => {
  const triggers = [
    // Explicit search intent
    "search",
    "look up",
    "find out",
    "check if",
    // Temporal signals that actually imply live data
    "current price",
    "current weather",
    "weather today",
    "right now",
    "as of today",
    "live score",
    "latest news",
    // Finance
    "stock price",
    "crypto price",
    "bitcoin",
    "exchange rate",
    "usd to",
    "inr to",
    "convert currency",

    // Explicit live data categories
    "breaking news",
    "who won",
    "match score",
    "election result",
    "is it raining",
    "forecast",

    // URL fetch
    "http://",
    "https://",
    "www.",
  ];
  const msg = message.toLowerCase();
  return triggers.some((t) => msg.includes(t));
};

export const detectTools = async (message) => {
  try {
    ensureGroqApiKey();
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a routing agent.

Use "search_web" when the answer requires information that changes over time
(prices, scores, current events, live data, recent releases) or when the user
explicitly wants to look something up. Do NOT use it for conceptual questions,
coding help, or explanations — even if they mention recent technologies.
Use "crawl_url" if the user provides a URL and wants it analyzed or summarized.
Otherwise use "none".

Return ONLY JSON:

{  
  "tool": "search_web" | "crawl_url" | "none",
  "query": "",
  "reason": ""
}`,
        },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Tool Detection Error:", error);
    return { tool: "none" };
  }
};

const OUTPUT_RULES = `
Output only the final markdown.
Do not include:
- planning notes
- self-correction commentary
- requirement checklists
- draft commentary
- unnecessary prefaces

Use code fences (\`\`\`language) for actual code, pseudocode, algorithms, plaintext examples, and terminal/console outputs (e.g. \`\`\`plaintext, \`\`\`pseudocode, \`\`\`terminal).
`;

// STRUCTURE MODE

const P_COMPREHENSIVE = `
Create a comprehensive, deeply structured study note.
Preserve important concepts, explanations, examples, reasoning, and critical details.
Use clear sections, subsections, tables, bullets, and concise explanatory breakdowns.
Balance deep understanding with revision-friendly readability.
`;

const P_REVISION_SHEET = `
Create a high-density revision sheet optimized for exam preparation and rapid recall.
Focus on key concepts, formulas, patterns, definitions, common mistakes, and memory triggers.
Keep explanations minimal and highly scannable.
`;

const P_CONCEPT_INTUITION = `
Explain the topic focusing heavily on analogies, why things work, and building strong mental models.
Prioritize deep conceptual intuition and understanding over rote memorization.
Perfect for complex technical, logical, or scientific topics (like DSA, math, physics, or system design).
`;

const P_INTERVIEW_PREP = `
Structure the note as an interview preparation guide.
Focus on common interview questions, edge cases, traps, patterns, tradeoffs, and concise explanations.
Perfect for computer science, logical, and engineering interviews.
`;

// STUDY DEPTHS

const P_DEPTH_QUICK = `
Keep the note highly concise and optimized for rapid reading and fast revision.
Focus exclusively on high-signal details: core concepts, key formulas, essential takeaways, and memory triggers.
Do not over-explain or write lengthy paragraphs. Keeping explanations extremely brief and direct.
`;

const P_DEPTH_STANDARD = `
Keep the note balanced, delivering an equal mix of core concept definitions, illustrative examples, and necessary supporting details.
Ensure clear readability while covering all critical aspects of the topic sufficiently.
`;

const P_DEPTH_DEEP = `
Provide complete coverage of important concepts.
Expand where depth improves understanding.
Avoid unnecessary repetition.
`;

// TONE MODES

const P_TECHNICAL_PRECISE = `
Use a technically precise and engineering-focused explanation style.
Emphasize logic, systems, correctness, tradeoffs, and accurate terminology.
Avoid unnecessary simplification.
`;

const P_BEGINNER_FRIENDLY = `
Explain concepts in beginner-friendly language.
Simplify difficult ideas while preserving accuracy.
Prioritize clarity, intuition, and approachability.
`;

const P_EXAM_ORIENTED = `
Optimize the note for exams and scoring.
Highlight important facts, likely questions, memory triggers, common pitfalls, and high-priority concepts.
Keep explanations efficient and revision-focused.
`;

const P_ACADEMIC = `
Use a formal, rigorous, and academic writing style.
Rely on clear logical prose, authoritative scientific explanations, and complete context.
`;

const P_SIMPLE_ANALOGY = `
Use a simple, highly approachable style packed with clear real-world analogies.
Prioritize everyday conceptual mappings to explain complex ideas.
`;

const P_QA_STYLE = `
Structure the output using clear, interactive, and logical question-and-answer pairs.
`;

// SHARED BEHAVIOR

const P_FAITHFULNESS = `
Stay faithful to the source.
Do not invent unsupported facts, formulas, examples, or details.
If the input is unclear, preserve the uncertainty instead of guessing.
`;

const P_COMPRESSION = `
Match the depth to the selected structure.
- Summaries should stay dense and concise.
- Revision sheets should be highly scannable.
- Comprehensive notes should include important detail and concise explanation.
Do not over-explain simple points.
`;

const P_ORDER = `
Prefer this learning flow when relevant:
1. Overview
2. Core concepts
3. Important details
4. Examples
5. Common mistakes
6. Quick revision points
`;

const P_BRIDGE = `
Apply the selected tone naturally to the selected structure.
Do not let tone weaken clarity or accuracy.
Do not let structure become unnecessarily rigid.
`;

const P_QUALITY = `
Prefer clarity over exhaustiveness.
Prefer structure over verbosity.
Prefer useful explanation over decorative wording.

Optimize for learning, recall, and revision rather than article-style writing.

When helpful:
- Use concise text diagrams for workflows, processes, hierarchies, algorithms, and system interactions.
- Use comparison tables for related concepts.
- Use mental models and intuitive explanations.
- Highlight common mistakes and exam/interview traps.
- End major topics with quick-recall summaries.

The output should feel like premium human-made study material optimized for learning and revision.
`;

const parsePromptParams = (text) => {
  const topicMatch = text.match(/Topic:\s*(.*)/i);
  const toneMatch = text.match(/Preferred Tone:\s*(.*)/i);
  const structureMatch = text.match(/Formatting Structure:\s*(.*)/i);
  const depthMatch = text.match(/Study Depth:\s*(.*)/i);

  const topic = topicMatch ? topicMatch[1].trim() : text;
  const tone = toneMatch ? toneMatch[1].trim() : "Academic";
  const structure = structureMatch
    ? structureMatch[1].trim()
    : "Detailed Structured Note";
  const depth = depthMatch ? depthMatch[1].trim() : "Standard";

  return { topic, tone, structure, depth };
};

const actionPrompts = {
  summarize: (text) => `
Summarize this note into concise, information-dense markdown bullets.
Preserve key concepts, facts, and action items.
Use hierarchical bullets only when useful.

${OUTPUT_RULES}

Note:
${text}
`,
  explain: (text) => `
Explain this note in beginner-friendly language using clear markdown structure.
Simplify difficult concepts while preserving technical accuracy.
Match explanation depth to the topic complexity.

${OUTPUT_RULES}

Note:
${text}
`,

  noteCreation: (text) => {
    const { topic, tone, structure, depth } = parsePromptParams(text);

    // Map structure to prompt
    let structurePrompt = P_COMPREHENSIVE;
    if (structure.includes("Revision Crash Sheet")) {
      structurePrompt = P_REVISION_SHEET;
    } else if (structure.includes("Concept + Intuition")) {
      structurePrompt = P_CONCEPT_INTUITION;
    } else if (structure.includes("Interview Prep")) {
      structurePrompt = P_INTERVIEW_PREP;
    } else if (structure.includes("Visual Learning")) {
      structurePrompt = P_VISUAL_LEARNING;
    }

    // Map tone to prompt
    let tonePrompt = P_ACADEMIC;
    if (tone.includes("Technical / Precise")) {
      tonePrompt = P_TECHNICAL_PRECISE;
    } else if (
      tone.includes("Simple / Analogy Rich") ||
      tone.includes("Simple / Analogy-Rich")
    ) {
      tonePrompt = P_SIMPLE_ANALOGY;
    } else if (tone.includes("Beginner-Friendly")) {
      tonePrompt = P_BEGINNER_FRIENDLY;
    } else if (tone.includes("Exam-Oriented")) {
      tonePrompt = P_EXAM_ORIENTED;
    } else if (tone.includes("Q&A Style")) {
      tonePrompt = P_QA_STYLE;
    }

    // Map depth to prompt
    let depthPrompt = P_DEPTH_STANDARD;
    if (depth === "Quick") {
      depthPrompt = P_DEPTH_QUICK;
    } else if (depth === "Deep Dive") {
      depthPrompt = P_DEPTH_DEEP;
    }

    return actionPrompts.writeNote(
      topic,
      structurePrompt,
      tonePrompt,
      depthPrompt,
    );
  },

  writeNote: (
    text,
    structurePrompt = P_COMPREHENSIVE,
    tonePrompt = P_ACADEMIC,
    depthPrompt = P_DEPTH_STANDARD,
  ) => `
Write a polished, revision-friendly study note from the provided content.

${structurePrompt}

${tonePrompt}

${depthPrompt}

${P_FAITHFULNESS}

${P_COMPRESSION}

${P_ORDER}

${P_BRIDGE}

${P_QUALITY}

Core Requirements:
- Preserve important concepts, definitions, formulas, examples, reasoning, and explanations.
- Improve clarity, organization, readability, and learning flow.
- Use clean markdown with headings, bullets, tables for comparison, and emphasis where useful.
- When a process, hierarchy, workflow, algorithm, or system interaction is described, prefer a concise text diagram over prose. Use visual structure whenever it improves recall.
- Add concise intuitive explanations only when they genuinely improve understanding.
- Highlight important ideas, patterns, misconceptions, and practical insights where relevant.

Avoid:
- filler,
- repetitive explanations,
- excessive storytelling,
- robotic phrasing,
- overexplaining simple concepts,
- hallucinating unsupported information.

${OUTPUT_RULES}

Content:
${text}
`,

  rewrite: (text) => `
Rewrite the text to improve clarity, grammar, and flow while preserving meaning and tone.

${OUTPUT_RULES}

Text:
${text}
`,
  continue: (text) => `
Continue the text naturally while matching its tone and structure.
Do not repeat or summarize previous content.

${OUTPUT_RULES}

Text:
${text}
`,
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
    const result = await generateContentWithFallback(
      promptBuilder(text),
      stream,
    );

    // If streaming, return the stream object directly
    if (stream) return result;

    let suggestion = result;
    // Clean up markdown code blocks if the AI ignored the instruction (only for static strings)
    if (suggestion.startsWith("```")) {
      suggestion = suggestion.replace(/^```[a-z]*\n?|```$/gi, "").trim();
    }

    return {
      action,
      suggestion,
      original: text,
      errors: [],
    };
  } catch (error) {
    console.error("AI Service Error:", error.message);
    throw error;
  }
};

export const chatWithAi = async ({
  message,
  history = [],
  summary = "",
  noteContext = "" || null,
  webContext = "",
  pdfContext = "",
  imageBase64 = null,
  stream = false,
  systemPrompt = "",
  useReasoning = false,
  enableWeb = true,
  chatMode = "study",
  tools = [],
}) => {
  ensureAiApiKey(); // Only requires Gemini or OpenRouter — Groq is a fallback, not a prerequisite

  let finalMessage = message;
  let finalImageBase64 = imageBase64;

  if (imageBase64?.startsWith("data:application/pdf")) {
    try {
      const base64Data = imageBase64.split(",")[1];
      const pdfBuffer = Buffer.from(base64Data, "base64");

      const parser = new PDFParse({ data: pdfBuffer });
      const pdfData = await parser.getText();
      const pdfText = pdfData.text.trim();
      pdfContext = pdfText;
      await parser.destroy();

      finalMessage = `[Attached PDF Document]\n${pdfText}\n\n${message || "Please review this document."}`;
      finalImageBase64 = null; // Clear it so it isn't treated as a vision image
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      throw new Error("Failed to read the attached PDF document.");
    }
  }

  if (!finalMessage?.trim() && !finalImageBase64) {
    throw new Error("Message or Image/PDF is required for AI assist");
  }

  // Summarize history every 20 messages after the first 20 (20, 40, 60...)
  if (history.length >= 40 && history.length % 40 === 0) {
    console.log(`📝 Summarizing conversation at ${history.length} messages...`);
    try {
      // Only summarize the middle part if it's huge, or just the whole thing if it's manageable
      // But let's at least ensure we don't send 100+ messages to the summarizer
      const summarizationInput =
        history.length > 40 ? history.slice(-40) : history;
      summary = await summarizeHistory(summarizationInput);
      history = history.slice(-10);
      console.log("📝 New summary generated");
    } catch (err) {
      console.error(
        "⚠️ Summarization failed, proceeding without new summary:",
        err.message,
      );
      // Don't crash the whole chat just because summarization failed
      history = history.slice(-20); // Trim anyway to keep context window safe
    }
  }

  const trimmedHistory = history.slice(-6);
  const safeWebContext = webContext?.slice(0, 10000);
  const safeNoteContext = noteContext?.slice(0, 8000);
  const safePdfContext = pdfContext?.slice(0, 5000);
  console.log(
    "🧠 Context: Web:",
    webContext?.length || 0,
    "Note:",
    noteContext?.length || 0,
    "PDF:",
    pdfContext?.length || 0,
  );

  const webBlock = safeWebContext
    ? [
        "IMPORTANT: The following are REAL-TIME WEB SEARCH RESULTS.",
        "Prioritize this information for current events, tech updates, and factual queries.",
        `\n--- WEB SEARCH RESULTS ---\n${safeWebContext}\n--- END WEB RESULTS ---`,
      ].join("\n")
    : null;

  const noteBlock = safeNoteContext
    ? [
        "IMPORTANT: The following is the content of the user's current note.",
        "Use this for context about what the user is working on.",
        `\n--- USER'S NOTE ---\n${safeNoteContext}\n--- END OF NOTE ---`,
      ].join("\n")
    : null;

  const pdfBlock = safePdfContext
    ? [
        "IMPORTANT: the following is the content of the user's attached pdf document.",
        "Use this for context about what the user is working on.",
        `\n---
        PDF TEXT:
        ${safePdfContext}
        \n--- END OF PDF`,
      ].join("\n")
    : null;

  const selectedModel = classifyChatIntent(
    finalMessage,
    finalImageBase64,
    trimmedHistory,
    safeNoteContext,
    safePdfContext,
    chatMode,
  );

  const isVisual = selectedModel === VISUALIZATION_MODEL;

  const basePrompt = isVisual
    ? QWEN_VISION_PROMPT
    : buildIrisPrompt({
        message: finalMessage,
        hasNote: !!safeNoteContext,
        hasWeb: !!safeWebContext,
        isVision: false,
        hasPdf: !!safePdfContext,
        enableWeb: enableWeb,
        chatMode: chatMode,
      });

  const combinedSystemPrompt = [
    basePrompt,
    systemPrompt,
    webBlock,
    noteBlock,
    pdfBlock,
    summary && `Conversation summary:\n${summary}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const finalTools = tools ? [...tools] : [];
  const needsWebTools = enableWeb || mightNeedWeb(finalMessage);
  if (needsWebTools) {
    finalTools.push(
      { type: "openrouter:web_search" },
      { type: "openrouter:web_fetch" },
    );
  }
  finalTools.push({
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Save a fact, preference, or goal about the user to their long-term memory. Only use this when the user explicitly asks you to remember something, or if they share an important, persistent fact about themselves. CRITICAL: Before calling this tool, you MUST write a short introductory conversational message (e.g. 'Got it! I will remember that.'). After calling the tool, DO NOT output any more text.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "PROFILE",
              "PREFERENCE",
              "GOAL",
              "PROJECT",
              "SKILL",
              "OTHER",
            ],
          },
          content: {
            type: "string",
            description: "The concise fact to remember",
          },
        },
        required: ["category", "content"],
      },
    },
  });

  const reply = await getAiReply(
    finalMessage,
    finalImageBase64,
    combinedSystemPrompt,
    trimmedHistory,
    stream,
    useReasoning,
    finalTools,
    enableWeb,
    selectedModel,
  );

  if (stream) {
    // Fallback models (Groq, NVIDIA) return a plain string — not a ReadableStream.
    // Wrap it so the controller's `for await (chunk of result)` loop works uniformly.
    let streamResponse = reply;
    if (typeof reply === "string") {
      const encoder = new TextEncoder();
      const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`;
      streamResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseChunk));
          controller.close();
        },
      });
    }

    return {
      stream: streamResponse,
      summary,
    };
  }

  const segments = parseIrisResponse(reply);

  return {
    toolUsed: null,
    reply,
    segments,
    summary, // Return the summary (old or new)
    pdfContext, // Include the extracted text so the frontend can "remember" it
    history: [
      ...trimmedHistory,
      {
        role: "user",
        content: finalImageBase64
          ? `[Attached Image]\n${message}`
          : finalMessage,
      },
      { role: "assistant", content: reply },
    ],
  };
};

export { generateTitle } from "./title.service.js";

export const getDynamicPrompts = async () => {
  try {
    const allPrompts = await Prompt.find({ isActive: true }).sort({
      priority: -1,
    });

    return {
      studentPrompts: allPrompts
        .filter((p) => p.category === "student")
        .map((p) => p.text),
      devPrompts: allPrompts
        .filter((p) => p.category === "developer")
        .map((p) => p.text),
    };
  } catch (error) {
    console.error("Failed to fetch prompts from DB, using fallback:", error);
    return { studentPrompts: [], devPrompts: [] };
  }
};

// PROMPT SECTIONS (each is a self-contained string)

const P_BASE = `
You are Iris, Notesify's AI assistant (built by Badal Sahani).
Today: ${new Date().toDateString()}.

# Core principles

- Never fabricate information.
- If you're uncertain, clearly distinguish between facts, assumptions, and speculation.
- Ask clarifying questions when missing information would materially affect the answer.
- Match the user's knowledge level.
- Be clear, direct, and intellectually honest.
- Remove unnecessary jargon and filler.
- Preserve exact values whenever possible and avoid unnecessary floating-point precision.

# Formatting

- Use Markdown only when it genuinely improves readability.
- Prefer the simplest presentation that communicates the answer clearly.
- Use \`inline code\` for code identifiers, filenames, paths, commands, variables, and functions.
- Use fenced code blocks for all code.
- Use \`\`\`text\`\`\` blocks only for reusable long-form writing (emails, README files, blog posts, resumes, documentation, cover letters, etc.).

# Response length

- Default to medium-length responses.
- Answer the user's question first.
- Expand only when:
  - the user asks for more detail,
  - the topic genuinely requires it,
  - or multiple options need comparison.

# Teaching

- Explain ideas progressively.
- Start simple, then add depth when useful.
- Avoid overwhelming the user with unnecessary details.

# Quiz generation

Call \`generate_quiz\` when:
- the user requests one,
- their understanding appears shaky,
- or after a substantial educational explanation.

Acknowledge the topic before calling the tool, then finish with encouragement.

# Tools

- Use web search for time-sensitive or factual information.
- If web search isn't available, say so.
- When citing web sources, use:
  [Source: domain.com](URL)

Finish with a Sources section if citations were used.
`;

const P_STUDY = `
# Study Mode

Your goal is to help the user genuinely understand the topic, not simply provide the answer.

Adapt explanations to the user's experience level.

For code:

- Explain line-by-line only for beginners or very small snippets.
- Explain larger code in logical blocks.
- Focus on intent, control flow, important decisions, and invariants.
- Explain beneath the code instead of creating Line | Explanation tables unless explicitly requested.

When appropriate:

- Use examples.
- Use analogies.
- Check for misconceptions.
- Gradually increase depth instead of front-loading everything.
`;

const P_CASUAL = `
# Casual Mode

This is a conversation, not a document.

Respond naturally, similar to ChatGPT.

Formatting:

- Prefer 2-5 short paragraphs.
- Avoid headings.
- Avoid numbered lists.
- Avoid bullet lists unless listing multiple items.
- Avoid tables unless directly comparing things.
- Use bold sparingly for emphasis only.
- Don't over-format responses.

Behavior:

- Don't automatically turn answers into guides or tutorials.
- Don't invent sections like:
  - Summary
  - Key Takeaways
  - Final Thoughts
  - Challenge
  - Action Plan
  unless the user explicitly asks for them.

- Don't explain more than the user asked.
- Keep the response conversational.
- If a short answer is sufficient, give a short answer.
- The amount of detail should naturally match the user's message.

Examples:

Short question → short answer.

Casual conversation → conversational reply.

Deep technical discussion → detailed explanation only when needed.
`;

const P_VIZ = `Use visualizations only when they genuinely help. Format: [IRIS_VIZ type="mermaid|chart|math" title="Title"]content[/IRIS_VIZ] — opening tag has NO slash, only closing does.
- mermaid: flowcharts, sequence diagrams, bar/line charts (use xychart-beta inside content — never put xychart-beta as the type attribute). When generating Mermaid diagrams, ALWAYS wrap node labels in double quotes to prevent syntax errors (e.g., A["Label Here"] instead of A[Label Here]).
- chart: JSON data for charts. math: LaTeX formulas.
- Bar chart example: [IRIS_VIZ type="mermaid" title="My Chart"]\nxychart-beta\n    title "My Chart"\n    x-axis ["A", "B", "C"]\n    y-axis "Count" 0 --> 10\n    bar [2, 5, 8]\n[/IRIS_VIZ]`;

const P_WEB_PROMPT = `Web Search Recommendation:
- If the user asks for latest news, documentation, or current/real-time information, and the Web Search tool is disabled, you MUST kindly and clearly ask the user to turn on the Web Search tool (using the toggle in the UI) so you can fetch up-to-date and accurate information to help them.
- If the user asks something new or you do not have sufficient information or ideas to answer, kindly ask the user to turn on the Web Search tool.`;

const buildIrisPrompt = ({
  message = "",
  enableWeb = false,
  chatMode = "study",
}) => {
  const msg = message.toLowerCase();

  const wantsViz = /diagram|flowchart|visualize|graph|chart|mermaid|plot/.test(
    msg,
  );

  const wantsWeb =
    !enableWeb &&
    (/latest|news|current|recent|docs|documentation|search|look up|google|weather|price|stock|update|today/i.test(
      msg,
    ) ||
      /who is|how to install|version of|what happened/i.test(msg));

  // Core capabilities based on mode
  const parts = [P_BASE, chatMode === "study" ? P_STUDY : P_CASUAL];

  if (wantsViz) parts.push(P_VIZ);
  if (wantsWeb) parts.push(P_WEB_PROMPT);

  return parts.join("\n\n");
};

// Legacy constant kept for the vision model path (short, no tool instructions needed)
const QWEN_VISION_PROMPT = `You are Iris, an intelligent educational AI assistant built into Notesify. Today: ${new Date().toDateString()}.

Be clear, structured, and helpful. Start with the direct answer. Use clean markdown formatting with headings, bullets, and emphasis.
Use \`\`\`code fences\`\`\` for code and $math$ for LaTeX.
Adapt your tone naturally — professional for academic content, conversational for casual questions.
Structure responses with --- dividers and bold headings for scannability.
IMPORTANT: Think silently. Only output the final answer — no internal reasoning or deliberation.`;
