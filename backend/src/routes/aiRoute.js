import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import { aiConcurrencyLimiter, aiBurstLimiter } from "../middleware/aiRateLimit.middleware.js";
import {
  aiAssistController,
  chatWithAiController,
  getChatSessionController,
  getAllSessionsController,
  deleteChatSessionController,
  reportToolResultController,
  answerInteractionController,
  uploadChatAttachmentController,
} from "../controllers/ai.controller.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 40,
    fileSize: 20 * 1024 * 1024,
  },
});
router.use(authMiddleware);
router.use(verifiedMiddleware);

router.post("/assist", aiConcurrencyLimiter, aiBurstLimiter, aiAssistController);
router.post("/chat/attachments", upload.array("files", 40), uploadChatAttachmentController);
router.post("/chat", aiConcurrencyLimiter, aiBurstLimiter, chatWithAiController);
router.post("/interactions/:interactionId/answer", answerInteractionController);
router.post("/chat/tool-result", reportToolResultController);
router.get("/sessions", getAllSessionsController);
router.delete("/sessions/:sessionId", deleteChatSessionController);
router.get("/chat/session/:sessionId", getChatSessionController);

export default router;
