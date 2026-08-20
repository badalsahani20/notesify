import { QueryClient, MutationCache } from "@tanstack/react-query";
import { SyncService } from "@/services/SyncService";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSettled: () => {
      // Magically trigger the sync engine after any mutation in the entire app completes!
      SyncService.processQueue();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
