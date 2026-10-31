import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/services/ai/transport/openRouterClient.js", () => ({
  executeOpenRouter: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/ai/transport/groqClient.js", () => ({
  executeGroq: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/ai/transport/geminiClient.js", () => ({
  executeGemini: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/ai/config/aiModels.js", () => ({
  PRIMARY_MODEL: "test/primary-model",
  TEACHING_MODELS: ["test/teaching-model"],
  DEFAULT_CHAT_MODEL: "test/default-chat-model",
  COMPLEX_ANALYSIS_MODEL: "test/complex-model",
  GROQ_CHEAP_MODEL: "test/groq-cheap",
  GROQ_STRONG_MODEL: "test/groq-strong",
  QUICK_MODEL: "test/quick-model",
  GRAMMAR_MODEL: "test/grammar-model",
  getOpenRouterApiKey: jest.fn(() => "test-api-key"),
}));

const { executeOpenRouter } = await import(
  "../../src/services/ai/transport/openRouterClient.js"
);
const { chatWithAi, getTemporalContext } = await import(
  "../../src/services/ai/chatService.js"
);

describe("chatService - chatWithAi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not throw ReferenceError for shouldOfferLocalTools or openRouterWebTools", async () => {
    executeOpenRouter.mockResolvedValue("Hello! I am Iris.");

    const testTools = [
      {
        type: "function",
        function: {
          name: "ask_question",
          description: "Test question tool",
          parameters: { type: "object", properties: {} },
        },
      },
    ];

    const result = await chatWithAi({
      message: "Hello world",
      history: [],
      tools: testTools,
      enableWeb: true,
      stream: false,
    });

    expect(result.reply).toBe("Hello! I am Iris.");
    expect(executeOpenRouter).toHaveBeenCalledTimes(1);

    // Verify tools were passed correctly to executeOpenRouter
    const passedTools = executeOpenRouter.mock.calls[0][5];
    expect(Array.isArray(passedTools)).toBe(true);
    expect(passedTools.some((t) => t.function?.name === "ask_question")).toBe(true);
    expect(passedTools.some((t) => t.type === "openrouter:web_search")).toBe(true);
  });

  it("should handle null or empty tools cleanly", async () => {
    executeOpenRouter.mockResolvedValue("No tools answer");

    const result = await chatWithAi({
      message: "Just chatting",
      history: [],
      tools: null,
      enableWeb: false,
      stream: false,
    });

    expect(result.reply).toBe("No tools answer");
    expect(executeOpenRouter).toHaveBeenCalledTimes(1);
    const passedTools = executeOpenRouter.mock.calls[0][5];
    expect(passedTools).toBeNull();
  });

  it("should configure minimal effort for fast mode, medium for thinking, and high for pro", async () => {
    executeOpenRouter.mockResolvedValue("Tier response");

    // Fast mode -> minimal effort
    await chatWithAi({
      message: "Fast question",
      modelTier: "fast",
      enableWeb: false,
      stream: false,
    });
    expect(executeOpenRouter).toHaveBeenLastCalledWith(
      "test/default-chat-model",
      expect.any(Array),
      false,
      "minimal",
      5000,
      null,
      null
    );

    // Thinking mode -> medium effort
    await chatWithAi({
      message: "Thinking question",
      modelTier: "thinking",
      enableWeb: false,
      stream: false,
    });
    expect(executeOpenRouter).toHaveBeenLastCalledWith(
      "test/default-chat-model",
      expect.any(Array),
      false,
      "medium",
      5000,
      null,
      null
    );

    // Pro mode -> high effort
    await chatWithAi({
      message: "Pro question",
      modelTier: "pro",
      enableWeb: false,
      stream: false,
    });
    expect(executeOpenRouter).toHaveBeenLastCalledWith(
      "test/default-chat-model",
      expect.any(Array),
      false,
      "high",
      5000,
      null,
      null
    );
  });

  it("should fallback to Qwen (QUICK_MODEL) when default chat model fails", async () => {
    executeOpenRouter
      .mockRejectedValueOnce(new Error("Default model unavailable"))
      .mockResolvedValueOnce("Qwen fallback response");

    const result = await chatWithAi({
      message: "Hello fallback",
      stream: false,
    });

    expect(result.reply).toBe("Qwen fallback response");
    expect(result.model).toBe("test/quick-model");
    expect(executeOpenRouter).toHaveBeenCalledTimes(2);
    expect(executeOpenRouter.mock.calls[0][0]).toBe("test/default-chat-model");
    expect(executeOpenRouter.mock.calls[1][0]).toBe("test/quick-model");
  });
});

describe("chatService - web tool assembly", () => {
  const originalEnv = { ...process.env };

  const localTools = [
    {
      type: "function",
      function: {
        name: "search_web",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "crawl_url",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  const passedTools = () => executeOpenRouter.mock.calls.at(-1)[5];

  beforeEach(() => {
    jest.clearAllMocks();
    executeOpenRouter.mockResolvedValue("ok");
    delete process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    delete process.env.PARALLEL_API_KEY;
    delete process.env.SEARCH_PROVIDER;
    delete process.env.WEB_FETCH_PROVIDER;
  });

  afterAll(() => {
    for (const key of [
      "EXA_API_KEY",
      "EXA_API_KEY",
      "PARALLEL_API_KEY",
      "SEARCH_PROVIDER",
      "WEB_FETCH_PROVIDER",
    ]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("drops openrouter:web_fetch when native crawl_url is active", async () => {
    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: true,
      stream: false,
    });

    const tools = passedTools();
    expect(tools.some((t) => t.function?.name === "crawl_url")).toBe(true);
    expect(tools.some((t) => t.type === "openrouter:web_fetch")).toBe(false);
    expect(tools.some((t) => t.type === "openrouter:web_search")).toBe(true);
  });

  it("keeps openrouter:web_fetch when WEB_FETCH_PROVIDER=openrouter", async () => {
    process.env.WEB_FETCH_PROVIDER = "openrouter";

    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: true,
      stream: false,
    });

    expect(
      passedTools().some((t) => t.type === "openrouter:web_fetch"),
    ).toBe(true);
  });

  it("uses the local search adapter instead of openrouter:web_search when configured", async () => {
    process.env.EXA_API_KEY = "exa-key";

    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: true,
      stream: false,
    });

    const tools = passedTools();
    expect(tools.some((t) => t.function?.name === "search_web")).toBe(true);
    expect(tools.some((t) => t.type === "openrouter:web_search")).toBe(false);
  });

  it("re-arms openrouter:web_search when the adapter came back empty", async () => {
    process.env.EXA_API_KEY = "exa-key";

    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: true,
      providerWebFallback: true,
      stream: false,
    });

    const tools = passedTools();
    expect(tools.some((t) => t.type === "openrouter:web_search")).toBe(true);
    // Exactly one search tool per round.
    expect(tools.some((t) => t.function?.name === "search_web")).toBe(false);
  });

  it("removes local web tools when web search is disabled", async () => {
    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: false,
      stream: false,
    });

    expect(passedTools()).toBeNull();
  });

  it("tags the last function tool as the cache breakpoint", async () => {
    await chatWithAi({
      message: "hello",
      tools: localTools,
      enableWeb: true,
      stream: false,
    });

    const tools = passedTools();
    const tagged = tools.filter((t) => t.cache_control);

    expect(tagged).toHaveLength(1);
    // crawl_url is the last local tool; provider tools must stay untouched.
    expect(tagged[0].function.name).toBe("crawl_url");
    expect(
      tools.some((t) => t.type?.startsWith("openrouter:") && t.cache_control),
    ).toBe(false);
  });
});

describe("chatService - temporal context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeOpenRouter.mockResolvedValue("temporal ok");
  });

  it("formats current date and timezone in getTemporalContext", () => {
    const context = getTemporalContext("Asia/Kolkata");
    expect(context).toContain("## Temporal Anchor");
    expect(context).toContain("Today's date:");
    expect(context).toContain("Asia/Kolkata");
    expect(context).toContain("reference for the current year and relative dates");
    // Verifies YYYY-MM-DD pattern
    expect(context).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("injects temporalContext directly into the cached system prompt", async () => {
    await chatWithAi({
      message: "What is today's date?",
      enableWeb: false,
      stream: false,
    });

    expect(executeOpenRouter).toHaveBeenCalledTimes(1);
    const messages = executeOpenRouter.mock.calls[0][1];

    // Message 0 is the cached system prompt containing the constitution AND the temporal anchor
    expect(messages[0].role).toBe("system");
    expect(messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(messages[0].content[0].text).toContain("## Temporal Anchor");
    expect(messages[0].content[0].text).toContain("Today's date:");
    expect(messages[0].content[0].text).toContain("Asia/Kolkata");
  });
});
