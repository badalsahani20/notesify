import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConflictResolutionService } from "@/services/ConflictResolutionService";
import type { Note } from "@/store/useNoteStore";
import { toast } from "sonner";

export const useNoteConflict = (noteId: string | undefined | null) => {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["note-conflict", noteId], [noteId]);

  const {
    data: conflict = null,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => (noteId ? ConflictResolutionService.getUnresolvedConflict(noteId) : null),
    enabled: Boolean(noteId),
    staleTime: 0,
  });

  // Cross-tab and local event synchronization
  useEffect(() => {
    if (!noteId) return;

    const handleLocalConflict = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.entityId === noteId) {
        queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
        queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      }
    };

    const handleLocalResolution = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.entityId === noteId) {
        queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
        queryClient.invalidateQueries({ queryKey: ["note", noteId] });
        queryClient.invalidateQueries({ queryKey: ["notes"] });
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel("notesify_conflicts");
      channel.onmessage = (event) => {
        if (event.data?.entityId === noteId) {
          queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
          queryClient.invalidateQueries({ queryKey: ["note", noteId] });
          queryClient.invalidateQueries({ queryKey: ["notes"] });
        }
      };
    }

    window.addEventListener("notesify:conflict", handleLocalConflict);
    window.addEventListener("notesify:conflict-resolved", handleLocalResolution);

    return () => {
      window.removeEventListener("notesify:conflict", handleLocalConflict);
      window.removeEventListener("notesify:conflict-resolved", handleLocalResolution);
      channel?.close();
    };
  }, [noteId, queryClient]);

  // Keep Mine Mutation
  const keepMineMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      return await ConflictResolutionService.resolveKeepMine(noteId);
    },
    onSuccess: (rebasedNote: Note) => {
      queryClient.setQueryData(["note", noteId], rebasedNote);
      queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Preserved local version and rebased against server");
    },
    onError: (err: unknown) => {
      console.error("Keep Mine resolution failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to resolve conflict");
    },
  });

  // Keep Server Mutation
  const keepServerMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      return await ConflictResolutionService.resolveKeepServer(noteId);
    },
    onSuccess: (serverNote: Note) => {
      queryClient.setQueryData(["note", noteId], serverNote);
      queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Applied latest server version");
    },
    onError: (err: unknown) => {
      console.error("Keep Server resolution failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to resolve conflict");
    },
  });

  // Merge Mutation
  const mergeMutation = useMutation({
    mutationFn: async ({
      mergedContent,
      mergedTitle,
    }: {
      mergedContent: string;
      mergedTitle?: string;
    }) => {
      if (!noteId) throw new Error("Note ID is required");
      return await ConflictResolutionService.resolveWithMergedContent(
        noteId,
        mergedContent,
        mergedTitle
      );
    },
    onSuccess: (mergedNote: Note) => {
      queryClient.setQueryData(["note", noteId], mergedNote);
      queryClient.invalidateQueries({ queryKey: ["note-conflict", noteId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Applied merged note");
    },
    onError: (err: unknown) => {
      console.error("Merge resolution failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to apply merged note");
    },
  });

  return {
    conflictRecord: conflict,
    isConflicted: Boolean(conflict),
    isLoading,
    refetch,
    localDraft: conflict?.localDraft || null,
    serverState: (conflict?.serverState as Note | undefined) || null,
    serverVersion: conflict?.serverVersion,
    localVersion: conflict?.localVersion,
    timestamp: conflict?.timestamp,

    // Resolution Actions
    resolveKeepMine: () => keepMineMutation.mutateAsync(),
    resolveKeepServer: () => keepServerMutation.mutateAsync(),
    resolveMerged: (mergedContent: string, mergedTitle?: string) =>
      mergeMutation.mutateAsync({ mergedContent, mergedTitle }),

    isResolving:
      keepMineMutation.isPending ||
      keepServerMutation.isPending ||
      mergeMutation.isPending,
  };
};

export const useAllConflicts = () => {
  return useQuery({
    queryKey: ["notes-all-conflicts"],
    queryFn: () => ConflictResolutionService.getAllUnresolvedConflicts(),
    staleTime: 1000 * 10,
  });
};
