import mongoose from "mongoose";
import LearningTask from "../models/learningTask.model.js";

/**
 * Create one or multiple learning tasks for a user
 */
export const createTasks = async (userId, tasks, sourceSessionId = null) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("Tasks must be a non-empty array");
  }

  const documents = tasks.map((t) => ({
    user: userId,
    title: t.title,
    description: t.description || "",
    type: t.type || "practice_question",
    status: t.status || "pending",
    topic: t.topic || "General",
    difficulty: t.difficulty || "medium",
    sourceSessionId: sourceSessionId || t.sourceSessionId || null,
  }));

  return await LearningTask.insertMany(documents);
};

/**
 * Get all tasks for a user with optional filters
 */
export const getUserTasks = async (userId, filter = {}) => {
  const query = { user: userId };

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query.status = { $in: filter.status };
    } else {
      query.status = filter.status;
    }
  } else if (!filter.includeArchived) {
    query.status = { $ne: "archived" };
  }

  if (filter.topic && filter.topic !== "all") {
    query.topic = filter.topic;
  }

  const limit = Math.min(Number(filter.limit) || 50, 100);

  return await LearningTask.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Fetch active, non-stale tasks for context injection and live queue.
 * Default max age: 7 days. Excludes archived and skipped tasks.
 */
export const getActiveTasks = async (userId, limit = 10, maxDays = 7) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  return await LearningTask.find({
    user: userId,
    status: { $in: ["pending", "in_progress"] },
    updatedAt: { $gte: cutoffDate },
  })
    .sort({ status: -1, updatedAt: -1 }) // in_progress first, then recent pending
    .limit(limit)
    .lean();
};

/**
 * Resolve a task by MongoDB ObjectId, ordinal index ("task_1", "1"), or title
 */
export const resolveTask = async (userId, taskIdentifier) => {
  if (!taskIdentifier) return null;

  const strId = String(taskIdentifier).trim();

  // 1. Direct valid MongoDB ObjectId
  if (mongoose.isValidObjectId(strId)) {
    const task = await LearningTask.findOne({ _id: strId, user: userId });
    if (task) return task;
    // Try without user filter in case userId format differs
    const taskAny = await LearningTask.findById(strId);
    if (taskAny && String(taskAny.user) === String(userId)) return taskAny;
  }

  // 2. Ordinal number like "task_1", "task-1", "1", "task 1", "#1"
  const ordinalMatch = strId.match(/^(?:task[_\-\s]?)?#?(\d+)$/i);
  if (ordinalMatch) {
    const index = parseInt(ordinalMatch[1], 10) - 1;
    if (index >= 0) {
      // Priority A: Try pending/in_progress tasks
      const activeTasks = await getActiveTasks(userId, 30);
      if (activeTasks && activeTasks[index]) {
        const found = await LearningTask.findById(activeTasks[index]._id);
        if (found) return found;
      }

      // Priority B: Try all tasks for user sorted chronologically (task 1 is first created)
      const allUserTasks = await LearningTask.find({ user: userId })
        .sort({ createdAt: 1 })
        .limit(50);
      if (allUserTasks && allUserTasks[index]) {
        return allUserTasks[index];
      }

      // Priority C: Try with ObjectId casting
      if (mongoose.isValidObjectId(userId)) {
        const objIdTasks = await LearningTask.find({ user: new mongoose.Types.ObjectId(userId) })
          .sort({ createdAt: 1 })
          .limit(50);
        if (objIdTasks && objIdTasks[index]) {
          return objIdTasks[index];
        }
      }

      // Priority D: Fallback to the first available active task
      const firstActive = await LearningTask.findOne({
        user: userId,
        status: { $in: ["pending", "in_progress"] },
      }).sort({ createdAt: 1 });
      if (firstActive) return firstActive;

      // Priority E: Fallback to any user task
      const anyUserTask = await LearningTask.findOne({ user: userId }).sort({ updatedAt: -1 });
      if (anyUserTask) return anyUserTask;
    }
  }

  // 3. Fallback: fuzzy/case-insensitive title match on user's tasks
  const titleEscaped = strId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const taskByTitle = await LearningTask.findOne({
    user: userId,
    title: { $regex: titleEscaped, $options: "i" },
  }).sort({ updatedAt: -1 });

  if (taskByTitle) return taskByTitle;

  return null;
};

/**
 * Update the status of a specific task
 */
export const updateTaskStatus = async (userId, taskId, status) => {
  const validStatuses = ["pending", "in_progress", "completed", "skipped", "archived"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`);
  }

  const existingTask = await resolveTask(userId, taskId);
  if (!existingTask) {
    throw new Error(`Task "${taskId}" not found or unauthorized`);
  }

  existingTask.status = status;
  if (status === "completed") {
    existingTask.completedAt = new Date();
  } else if (status === "skipped") {
    existingTask.skippedAt = new Date();
  } else if (status === "archived") {
    existingTask.archivedAt = new Date();
  }

  await existingTask.save();
  return existingTask;
};

/**
 * Archive tasks (either specific taskIds or all completed/skipped tasks)
 */
export const archiveTasks = async (userId, taskIds = null) => {
  const query = { user: userId };
  if (Array.isArray(taskIds) && taskIds.length > 0) {
    query._id = { $in: taskIds };
  } else {
    query.status = { $in: ["completed", "skipped"] };
  }

  const result = await LearningTask.updateMany(query, {
    $set: {
      status: "archived",
      archivedAt: new Date(),
    },
  });

  return result;
};

/**
 * Query permanent learning history and analytics (completed + archived tasks)
 */
export const getLearningHistory = async (userId, options = {}) => {
  const query = {
    user: userId,
    status: { $in: ["completed", "archived"] },
  };

  if (options.topic && options.topic !== "all") {
    query.topic = options.topic;
  }

  const limit = Math.min(Number(options.limit) || 100, 500);

  return await LearningTask.find(query)
    .sort({ completedAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Delete a learning task
 */
export const deleteTask = async (userId, taskId) => {
  const existingTask = await resolveTask(userId, taskId);
  if (!existingTask) {
    throw new Error(`Task "${taskId}" not found or unauthorized`);
  }
  await LearningTask.deleteOne({ _id: existingTask._id });
  return existingTask;
};
