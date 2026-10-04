import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTasks,
  updateTaskStatus,
  deleteTask,
  createTasks,
  archiveTasks,
  type LearningTask,
  type TaskStatus,
  type GetTasksParams,
} from "@/api/tasks";

export const TASKS_QUERY_KEY = ["learning-tasks"];

export function useTasks(params?: GetTasksParams) {
  const queryClient = useQueryClient();
  const queryKey = [...TASKS_QUERY_KEY, params];

  const tasksQuery = useQuery({
    queryKey,
    queryFn: () => getTasks(params),
    staleTime: 1000 * 30, // 30 seconds
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<LearningTask[]>(queryKey);

      if (previousTasks) {
        queryClient.setQueryData<LearningTask[]>(
          queryKey,
          previousTasks.map((t) => (t._id === taskId ? { ...t, status } : t))
        );
      }

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  const createTasksMutation = useMutation({
    mutationFn: ({
      tasks,
      sourceSessionId,
    }: {
      tasks: Parameters<typeof createTasks>[0];
      sourceSessionId?: string;
    }) => createTasks(tasks, sourceSessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  const archiveTasksMutation = useMutation({
    mutationFn: (taskIds?: string[]) => archiveTasks(taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    refetch: tasksQuery.refetch,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
    deleteTask: deleteTaskMutation.mutate,
    createTasks: createTasksMutation.mutate,
    archiveTasks: archiveTasksMutation.mutate,
  };
}
