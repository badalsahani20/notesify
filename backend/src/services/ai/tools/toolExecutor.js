import { getNoteContentForUser } from "../../notes.service.js";
import { updateTaskStatus, createTasks } from "../../learningTask.service.js";

export class ToolExecutor {
  async execute({
    toolName,
    args,
    userId,
    fallbackNoteId = null,
  }) {
    if (toolName === "get_note_content") {
      const noteId = args?.noteId || fallbackNoteId;
      if (!noteId) {
        return { error: "Missing noteId for get_note_content." };
      }
      try {
        const note = await getNoteContentForUser(noteId, userId);
        if (!note) {
          return { error: `Note "${noteId}" not found or unauthorized.` };
        }
        return note;
      } catch (err) {
        return { error: `Failed to fetch note: ${err.message}` };
      }
    }

    if (toolName === "update_task_status") {
      const { taskId, status } = args || {};
      if (!taskId || !status) {
        return { error: "Missing taskId or status for update_task_status." };
      }
      try {
        const task = await updateTaskStatus(userId, taskId, status);
        return {
          success: true,
          message: `Task "${task.title}" marked as "${status}"`,
          task,
        };
      } catch (err) {
        return { error: `Failed to update task: ${err.message}` };
      }
    }

    if (toolName === "create_learning_tasks") {
      const { tasks } = args || {};
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return { error: "Missing or invalid tasks array for create_learning_tasks." };
      }
      try {
        const createdTasks = await createTasks(userId, tasks);
        return {
          success: true,
          message: `Created ${createdTasks.length} learning tasks`,
          tasks: createdTasks,
        };
      } catch (err) {
        return { error: `Failed to create tasks: ${err.message}` };
      }
    }

    return { error: `Unknown server tool: ${toolName}` };
  }
}

export const toolExecutor = new ToolExecutor();
