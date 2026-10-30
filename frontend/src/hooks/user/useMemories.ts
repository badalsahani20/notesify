import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type MemoryCategory =
  | "PROFILE"
  | "PREFERENCE"
  | "GOAL"
  | "PROJECT"
  | "SKILL"
  | "OTHER";

export interface UserMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
  lastAccessedAt: string;
}

const MEMORY_QUERY_KEY = ["user", "memories"] as const;

const fetchMemories = async (): Promise<UserMemory[]> => {
  const res = await api.get("/user/memories");
  return res.data.memories ?? [];
};

export const useMemories = () =>
  useQuery({
    queryKey: MEMORY_QUERY_KEY,
    queryFn: fetchMemories,
    staleTime: 60 * 1000,
    retry: 1,
  });

const useInvalidateMemories = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEY });
    // The profile page shows a memory count from /user/stats.
    queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
  };
};

export const useDeleteMemory = () => {
  const invalidate = useInvalidateMemories();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/user/memories/${id}`),
    onSuccess: invalidate,
  });
};

export const useClearMemories = () => {
  const invalidate = useInvalidateMemories();
  return useMutation({
    mutationFn: () => api.delete("/user/memories"),
    onSuccess: invalidate,
  });
};
