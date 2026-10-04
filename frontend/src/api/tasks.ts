import api from "@/lib/api";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "archived";
export type TaskType = "practice_question" | "concept_review" | "coding_task" | "quiz" | "todo";
export type TaskDifficulty = "easy" | "medium" | "hard";

export interface LearningTask {
  _id: string;
  user: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  topic: string;
  difficulty: TaskDifficulty;
  sourceSessionId?: string;
  completedAt?: string;
  skippedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetTasksParams {
  activeOnly?: boolean;
  status?: TaskStatus;
  topic?: string;
  limit?: number;
  includeArchived?: boolean;
}

export async function getTasks(params?: GetTasksParams): Promise<LearningTask[]> {
  const res = await api.get("/tasks", { params });
  return res.data.tasks || [];
}

export async function createTasks(
  tasks: Array<{
    title: string;
    description?: string;
    type?: TaskType;
    difficulty?: TaskDifficulty;
    topic?: string;
  }>,
  sourceSessionId?: string
): Promise<LearningTask[]> {
  const res = await api.post("/tasks", { tasks, sourceSessionId });
  return res.data.tasks || [];
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<LearningTask> {
  const res = await api.patch(`/tasks/${taskId}/status`, { status });
  return res.data.task;
}

export async function archiveTasks(taskIds?: string[]): Promise<void> {
  await api.post("/tasks/archive", { taskIds });
}

export async function getLearningHistory(params?: { topic?: string; limit?: number }): Promise<LearningTask[]> {
  const res = await api.get("/tasks/history", { params });
  return res.data.tasks || [];
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
