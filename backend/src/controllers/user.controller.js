import Notes from "../models/notes.model.js";
import Memory from "../models/Memory.js";
import User from "../models/user.model.js";
import catchAsync from "../utils/catchAsync.js";
import getEffectiveDailyLimit, { getEffectiveDailyLimits, getStartOfUtcDay } from "../utils/getEffectiveDailyLimit.js";
    
export const getStats = catchAsync(async (req, res) => {
  const { user } = req;

  const notesCount = await Notes.countDocuments({ user: user._id });
  const memoriesCount = await Memory.countDocuments({ user: user._id });
  const startOfToday = getStartOfUtcDay();

  const isNewDay = !user?.aiUsage?.lastResetAt || user.aiUsage.lastResetAt < startOfToday;

  const aiCount = isNewDay ? 0 : (user?.aiUsage?.dailyCount || 0);
  const limits = getEffectiveDailyLimits(user);
  const tokensUsed = isNewDay ? 0 : (user?.aiUsage?.dailyTokens || 0);
  const tokensInput = isNewDay ? 0 : (user?.aiUsage?.dailyInputTokens || 0);
  const tokensOutput = isNewDay ? 0 : (user?.aiUsage?.dailyOutputTokens || 0);
  
  res.status(200).json({
    success: true,
    stats:{
      notesCount,
      memoriesCount,
      aiCount,
      limit: limits.tokenLimit,
      tokensUsed,
      tokensLimit: limits.tokenLimit,
      tokensInput,
      tokensOutput,
      tier: limits.tier,
      // User meta — already on req.user, no extra DB call needed
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      isVerified: user.isVerified,
      memberSince: user.createdAt,
    }
  })
})

export const updateProfile = catchAsync(async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Name is required" });
  }

  const trimmedName = name.trim().slice(0, 50);

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { name: trimmedName },
    { new: true }
  ).select("name email avatar provider isVerified");

  res.status(200).json({
    success: true,
    message: "Profile updated",
    user: {
      id: updated._id,
      name: updated.name,
      email: updated.email,
      avatar: updated.avatar,
      isVerified: updated.isVerified,
      provider: updated.provider,
    }
  });
});