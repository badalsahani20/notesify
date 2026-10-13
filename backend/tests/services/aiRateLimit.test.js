import { jest } from "@jest/globals";
import {
  aiConcurrencyLimiter,
  aiBurstLimiter,
} from "../../src/middleware/aiRateLimit.middleware.js";
import {
  getStartOfUtcDay,
  getEffectiveDailyLimits,
} from "../../src/utils/getEffectiveDailyLimit.js";
import {
  checkDailyQuota,
  recordAiUsage,
} from "../../src/controllers/ai.controller.js";
import User from "../../src/models/user.model.js";

describe("AI Rate Limiting & Quota Management", () => {
  describe("UTC Boundary & Limit Calculations", () => {
    it("should return clean 00:00:00.000 UTC regardless of input time", () => {
      const sampleDate = new Date("2026-10-13T15:45:30.123Z");
      const utcStart = getStartOfUtcDay(sampleDate);

      expect(utcStart.getUTCHours()).toBe(0);
      expect(utcStart.getUTCMinutes()).toBe(0);
      expect(utcStart.getUTCSeconds()).toBe(0);
      expect(utcStart.getUTCMilliseconds()).toBe(0);
      expect(utcStart.toISOString()).toBe("2026-10-13T00:00:00.000Z");
    });

    it("should default free tier users to 100,000 tokens", () => {
      const user = { plan: { tier: "free" } };
      const limits = getEffectiveDailyLimits(user);

      expect(limits.tier).toBe("free");
      expect(limits.tokenLimit).toBe(100000);
      expect(limits.maxConcurrent).toBe(2);
    });

    it("should provide 500,000 tokens for pro tier users", () => {
      const user = { plan: { tier: "pro" } };
      const limits = getEffectiveDailyLimits(user);

      expect(limits.tier).toBe("pro");
      expect(limits.tokenLimit).toBe(500000);
      expect(limits.maxConcurrent).toBe(4);
    });

    it("should prioritize customTokenLimit over tier defaults", () => {
      const user = { plan: { tier: "free", customTokenLimit: 250000 } };
      const limits = getEffectiveDailyLimits(user);

      expect(limits.tokenLimit).toBe(250000);
    });
  });

  describe("Concurrency Limiter Middleware", () => {
    it("should allow up to 2 concurrent requests and reject the 3rd", () => {
      const userId = "user_concurrent_test_1";
      const req1 = { user: { _id: userId }, on: jest.fn() };
      const req2 = { user: { _id: userId }, on: jest.fn() };
      const req3 = { user: { _id: userId }, on: jest.fn() };

      const res1 = { on: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const res2 = { on: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const res3 = { on: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };

      const next1 = jest.fn();
      const next2 = jest.fn();
      const next3 = jest.fn();

      aiConcurrencyLimiter(req1, res1, next1);
      aiConcurrencyLimiter(req2, res2, next2);
      aiConcurrencyLimiter(req3, res3, next3);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
      expect(next3).not.toHaveBeenCalled();
      expect(res3.status).toHaveBeenCalledWith(429);
      expect(res3.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "AI_CONCURRENCY_LIMIT_EXCEEDED",
        })
      );

      // Simulate res1 finishing
      const finishCallback = res1.on.mock.calls.find((call) => call[0] === "finish")[1];
      finishCallback();

      // Now a 4th request should be allowed since one slot opened up
      const req4 = { user: { _id: userId }, on: jest.fn() };
      const res4 = { on: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next4 = jest.fn();

      aiConcurrencyLimiter(req4, res4, next4);
      expect(next4).toHaveBeenCalled();

      // Clean up remaining open slots
      const finish2 = res2.on.mock.calls.find((call) => call[0] === "finish")[1];
      finish2();
      const finish4 = res4.on.mock.calls.find((call) => call[0] === "finish")[1];
      finish4();
    });
  });

  describe("Database Quota & Token Recording", () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: `rate-limit-test-${Date.now()}@example.com`,
        provider: "google",
        plan: { tier: "free" },
        aiUsage: {
          dailyCount: 0,
          dailyTokens: 0,
          dailyInputTokens: 0,
          dailyOutputTokens: 0,
          lastResetAt: new Date(),
        },
      });
    });

    afterEach(async () => {
      if (testUser?._id) {
        await User.deleteOne({ _id: testUser._id });
      }
    });

    it("should allow usage when tokens are below the limit", async () => {
      const quota = await checkDailyQuota(testUser._id);
      expect(quota.allowed).toBe(true);
      expect(quota.used).toBe(0);
      expect(quota.limit).toBe(100000);
    });

    it("should atomically record token usage and model breakdown", async () => {
      await recordAiUsage(testUser._id, {
        model: "deepseek/chat",
        promptTokens: 1200,
        completionTokens: 350,
        totalTokens: 1550,
      });

      const updated = await User.findById(testUser._id);
      expect(updated.aiUsage.dailyTokens).toBe(1550);
      expect(updated.aiUsage.dailyInputTokens).toBe(1200);
      expect(updated.aiUsage.dailyOutputTokens).toBe(350);
      expect(updated.aiUsage.dailyCount).toBe(1);

      const modelStats = updated.aiUsage.modelBreakdown.get("deepseek/chat");
      expect(modelStats).toBeDefined();
      expect(modelStats.totalTokens).toBe(1550);
    });

    it("should reject with AI_TOKEN_LIMIT_EXCEEDED when daily tokens reach or exceed limit", async () => {
      testUser.aiUsage.dailyTokens = 100050;
      await testUser.save();

      const quota = await checkDailyQuota(testUser._id);
      expect(quota.allowed).toBe(false);
      expect(quota.code).toBe("AI_TOKEN_LIMIT_EXCEEDED");
      expect(quota.used).toBe(100050);
    });

    it("should reset effective tokens if lastResetAt was yesterday", async () => {
      const yesterday = new Date(Date.now() - 25 * 3600 * 1000);
      testUser.aiUsage.dailyTokens = 120000;
      testUser.aiUsage.lastResetAt = yesterday;
      await testUser.save();

      const quota = await checkDailyQuota(testUser._id);
      expect(quota.allowed).toBe(true);
      expect(quota.used).toBe(0);
    });
  });
});
