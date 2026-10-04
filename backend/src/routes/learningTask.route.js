import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import {
  getTasks,
  createTasks,
  updateTaskStatus,
  archiveTasks,
  getLearningHistory,
  deleteTask,
} from "../controllers/learningTask.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(verifiedMiddleware);

router.get("/", getTasks);
router.get("/history", getLearningHistory);
router.post("/", createTasks);
router.post("/archive", archiveTasks);
router.patch("/:taskId/status", updateTaskStatus);
router.delete("/:taskId", deleteTask);

export default router;
