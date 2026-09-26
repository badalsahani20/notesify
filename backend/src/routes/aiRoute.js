import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import {
  aiAssistController,
  chatWithAiController,
  checkGrammarController,
  getChatSessionController,
  getAllSessionsController,
  reportToolResultController,
  answerInteractionController,
} from "../controllers/ai.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.use(verifiedMiddleware);

router.post("/check-note/:noteId", checkGrammarController);
router.post("/assist", aiAssistController);
router.post("/chat", chatWithAiController);
router.post("/interactions/:interactionId/answer", answerInteractionController);
router.post("/chat/tool-result", reportToolResultController);
router.get("/sessions", getAllSessionsController);
router.get("/chat/session/:sessionId", getChatSessionController);

export default router;
