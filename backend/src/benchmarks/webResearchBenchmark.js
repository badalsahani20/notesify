import dotenv from 'dotenv';
dotenv.config();

import { getOpenRouterApiKey } from '../services/ai/config/aiModels.js';

const systemPrompt = `You are being benchmarked on your ability to research information from the live internet using the available web search and web fetch tools.
Your goal is NOT to answer from memory.
When the question requires current, changing, niche, or externally verifiable information, use the web tools.
You are allowed to:
- Search the web multiple times.
- Reformulate your search query when the first results are insufficient.
- Fetch pages from URLs returned by search.
- Cross-check information across multiple sources.
- Stop searching when you have enough reliable evidence.
- Do not perform unnecessary searches merely to increase the search count.
For every task:
1. Determine whether live web research is necessary.
2. If necessary, search for the information.
3. If search results are insufficient, perform additional searches with improved queries.
4. Fetch relevant source pages when useful.
5. Cross-check important claims when appropriate.
6. Produce a concise final answer.
7. Cite the sources you actually used.
Do not tell the user that you "cannot browse" if the web tools are available.`;

const MODELS = [
  "qwen/qwen3.7-flash",
  "z-ai/glm-5.3-flash",
  "inclusionai/ling-3.0-flash",
  "deepseek/deepseek-v4-flash-0731"
];

const TESTS = [
  {
    id: "Test 1",
    name: "Simple Current Fact",
    prompt: "What is the latest stable version of React as of today? Give me the release date and link to the official release information."
  },
  {
    id: "Test 2",
    name: "Multi-Source Research",
    prompt: "Compare the current pricing and context window of Qwen 3.7 Flash, Ling 3.0 Flash, and GLM 5.3 Flash on OpenRouter. Use current information and cite your sources."
  },
  {
    id: "Test 3",
    name: "Research Reasoning & Decision",
    prompt: "I'm deciding which model to use for Notesify's casual chat system. Research Qwen 3.7 Flash, GLM 5.3 Flash, and Ling 3.0 Flash using current information. Compare their conversational ability, context window, tool calling, web search capability, pricing, and latency where reliable data is available. Identify which one is the best fit for a conversational notes assistant. Do not rely solely on vendor claims; cross-check important claims."
  }
];

const openRouterTools = [
  {
    type: "openrouter:web_search",
    parameters: { engine: "exa" }
  },
  {
    type: "openrouter:web_fetch"
  }
];

async function callOpenRouterAgent(modelId, prompt, timeoutMs = 90000) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("No OpenRouter API Key configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:5500",
        "X-Title": "Notesify Web Research Benchmark",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        tools: openRouterTools,
        max_tokens: 4000
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${(timeoutMs/1000).toFixed(0)}s`);
    }
    throw err;
  }
}

async function runBenchmarkForModelAndTest(modelId, test) {
  const startedAt = Date.now();
  console.log(`⏳ Starting ${modelId} -> ${test.id}...`);
  const data = await callOpenRouterAgent(modelId, test.prompt);
  const completedAt = Date.now();
  const totalLatencyMs = completedAt - startedAt;

  const choice = data.choices?.[0];
  const message = choice?.message || {};
  const content = message.content || "";
  const annotations = message.annotations || [];

  const citations = annotations
    .filter(a => a.type === "url_citation" && a.url_citation?.url)
    .map(a => ({ title: a.url_citation.title, url: a.url_citation.url }));

  const fallbackUrls = Array.from(new Set(content.match(/https?:\/\/[^\s\)\>\]]+/g) || []));
  const uniqueUrls = Array.from(new Set([...citations.map(c => c.url), ...fallbackUrls]));

  const usage = data.usage || {};
  const toolDetails = usage.server_tool_use_details || {};

  const result = {
    status: "SUCCESS",
    model: modelId,
    testId: test.id,
    testName: test.name,
    totalLatencyMs,
    webSearchRequests: toolDetails.web_search_requests || 0,
    toolCallsExecuted: toolDetails.tool_calls_executed || 0,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0,
    costUsd: usage.cost || 0,
    citationsCount: uniqueUrls.length,
    citations: uniqueUrls,
    answerSnippet: content.slice(0, 350) + (content.length > 350 ? "..." : ""),
    fullAnswer: content
  };

  console.log(`✅ [${modelId}] ${test.id} in ${(totalLatencyMs / 1000).toFixed(1)}s | Searches: ${result.webSearchRequests} | Cost: $${result.costUsd.toFixed(5)}`);
  return result;
}

async function startBenchmark() {
  console.log("=========================================================");
  console.log("🔬 PARALLEL OPENROUTER AGENTIC WEB RESEARCH BENCHMARK");
  console.log("=========================================================\n");

  const tasks = [];

  for (const modelId of MODELS) {
    for (const test of TESTS) {
      tasks.push(
        runBenchmarkForModelAndTest(modelId, test).catch(err => ({
          status: "FAILED",
          model: modelId,
          testId: test.id,
          testName: test.name,
          error: err.message
        }))
      );
    }
  }

  const results = await Promise.all(tasks);

  console.log("\n=========================================================");
  console.log("📊 BENCHMARK COMPLETE - ALL PARALLEL RESULTS RECEIVED");
  console.log("=========================================================");
  console.log("BENCHMARK_REPORT_START");
  console.log(JSON.stringify(results, null, 2));
  console.log("BENCHMARK_REPORT_END");
}

startBenchmark().catch(console.error);
