import { useState, useMemo } from "react";
import { CheckCircle2, Calendar, Mail, Pencil, Check, X, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/useAuthStore";
import { useUserStats } from "@/hooks/user/useUserStats";
import GoogleIcon from "@/assets/google.svg";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

export interface UserProfileCardProps {
  className?: string;
  editable?: boolean;
  showMemberSince?: boolean;
  memberSinceFormat?: "short" | "full";
  rightSlot?: React.ReactNode;
}

export const formatMemberSinceDate = (dateStr?: string, format: "short" | "full" = "short"): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return format === "full"
      ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

export const UserProfileCard = ({
  className,
  editable = false,
  showMemberSince = true,
  memberSinceFormat = "short",
  rightSlot,
}: UserProfileCardProps) => {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const { data: stats, isLoading: isStatsLoading } = useUserStats();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");

  const displayName = user?.name || stats?.name || "Guest";
  const displayEmail = user?.email || stats?.email || "";
  const displayAvatar = user?.avatar || stats?.avatar || GoogleIcon;
  const provider = stats?.provider ?? user?.provider;
  const isVerified = user?.isVerified ?? stats?.isVerified ?? false;
  const memberSince = stats?.memberSince ?? user?.createdAt;
  const formattedMemberSince = formatMemberSinceDate(memberSince, memberSinceFormat);

  const initials = useMemo(() => {
    if (!displayName || displayName === "Guest") return "NS";
    return displayName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NS";
  }, [displayName]);

  const { mutate: saveName, isPending: isSaving } = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.put("/user/profile", { name });
      return res.data;
    },
    onSuccess: (data) => {
      updateUser({ name: data.user.name });
      queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
      setIsEditingName(false);
      toast.success("Name updated successfully");
    },
    onError: () => toast.error("Failed to update name"),
  });

  const handleStartEdit = () => {
    setNameInput(displayName);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setNameInput(displayName);
    setIsEditingName(false);
  };

  const handleConfirmEdit = () => {
    if (!nameInput.trim() || isSaving) return;
    saveName(nameInput.trim());
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/4 border border-white/8 transition-all",
        className
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Avatar with optional verification ring */}
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 border-2 border-indigo-500/30 shadow-lg">
            <AvatarImage src={displayAvatar} referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-indigo-500/10 text-indigo-300 font-bold text-base">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isVerified && (
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0f0f11] flex items-center justify-center text-white shadow-sm"
              title="Verified Account"
            >
              <ShieldCheck size={11} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* User identification and meta badges */}
        <div className="min-w-0 flex-1">
          {/* Display name with inline edit support */}
          <div className="flex items-center gap-2 mb-0.5">
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmEdit();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="flex-1 text-sm font-semibold bg-white/5 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  maxLength={50}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  disabled={isSaving || !nameInput.trim()}
                  className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-40"
                  title="Save name"
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"
                  title="Cancel edit"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <p className="font-semibold text-white truncate text-[15px]">{displayName}</p>
                {editable && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors shrink-0"
                    title="Edit display name"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Email */}
          <p className="text-sm text-zinc-400 truncate mb-2">{displayEmail || (isStatsLoading ? "Loading..." : "No email associated")}</p>

          {/* Badges: Verified status, Provider, Member since */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                isVerified
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              )}
            >
              <CheckCircle2 size={10} />
              {isVerified ? "Verified" : "Unverified"}
            </span>

            {provider === "google" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <img src={GoogleIcon} alt="" className="h-2.5 w-2.5" />
                Google
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-300 border border-zinc-500/20">
                <Mail size={10} />
                Email
              </span>
            )}

            {showMemberSince && formattedMemberSince && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                <Calendar size={10} />
                Since {formattedMemberSince}
              </span>
            )}
          </div>
        </div>
      </div>

      {rightSlot && <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
};

export default UserProfileCard;
