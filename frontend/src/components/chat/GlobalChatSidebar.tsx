import { memo, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Bot, MessageSquarePlus, Search, X, MessageSquare } from "lucide-react";

// Compact time formatter
const formatCompactTime = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

interface GlobalChatSidebarProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sessions: any[];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  loadSession: (id: string) => void;
  startNewChat: () => void;
}

export const GlobalChatSidebar = memo(({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  sessions,
  sessionsLoading,
  activeSessionId,
  loadSession,
  startNewChat,
}: GlobalChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => s.title?.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const sessionGroups = useMemo(() => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const earlier: any[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    filteredSessions.forEach((session) => {
      const time = new Date(session.updatedAt || session.createdAt || Date.now()).getTime();
      if (time >= startOfToday) {
        today.push(session);
      } else if (time >= startOfYesterday) {
        yesterday.push(session);
      } else {
        earlier.push(session);
      }
    });

    const groups: { label: string; items: any[] }[] = [];
    if (today.length > 0) groups.push({ label: "Today", items: today });
    if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
    if (earlier.length > 0) groups.push({ label: "Earlier", items: earlier });

    return groups;
  }, [filteredSessions]);

  return (
    <>
      {/* Sidebar — desktop inline / mobile overlay */}
      {(isMobile && sidebarOpen) && (
        <div
          className="gc-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "gc-sidebar",
        isMobile && "gc-sidebar-mobile",
        sidebarOpen ? "gc-sidebar-expanded" : "gc-sidebar-collapsed"
      )}>
        <div className="gc-sidebar-inner">
          <div className="gc-sidebar-header">
            <div className="flex items-center justify-between w-full">
              <div className="gc-sidebar-brand flex items-center gap-2">
                <Bot size={15} className="text-indigo-400" />
                <span>Conversations</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                {sessions.length}
              </span>
            </div>

            {/* Conversation Search Input */}
            <div className="relative flex items-center w-full">
              <Search size={12} className="absolute left-2.5 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-md pl-7 pr-7 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-white/40 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              className="gc-new-chat-btn !py-1.5 text-xs"
              onClick={startNewChat}
              title="New chat"
            >
              <MessageSquarePlus size={14} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Dense Session List */}
          <div className="gc-session-list custom-scrollbar p-1.5 space-y-3">
            {sessionsLoading && sessions.length === 0 ? (
              <div className="gc-session-skeleton-wrap space-y-1.5 p-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-7 bg-white/5 rounded-md animate-pulse" />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-6">
                {searchQuery ? "No matching chats" : "No conversations yet"}
              </p>
            ) : (
              sessionGroups.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <div className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/35 flex items-center gap-2">
                    <span>{group.label}</span>
                    <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  {group.items.map((session) => {
                    const isActive = activeSessionId === session._id;
                    return (
                      <button
                        key={session._id}
                        onClick={() => { loadSession(session._id); if (isMobile) setSidebarOpen(false); }}
                        className={cn(
                          "w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all relative cursor-pointer group",
                          isActive
                            ? "bg-indigo-500/15 text-white font-medium shadow-sm border-l-2 border-indigo-500 rounded-l-none pl-2"
                            : "text-white/70 hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                          <MessageSquare size={12} className={cn("shrink-0", isActive ? "text-indigo-400" : "text-white/30 group-hover:text-white/60")} />
                          <span className="truncate leading-tight text-[12px]">{session.title || "Untitled Chat"}</span>
                        </div>
                        <span className="text-[10px] text-white/35 shrink-0 flex items-center gap-0.5">
                          {formatCompactTime(session.updatedAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
});
