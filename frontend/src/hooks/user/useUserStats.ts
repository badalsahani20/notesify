import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface UserStats {
  notesCount: number;
  aiCount: number;
  limit: number;
  tokensUsed?: number;
  tokensLimit?: number;
  tokensInput?: number;
  tokensOutput?: number;
  tier?: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "local" | "google";
  isVerified: boolean;
  memberSince: string;
}

const fetchUserStats = async (): Promise<UserStats> => {
  const res = await api.get("/user/stats");
  return res.data.stats;
};

export const useUserStats = () => {
  return useQuery({
    queryKey: ["user", "stats"],
    queryFn: fetchUserStats,
    staleTime: 30 * 1000,
    retry: 1,
  });
};
