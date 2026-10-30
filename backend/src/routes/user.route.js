import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { getStats, updateProfile } from "../controllers/user.controller.js";
import {
  getMemories,
  removeAllMemories,
  removeMemory,
} from "../controllers/memory.controller.js";

const router = express.Router();

router.get("/stats", authMiddleware, getStats);
router.put("/profile", authMiddleware, updateProfile);

// Long-term AI memories ("what Iris remembers")
router.get("/memories", authMiddleware, getMemories);
router.delete("/memories", authMiddleware, removeAllMemories);
router.delete("/memories/:id", authMiddleware, removeMemory);

export default router;
