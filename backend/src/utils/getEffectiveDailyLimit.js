/**
 * Returns a Date object representing 00:00:00.000 UTC for the given date (or now).
 * Ensures a single consistent boundary for daily quota resets across all timezones.
 */
export function getStartOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const TIER_LIMITS = {
  free: {
    tokenLimit: parseInt(process.env.AI_DAILY_TOKEN_LIMIT_FREE || process.env.AI_DAILY_TOKEN_LIMIT || "100000", 10),
    requestLimit: 30,
    maxConcurrent: 2,
  },
  pro: {
    tokenLimit: parseInt(process.env.AI_DAILY_TOKEN_LIMIT_PRO || "500000", 10),
    requestLimit: 100,
    maxConcurrent: 4,
  },
  enterprise: {
    tokenLimit: parseInt(process.env.AI_DAILY_TOKEN_LIMIT_ENTERPRISE || "2000000", 10),
    requestLimit: 300,
    maxConcurrent: 8,
  },
};

/**
 * Resolves the effective token and request limits for a user based on their subscription tier.
 */
export function getEffectiveDailyLimits(user) {
  if (user?.plan?.customTokenLimit && Number.isFinite(user.plan.customTokenLimit)) {
    return {
      tier: user?.plan?.tier || "custom",
      tokenLimit: user.plan.customTokenLimit,
      requestLimit: 100,
      maxConcurrent: 4,
    };
  }

  const tier = user?.plan?.tier || "free";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  return {
    tier,
    tokenLimit: limits.tokenLimit,
    requestLimit: limits.requestLimit,
    maxConcurrent: limits.maxConcurrent,
  };
}


/**
 * Backward-compatible helper returning the daily token limit.
 */
export default function getEffectiveDailyLimit(user) {
  return getEffectiveDailyLimits(user).tokenLimit;
}