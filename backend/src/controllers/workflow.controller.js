import catchAsync from "../utils/catchAsync.js";
import workflowService, { createWorkflow } from "../services/ai/workflow/index.js";

export const createWorkflowController = catchAsync(async (req, res) => {
    const { title, phases, sessionId = null } = req.body;

    if(!title || !title.trim()) {
        return res.status(400).json({
            message: "Workflow title is required",
        });
    };

    if(!Array.isArray(phases) || phases.length === 0) {
        return res.status(400).json({
            message: "Workflow phases are required.",
        });
    }

    const workflow = createWorkflow({
        title: title.trim(),
        phases,
        userId: req.user._id,
        sessionId,
    });

    const created = await workflowService.create(workflow);

    return res.status(201).json({
        success: true,
        workflow: created,
    });
})

export const getWorkflowsController = catchAsync(async (req, res) => {
    const workflows = await workflowService.listByUser(req.user._id);

    return res.status(200).json({
        success: true,
        workflows,
    });
});

export const getWorkflowController = catchAsync(async (req, res) => {
    const workflow = await workflowService.getById(
        req.params.id,
        req.user._id,
    );

    return res.status(200).json({
        success: true,
        workflow,
    });
});

export const transitionWorkflowController = catchAsync(
    async (req, res) => {
        const {
            command,
            payload = {},
            expectedVersion,
        } = req.body;

        if (!command) {
            return res.status(400).json({
                message: "Workflow command is required.",
            });
        }

        if (expectedVersion === undefined) {
            return res.status(400).json({
                message: "Workflow version is required.",
            });
        }

        const workflow = await workflowService.execute({
            workflowId: req.params.id,
            userId: req.user._id,
            command,
            payload,
            expectedVersion,
        });

        return res.status(200).json({
            success: true,
            workflow,
        });
    },
);
    