import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  FolderKanban,
  GraduationCap,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SettingsShared";
import {
  useClearMemories,
  useDeleteMemory,
  useMemories,
  type MemoryCategory,
  type UserMemory,
} from "@/hooks/user/useMemories";
import { timeAgo } from "@/store/useNotificationStore";

const CATEGORY_ORDER: MemoryCategory[] = [
  "PROFILE",
  "PREFERENCE",
  "GOAL",
  "PROJECT",
  "SKILL",
  "OTHER",
];

const CATEGORY_META: Record<MemoryCategory, { label: string; icon: LucideIcon }> = {
  PROFILE: { label: "About you", icon: User },
  PREFERENCE: { label: "Preferences", icon: SlidersHorizontal },
  GOAL: { label: "Goals", icon: Target },
  PROJECT: { label: "Projects", icon: FolderKanban },
  SKILL: { label: "Skills", icon: GraduationCap },
  OTHER: { label: "Other", icon: Sparkles },
};

export const MemoryTab = () => {
  const { data: memories, isLoading, isError, refetch, isFetching } = useMemories();
  const deleteMemory = useDeleteMemory();
  const clearMemories = useClearMemories();

  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    []
  );

  const groups = useMemo(() => {
    const grouped = new Map<MemoryCategory, UserMemory[]>();
    for (const memory of memories ?? []) {
      const bucket = grouped.get(memory.category) ?? [];
      bucket.push(memory);
      grouped.set(memory.category, bucket);
    }
    return CATEGORY_ORDER.filter((category) => grouped.has(category)).map((category) => ({
      category,
      items: grouped.get(category)!,
    }));
  }, [memories]);

  const count = memories?.length ?? 0;

  const handleDelete = (memory: UserMemory) => {
    deleteMemory.mutate(memory.id, {
      onSuccess: () => toast.success("Memory deleted"),
      onError: () => toast.error("Couldn't delete that memory"),
    });
  };

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      confirmTimer.current = window.setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }

    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    clearMemories.mutate(undefined, {
      onSuccess: (res) => {
        const deleted = res.data?.deletedCount ?? 0;
        toast.success(
          deleted
            ? `Cleared ${deleted} ${deleted === 1 ? "memory" : "memories"}`
            : "No memories to clear"
        );
        setConfirmingClear(false);
      },
      onError: () => {
        toast.error("Couldn't clear memories");
        setConfirmingClear(false);
      },
    });
  };

  return (
    <div className="space-y-1">
      {/* Intro */}
      <div className="rounded-xl border border-white/8 bg-white/4 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/12 text-indigo-300">
            <Brain size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-200">What Iris remembers</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Iris keeps lasting details you share — goals, preferences, projects and skills — so
              future replies feel personal. Memories are private to your account and only retrieved
              when relevant.
            </p>
          </div>
        </div>

        {count > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
            <span className="text-xs text-zinc-500">
              {count} {count === 1 ? "memory" : "memories"} stored
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={clearMemories.isPending}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                confirmingClear
                  ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
            >
              {clearMemories.isPending
                ? "Clearing…"
                : confirmingClear
                  ? "Click again to confirm"
                  : "Clear all"}
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 pt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-white/5 bg-white/4"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/4 p-6 text-center">
          <p className="text-sm text-zinc-300">Couldn't load your memories.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 transition-colors hover:text-indigo-200 disabled:opacity-60"
          >
            <RotateCw size={14} className={isFetching ? "animate-spin" : undefined} />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && count === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
          <Brain size={22} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-300">Nothing saved yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
            Ask Iris to remember something — “remember that I'm preparing for GATE” — and it will
            show up here.
          </p>
        </div>
      )}

      {/* Grouped memories */}
      {!isLoading &&
        !isError &&
        groups.map(({ category, items }) => {
          const { label, icon: Icon } = CATEGORY_META[category];

          return (
            <div key={category}>
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={12} />
                  {label}
                </span>
              </SectionLabel>

              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/8 bg-white/4">
                {items.map((memory) => {
                  const isDeleting =
                    deleteMemory.isPending && deleteMemory.variables === memory.id;

                  return (
                    <div key={memory.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
                          {memory.content}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Saved {timeAgo(memory.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(memory)}
                        disabled={isDeleting}
                        aria-label="Delete memory"
                        title="Delete memory"
                        className="mt-0.5 shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
};
