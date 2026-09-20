import {
  Shield, LogOut, Chrome, KeyRound,
  FileText, Sparkles, TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useUserStats } from "@/hooks/user/useUserStats";
import { UserProfileCard } from "@/components/user/UserProfileCard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUsageColor(used: number, limit: number): string {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "#f59e0b";
  return "#22c55e";
}

function getUsageLabel(used: number, limit: number): string {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  if (pct >= 100) return "Limit reached";
  if (pct >= 85) return "Almost full";
  if (pct >= 60) return "Moderate use";
  return "Looks good";
}

// ── Component ─────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { data: stats, isLoading } = useUserStats();

  const provider = stats?.provider ?? user?.provider;
  const aiUsed    = stats?.aiCount ?? 0;
  const aiLimit   = stats?.limit   ?? 10;
  const usagePct  = Math.min((aiUsed / aiLimit) * 100, 100);
  const usageColor = getUsageColor(aiUsed, aiLimit);

  const handleLogout = async () => {
    try { await api.post("/users/logout"); } catch { /* ignore */ }
    clearAuth();
    navigate("/login");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--panel-bg)" }}>

      {/* ── Page header ── */}
      <div
        className="flex-shrink-0 flex items-center px-5 py-4 border-b"
        style={{ borderColor: "var(--divider)" }}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--text-strong)" }}>Profile</h2>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-3 custom-scrollbar">

        {/* ── Profile hero card ── */}
        <UserProfileCard
          editable
          showMemberSince
          className="rounded-2xl p-5"
        />

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Notes count */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-0.5"
            style={{ background: "var(--window-bg)", border: "1px solid var(--divider)" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <FileText size={13} style={{ color: "var(--accent-strong)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                Notes
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>
              {isLoading ? "—" : stats?.notesCount ?? 0}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>total created</span>
          </div>

          {/* AI used */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-0.5"
            style={{ background: "var(--window-bg)", border: "1px solid var(--divider)" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={13} style={{ color: "var(--accent-strong)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                AI Today
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>
              {isLoading ? "—" : `${aiUsed}/${aiLimit}`}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>requests used</span>
          </div>
        </div>

        {/* ── AI usage progress bar ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--window-bg)", border: "1px solid var(--divider)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: "var(--accent-strong)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                AI Requests Today
              </span>
            </div>
            {!isLoading && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: `${usageColor}22`, color: usageColor }}
              >
                {getUsageLabel(aiUsed, aiLimit)}
              </span>
            )}
          </div>

          {/* Bar track */}
          <div
            className="relative h-2.5 rounded-full overflow-hidden mb-2"
            style={{ background: "var(--surface-muted)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: isLoading ? "0%" : `${usagePct}%`,
                background: usageColor,
                boxShadow: `0 0 10px ${usageColor}55`,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>
              {isLoading ? "Loading…" : `${aiUsed} of ${aiLimit} requests used`}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>
              Resets at midnight
            </span>
          </div>
        </div>

        {/* ── Security ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--divider)" }}
        >
          {/* Section heading */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ background: "var(--window-bg)" }}
          >
            <Shield size={14} style={{ color: "var(--accent-strong)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
              Security
            </span>
          </div>

          {provider === "google" ? (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "var(--window-bg)", borderTop: "1px solid var(--divider)" }}
            >
              <Chrome size={15} style={{ color: "var(--muted-text)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                  Signed in with Google
                </p>
                <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                  Password is managed by Google
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toast.info("Change password coming soon!")}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80"
              style={{ background: "var(--window-bg)", borderTop: "1px solid var(--divider)" }}
            >
              <KeyRound size={15} style={{ color: "var(--muted-text)" }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                  Change Password
                </p>
                <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                  Update your account password
                </p>
              </div>
            </button>
          )}
        </div>

        {/* ── Sign out ── */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
            color: "#ef4444",
          }}
        >
          <LogOut size={16} />
          <span className="text-sm font-semibold">Sign Out</span>
        </button>

      </div>
    </div>
  );
};

export default ProfilePage;
