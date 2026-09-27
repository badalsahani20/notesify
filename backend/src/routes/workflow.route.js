import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";

import {
    createWorkflowController,
    getWorkflowsController,
    getWorkflowController,
    transitionWorkflowController,
} from "../controllers/workflow.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(verifiedMiddleware);

router.post("/", createWorkflowController);
router.get("/", getWorkflowsController);
router.get("/:id", getWorkflowController);
router.post("/:id/transition", transitionWorkflowController);

export default router;