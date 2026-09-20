import { ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { SectionLabel } from "./SettingsShared";
import { useUserStats } from "@/hooks/user/useUserStats";
import { UserProfileCard, formatMemberSinceDate } from "@/components/user/UserProfileCard";

export const AccountTab = () => {
  const { user } = useAuthStore();
  const { data: stats, isLoading: isStatsLoading } = useUserStats();

  const displayName = user?.name || stats?.name || "Guest";
  const displayEmail = user?.email || stats?.email || "-";
  const provider = stats?.provider ?? user?.provider;
  const memberSince = stats?.memberSince ?? user?.createdAt;
  const formattedMemberSince = formatMemberSinceDate(memberSince, "full");

  return (
    <div className="space-y-1">
      <UserProfileCard className="mb-6" />

      <SectionLabel>Account Details</SectionLabel>
      <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden divide-y divide-white/5">
        <div className="flex justify-between items-center gap-4 px-4 py-3">
          <span className="text-sm text-zinc-400">Full name</span>
          <span className="text-sm text-zinc-200 font-medium truncate">{displayName || "-"}</span>
        </div>
        <div className="flex justify-between items-center gap-4 px-4 py-3">
          <span className="text-sm text-zinc-400">Email address</span>
          <span className="text-sm text-zinc-200 font-medium truncate">{displayEmail}</span>
        </div>
        <div className="flex justify-between items-center gap-4 px-4 py-3">
          <span className="text-sm text-zinc-400">Login method</span>
          <span className="text-sm text-zinc-200 font-medium">
            {provider === "google"
              ? "Google"
              : provider === "local"
                ? "Email"
                : isStatsLoading
                  ? "Loading..."
                  : "-"}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4 px-4 py-3">
          <span className="text-sm text-zinc-400">Member since</span>
          <span className="text-sm text-zinc-200 font-medium text-right">
            {formattedMemberSince || (isStatsLoading ? "Loading..." : "-")}
          </span>
        </div>
      </div>

      <SectionLabel>Danger Zone</SectionLabel>
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm text-zinc-300 mb-3">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <a
          href="mailto:badalsahani233@gmail.com?subject=Account Deletion Request&body=Hi, I'd like to permanently delete my Notesify account."
          className="inline-flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          Request account deletion <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
};
