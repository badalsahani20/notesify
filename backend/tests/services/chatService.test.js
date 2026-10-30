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
const { chatWithAi } = await import(
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
