import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import { sttConcurrencyLimiter, sttBurstLimiter } from "../middleware/aiRateLimit.middleware.js";
import { transcribe } from "../controllers/stt.controller.js";

const router = express.Router();

// Store uploaded audio in memory as Buffer for immediate dispatch to OpenRouter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
});

// Protect route so only authenticated and verified users can use the transcription service
router.use(authMiddleware);
router.use(verifiedMiddleware);

// POST /api/stt/transcribe
router.post(
  "/transcribe",
  sttConcurrencyLimiter,
  sttBurstLimiter,
  upload.single("audio"),
  transcribe
);

export default router;
