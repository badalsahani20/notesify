import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import {
  aiAssistController,
  chatWithAiController,
  checkGrammarController,
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

router.post("/check-note/:noteId", checkGrammarController);
router.post("/assist", aiAssistController);
router.post("/chat/attachments", upload.array("files", 40), uploadChatAttachmentController);
router.post("/chat", chatWithAiController);
router.post("/interactions/:interactionId/answer", answerInteractionController);
router.post("/chat/tool-result", reportToolResultController);
router.get("/sessions", getAllSessionsController);
router.delete("/sessions/:sessionId", deleteChatSessionController);
router.get("/chat/session/:sessionId", getChatSessionController);

export default router;
