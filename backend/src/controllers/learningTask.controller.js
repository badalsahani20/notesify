import * as LearningTaskService from "../services/learningTask.service.js";
import catchAsync from "../utils/catchAsync.js";

export const getTasks = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { status, topic, limit, activeOnly } = req.query;

  let tasks;
  if (activeOnly === "true") {
    tasks = await LearningTaskService.getActiveTasks(userId, Number(limit) || 10);
  } else {
    tasks = await LearningTaskService.getUserTasks(userId, { status, topic, limit });
  }

  res.status(200).json({
    success: true,
    count: tasks.length,
    tasks,
  });
});

export const createTasks = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { tasks, sourceSessionId } = req.body;

  const taskList = Array.isArray(tasks) ? tasks : [req.body];
  const created = await LearningTaskService.createTasks(userId, taskList, sourceSessionId);

  res.status(201).json({
    success: true,
    message: `${created.length} task(s) created successfully`,
    tasks: created,
  });
});

export const updateTaskStatus = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { taskId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  const updated = await LearningTaskService.updateTaskStatus(userId, taskId, status);

  res.status(200).json({
    success: true,
    message: "Task status updated",
    task: updated,
  });
});

export const archiveTasks = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { taskIds } = req.body;

  const result = await LearningTaskService.archiveTasks(userId, taskIds);

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} task(s) archived successfully`,
    modifiedCount: result.modifiedCount,
  });
});

export const getLearningHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { topic, limit } = req.query;

  const history = await LearningTaskService.getLearningHistory(userId, { topic, limit });

  res.status(200).json({
    success: true,
    count: history.length,
    tasks: history,
  });
});

export const deleteTask = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { taskId } = req.params;

  await LearningTaskService.deleteTask(userId, taskId);

  res.status(200).json({
    success: true,
    message: "Task deleted successfully",
  });
});
