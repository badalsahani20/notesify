import {
  Shield, LogOut, Chrome, KeyRound,
  FileText, Sparkles, TrendingUp, Brain, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/useAuthStore";
import { useSettingsUIStore } from "@/store/useSettingsStore";
import { useUserStats } from "@/hooks/user/useUserStats";
import { UserProfileCard } from "@/components/user/UserProfileCard";
import { getDailyResetDisplay } from "@/utils/quotaUtils";

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

function formatTokens(num: number): string {
  if (!num || num === 0) return "0";
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return `${val % 1 === 0 ? val : val.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return `${val % 1 === 0 ? val : val.toFixed(1)}k`;
  }
  return num.toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: stats, isLoading } = useUserStats();
  const openSettingsAt = useSettingsUIStore((s) => s.openSettingsAt);

  const provider = stats?.provider ?? user?.provider;
  const tier = (stats?.tier || "free").toLowerCase();
  const hasTokenStats = typeof stats?.tokensUsed === "number";
  const aiUsed    = hasTokenStats ? (stats?.tokensUsed ?? 0) : (stats?.aiCount ?? 0);
  const aiLimit   = hasTokenStats ? (stats?.tokensLimit ?? 100000) : (stats?.limit ?? 100000);
  const usagePct  = Math.min((aiUsed / aiLimit) * 100, 100);
  const usageColor = getUsageColor(aiUsed, aiLimit);

  const handleLogout = async () => {
    await logout();
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
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} style={{ color: "var(--accent-strong)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                  AI Today
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded capitalize"
                style={{
                  background: tier === "enterprise" ? "rgba(168, 85, 247, 0.15)" : tier === "pro" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.12)",
                  color: tier === "enterprise" ? "#c084fc" : tier === "pro" ? "#fbbf24" : "#818cf8",
                  border: `1px solid ${tier === "enterprise" ? "rgba(168, 85, 247, 0.25)" : tier === "pro" ? "rgba(245, 158, 11, 0.25)" : "rgba(99, 102, 241, 0.2)"}`
                }}
              >
                {tier}
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>
              {isLoading ? "—" : `${formatTokens(aiUsed)} / ${formatTokens(aiLimit)}`}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>tokens used</span>
          </div>
        </div>

        {/* ── Iris memory ── */}
        <button
          type="button"
          onClick={() => openSettingsAt("memory")}
          className="w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-opacity hover:opacity-80"
          style={{ background: "var(--window-bg)", border: "1px solid var(--divider)" }}
        >
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--accent-strong)" }}
          >
            <Brain size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
              Iris Memory
            </p>
            <p className="text-xs" style={{ color: "var(--muted-text)" }}>
              {isLoading
                ? "Loading…"
                : `${stats?.memoriesCount ?? 0} ${(stats?.memoriesCount ?? 0) === 1 ? "thing" : "things"} Iris remembers about you`}
            </p>
          </div>
          <ChevronRight size={16} style={{ color: "var(--muted-text)" }} />
        </button>

        {/* ── AI usage progress bar ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--window-bg)", border: "1px solid var(--divider)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: "var(--accent-strong)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                AI Tokens Today
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded capitalize"
                style={{
                  background: tier === "enterprise" ? "rgba(168, 85, 247, 0.15)" : tier === "pro" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.12)",
                  color: tier === "enterprise" ? "#c084fc" : tier === "pro" ? "#fbbf24" : "#818cf8",
                  border: `1px solid ${tier === "enterprise" ? "rgba(168, 85, 247, 0.25)" : tier === "pro" ? "rgba(245, 158, 11, 0.25)" : "rgba(99, 102, 241, 0.2)"}`
                }}
              >
                {tier} Tier
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
              {isLoading
                ? "Loading…"
                : `${aiUsed.toLocaleString()} of ${aiLimit.toLocaleString()} tokens used`}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-text)" }}>
              {getDailyResetDisplay().fullText}
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
