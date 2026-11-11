import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../src/models/user.model.js";
import { getEffectiveDailyLimits } from "../src/utils/getEffectiveDailyLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function upgrade() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DB_URI;
    if (!mongoUri) {
      throw new Error("Neither MONGO_URI nor DB_URI is set in backend/.env");
    }

    await mongoose.connect(mongoUri);

    const args = process.argv.slice(2);
    const email = args[0];
    const targetTier = (args[1] || "pro").toLowerCase();

    if (!email) {
      console.log("\nUsage: node scripts/upgrade-user.js <email> [tier: pro|enterprise|free]\n");
      console.log("Recent users in database:");
      const users = await User.find({}).sort({ updatedAt: -1 }).limit(5).select("name email plan aiUsage");
      users.forEach((u) => {
        const limits = getEffectiveDailyLimits(u);
        console.log(`- ${u.email} | Tier: ${limits.tier} | Limit: ${limits.tokenLimit.toLocaleString()} tokens | Used today: ${(u.aiUsage?.dailyTokens || 0).toLocaleString()}`);
      });
      process.exit(0);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.error(`\n❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    user.plan = {
      tier: targetTier,
      status: "active",
      currentPeriodEnd: null,
      customTokenLimit: targetTier === "pro" || targetTier === "enterprise" || targetTier === "free" ? null : parseInt(targetTier, 10) || null,
    };

    // Reset today's token counter so user can chat immediately
    if (user.aiUsage) {
      user.aiUsage.dailyTokens = 0;
      user.aiUsage.dailyCount = 0;
      user.aiUsage.dailyInputTokens = 0;
      user.aiUsage.dailyOutputTokens = 0;
    }

    await user.save();

    const limits = getEffectiveDailyLimits(user);
    console.log(`\n✅ Successfully updated ${user.email}:`);
    console.log(`   Tier: ${limits.tier.toUpperCase()}`);
    console.log(`   Token Limit: ${limits.tokenLimit.toLocaleString()} tokens / day`);
    console.log(`   Daily usage reset to: 0 tokens`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to upgrade user:", err.message);
    process.exit(1);
  }
}

upgrade();

