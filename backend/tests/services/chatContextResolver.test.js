import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock external LLM summarizer
jest.unstable_mockModule("../../src/utils/summarizeHistory.js", () => ({
  summarizeHistory: jest.fn(),
}));

const { summarizeHistory } = await import("../../src/utils/summarizeHistory.js");
const {
  ChatContextResolver,
  getWatermarkThresholds,
  estimateMessageTokens,
  sanitizeMessageForSummary,
  getRecentHistoryWithinTokenBudget,
} = await import("../../src/services/ai/chatContextResolver.js");
const { default: GlobalChatSession } = await import("../../src/models/globalChatSession.model.js");

describe("ChatContextResolver & Watermark Compaction Engine", () => {
  let userId;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    userId = new mongoose.Types.ObjectId();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Watermark Thresholds Calculation", () => {
    it("returns safe defaults when no environment variables are set", () => {
      delete process.env.CHAT_HISTORY_HIGH_WATERMARK;
      delete process.env.CHAT_HISTORY_LOW_WATERMARK;

      const { highWatermark, lowWatermark, fallbackMaxTokens } = getWatermarkThresholds();
      expect(highWatermark).toBe(18000);
      expect(lowWatermark).toBe(10000);
      expect(fallbackMaxTokens).toBeGreaterThanOrEqual(12000);
    });

    it("respects valid environment overrides and clamps low watermark below high", () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "12000";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "7000";

      const { highWatermark, lowWatermark } = getWatermarkThresholds();
      expect(highWatermark).toBe(12000);
      expect(lowWatermark).toBe(7000);
    });

    it("clamps watermarks against safe model context budget", () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "70000"; // Exceeds 64k safe model context limit
      const { highWatermark } = getWatermarkThresholds();
      expect(highWatermark).toBeLessThanOrEqual(56500); // 64000 - 2500 - 5000
    });
  });

  describe("Message Token Estimation", () => {
    it("estimates short text and includes framing overhead", () => {
      const msg = { role: "user", content: "Hello world" };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(4);
    });

    it("handles non-string content and tool calls without crashing", () => {
      const msg = {
        role: "assistant",
        content: null,
        toolCalls: [{ tool: "get_note_content", args: { noteId: "123" } }],
      };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe("Role-Aware Tool Sanitization", () => {
    it("strips heavy embeddings and imageBase64 while preserving citations, errors, and IDs", () => {
      const heavyMessage = {
        role: "assistant",
        content: "Here is what I found",
        toolCalls: [
          {
            tool: "search_web",
            status: "success",
            args: { query: "Notesify AI architecture" },
            data: {
              citations: [{ title: "Doc", url: "https://example.com" }],
              imageBase64: "data:image/png;base64,AABBCCDDEEFFGGHHII",
            },
          },
          {
            tool: "recall_memory",
            status: "success",
            args: { query: "user preferences" },
            data: [
              { category: "PREFERENCE", content: "Prefers TypeScript" },
              { category: "FACT", content: "Building a note app" },
            ],
          },
          {
            tool: "get_note_content",
            status: "error",
            error: "Note not found",
            args: { noteId: "note-404" },
          },
        ],
      };

      const sanitized = sanitizeMessageForSummary(heavyMessage);
      expect(sanitized.role).toBe("assistant");
      expect(sanitized.content).toBe("Here is what I found");
      expect(sanitized.toolCalls).toHaveLength(3);

      // search_web
      expect(sanitized.toolCalls[0].query).toBe("Notesify AI architecture");
      expect(sanitized.toolCalls[0].citations).toHaveLength(1);
      expect(sanitized.toolCalls[0].data?.imageBase64).toBeUndefined();

      // recall_memory
      expect(sanitized.toolCalls[1].memories).toHaveLength(2);

      // get_note_content error
      expect(sanitized.toolCalls[2].error).toBe("Note not found");
      expect(sanitized.toolCalls[2].noteId).toBe("note-404");
    });
  });

  describe("Recent History Slicing by Token Budget", () => {
    it("always keeps at least the newest message even if it exceeds the budget", () => {
      const longMessage = { role: "user", content: "A".repeat(20000) };
      const { recentHistory, olderMessages } = getRecentHistoryWithinTokenBudget([longMessage], 100);

      expect(recentHistory).toHaveLength(1);
      expect(olderMessages).toHaveLength(0);
    });

    it("slices older messages when history exceeds budget", () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1} with repeated technical words and structure to fill tokens.`,
      }));

      const { recentHistory, olderMessages } = getRecentHistoryWithinTokenBudget(messages, 200);
      expect(recentHistory.length).toBeLessThan(messages.length);
      expect(olderMessages.length + recentHistory.length).toBe(messages.length);
      expect(recentHistory[recentHistory.length - 1].id).toBe("msg-20");
    });
  });

  describe("Context Resolution & Watermark Compaction Flow", () => {
    let resolver;

    beforeEach(() => {
      resolver = new ChatContextResolver();
    });

    it("reuses existing summary and skips compaction when below high watermark", async () => {
      const session = await GlobalChatSession.create({
        user: userId,
        summary: "Existing structured context: Working on authentication.",
        messages: [
          { id: "m1", seq: 1, role: "user", content: "Hi" },
          { id: "m2", seq: 2, role: "assistant", content: "Hello! How can I help?" },
        ],
      });

      const result = await resolver.resolve({
        user: { _id: userId },
        body: { message: "What is my project?" },
        sessionData: {
          history: session.messages,
          summary: session.summary,
          activeSession: session,
          isGlobalChat: true,
        },
      });

      expect(summarizeHistory).not.toHaveBeenCalled();
      expect(result.sessionSummary).toBe("Existing structured context: Working on authentication.");
      expect(result.effectiveHistory).toHaveLength(2);
    });

    it("triggers first compaction when history exceeds high watermark", async () => {
      // Force lower watermark for testing
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "500";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "200";

      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        id: `m-${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Detailed message turn ${i + 1}: ${"technical discussion ".repeat(15)}`,
      }));

      const session = await GlobalChatSession.create({
        user: userId,
        summary: "",
        lastSummarizedSeq: 0,
        messages: longHistory,
      });

      summarizeHistory.mockResolvedValue(
        "Current Goal: Implementing Iris compaction.\nDecisions: Use monotonic seq.\nTechnical State: chatContextResolver.js updated."
      );

      const result = await resolver.resolve({
        user: { _id: userId },
        body: { message: "Continue next step" },
        sessionData: {
          history: longHistory,
          summary: "",
          activeSession: session,
          isGlobalChat: true,
        },
      });

      expect(summarizeHistory).toHaveBeenCalledTimes(1);
      expect(result.sessionSummary).toContain("Current Goal: Implementing Iris compaction.");
      expect(result.effectiveHistory.length).toBeLessThan(longHistory.length);

      // Verify DB persistence
      const updatedSession = await GlobalChatSession.findById(session._id);
      expect(updatedSession.summary).toContain("Current Goal: Implementing Iris compaction.");
      expect(updatedSession.lastSummarizedSeq).toBeGreaterThan(0);
      expect(updatedSession.lastSummarizedMessageId).toBeTruthy();
    });

    it("performs delta-only compaction on subsequent rounds", async () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "500";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "200";

      // 10 older messages already summarized up to seq 10
      const existingSummary = "Current Goal: Notesify.\nDecisions: MongoDB.";
      const messages = Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turn ${i + 1}: ${"delta information ".repeat(15)}`,
      }));

      const session = await GlobalChatSession.create({
        user: userId,
        summary: existingSummary,
        lastSummarizedMessageId: "m-10",
        lastSummarizedSeq: 10,
        messages,
      });

      summarizeHistory.mockResolvedValue(
        "Current Goal: Notesify.\nDecisions: MongoDB, Redis.\nTechnical State: updated with deltas."
      );

      const result = await resolver.resolve({
        user: { _id: userId },
        body: { message: "Next delta test" },
        sessionData: {
          history: messages,
          summary: existingSummary,
          activeSession: session,
          isGlobalChat: true,
        },
      });

      expect(summarizeHistory).toHaveBeenCalledTimes(1);
      // Ensure only messages with seq > 10 were sent to summarizeHistory
      const passedDelta = summarizeHistory.mock.calls[0][0];
      for (const msg of passedDelta) {
        expect(msg.content).not.toContain("Turn 1:");
        expect(msg.content).not.toContain("Turn 10:");
      }
      expect(summarizeHistory.mock.calls[0][1]).toBe(existingSummary);

      expect(result.sessionSummary).toContain("Technical State: updated with deltas.");
    });

    it("resolves delta correctly when MESSAGE_CAP trimmed checkpoint ID from messages array", async () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "500";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "200";

      // Messages start at seq 150 (earlier messages including the checkpoint m-120 were pruned by MESSAGE_CAP)
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: `m-${i + 150}`,
        seq: i + 150,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turn ${i + 150}: ${"pruned array content ".repeat(15)}`,
      }));

      const session = await GlobalChatSession.create({
        user: userId,
        summary: "Context before cap",
        lastSummarizedMessageId: "m-120", // No longer in messages array!
        lastSummarizedSeq: 155, // Checkpoint cursor is known
        messages,
      });

      summarizeHistory.mockResolvedValue("Consolidated context after pruning");

      const result = await resolver.resolve({
        user: { _id: userId },
        body: { message: "Test cap trimming" },
        sessionData: {
          history: messages,
          summary: "Context before cap",
          activeSession: session,
          isGlobalChat: true,
        },
      });

      expect(summarizeHistory).toHaveBeenCalledTimes(1);
      const passedDelta = summarizeHistory.mock.calls[0][0];
      // All passed messages must have seq > 155
      for (const msg of passedDelta) {
        expect(msg.content).not.toContain("Turn 150:");
        expect(msg.content).not.toContain("Turn 155:");
      }
      expect(result.sessionSummary).toBe("Consolidated context after pruning");
    });

    it("falls back safely without dropping context or advancing checkpoint when extraction fails", async () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "500";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "200";

      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        id: `m-${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turn ${i + 1}: ${"failing summarization ".repeat(15)}`,
      }));

      const session = await GlobalChatSession.create({
        user: userId,
        summary: "Previous valid summary",
        lastSummarizedSeq: 2,
        lastSummarizedMessageId: "m-2",
        messages: longHistory,
      });

      // Summarizer throws or returns empty
      summarizeHistory.mockRejectedValue(new Error("LLM Rate limit / network error"));

      const result = await resolver.resolve({
        user: { _id: userId },
        body: { message: "Failing test" },
        sessionData: {
          history: longHistory,
          summary: "Previous valid summary",
          activeSession: session,
          isGlobalChat: true,
        },
      });

      // Retains previous summary
      expect(result.sessionSummary).toBe("Previous valid summary");
      // Fallback retains history within fallbackMaxTokens instead of throwing away context
      expect(result.effectiveHistory.length).toBeGreaterThan(0);

      // Checkpoint must NOT advance
      const untouchedSession = await GlobalChatSession.findById(session._id);
      expect(untouchedSession.lastSummarizedSeq).toBe(2);
      expect(untouchedSession.lastSummarizedMessageId).toBe("m-2");
    });

    it("enforces single-flight compaction locking on concurrent requests for the same session", async () => {
      process.env.CHAT_HISTORY_HIGH_WATERMARK = "500";
      process.env.CHAT_HISTORY_LOW_WATERMARK = "200";

      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        id: `m-${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turn ${i + 1}: ${"concurrent test ".repeat(15)}`,
      }));

      const session = await GlobalChatSession.create({
        user: userId,
        summary: "",
        lastSummarizedSeq: 0,
        messages: longHistory,
      });

      let resolveSummarizer;
      summarizeHistory.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSummarizer = resolve;
          })
      );

      // Fire two concurrent requests for the same session
      const promise1 = resolver.resolve({
        user: { _id: userId },
        body: { message: "Concurrent 1" },
        sessionData: {
          history: longHistory,
          summary: "",
          activeSession: session,
          isGlobalChat: true,
        },
      });

      const promise2 = resolver.resolve({
        user: { _id: userId },
        body: { message: "Concurrent 2" },
        sessionData: {
          history: longHistory,
          summary: "",
          activeSession: session,
          isGlobalChat: true,
        },
      });

      // Only one LLM call should be in flight
      expect(summarizeHistory).toHaveBeenCalledTimes(1);

      // Complete the in-flight compaction
      resolveSummarizer("Extracted context from single-flight compaction");

      const [res1, res2] = await Promise.all([promise1, promise2]);
      expect(res1.sessionSummary).toContain("Extracted context from single-flight compaction");
      expect(res2.sessionSummary).toContain("Extracted context from single-flight compaction");
      expect(summarizeHistory).toHaveBeenCalledTimes(1);
    });
  });
});
