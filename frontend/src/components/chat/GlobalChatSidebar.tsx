import { memo, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SquarePen,
  Search,
  PanelLeft,
  X,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

interface GlobalChatSidebarProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sessions: any[];
  sessionsLoading: boolean;
  sessionsLoadingMore: boolean;
  sessionsHasMore: boolean;
  activeSessionId: string | null;
  loadSession: (id: string) => void;
  loadMoreSessions: () => void;
  deleteSession: (id: string) => Promise<void>;
  startNewChat: () => void;
}

export const GlobalChatSidebar = memo(({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  sessions,
  sessionsLoading,
  sessionsLoadingMore,
  sessionsHasMore,
  activeSessionId,
  loadSession,
  loadMoreSessions,
  deleteSession,
  startNewChat,
}: GlobalChatSidebarProps) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => s.title?.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="gc-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "gc-sidebar",
          isMobile && "gc-sidebar-mobile",
          sidebarOpen ? "gc-sidebar-expanded" : "gc-sidebar-collapsed"
        )}
      >
        <div className="gc-sidebar-inner flex flex-col h-full bg-[#171717] text-white select-none">
          {/* Top Header: Brand + Search & Sidebar collapse icons */}
          <div className="flex items-center justify-between px-3 pt-3.5 pb-2">
            <span className="font-semibold text-[17px] text-white tracking-tight">
              Iris
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowSearch((prev) => !prev);
                  if (showSearch) setSearchQuery("");
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Search chats"
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Close sidebar"
              >
                <PanelLeft size={16} />
              </button>
            </div>
          </div>

          {/* Search Input (conditionally visible or toggleable) */}
          {showSearch && (
            <div className="px-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative flex items-center w-full">
                <Search
                  size={13}
                  className="absolute left-2.5 text-zinc-400 pointer-events-none"
                />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-white/[0.06] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-zinc-400 hover:text-white cursor-pointer"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation Action: New chat */}
          <div className="px-3 py-1">
            <button
              type="button"
              onClick={startNewChat}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-normal text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-left group"
              title="New chat"
            >
              <SquarePen
                size={16}
                className="text-zinc-300 group-hover:text-white transition-colors shrink-0"
              />
              <span>New chat</span>
            </button>
          </div>

          {/* Section Header */}
          <div className="px-3 pt-3.5 pb-1.5 text-[12px] font-medium text-zinc-400 select-none">
            {searchQuery.trim() ? "Search results" : "Recents"}
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 custom-scrollbar">
            {sessionsLoading && sessions.length === 0 ? (
              <div className="space-y-1.5 px-1 py-1">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 bg-white/[0.04] rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8 font-normal">
                {searchQuery ? "No matching chats" : "No conversations yet"}
              </p>
            ) : (
              <>
                {filteredSessions.map((session) => {
                const isActive = activeSessionId === session._id;
                const cleanTitle = session.title
                  ? session.title
                      .replace(/^(user|assistant|system|iris)\s*:\s*/gi, "")
                      .trim() || "Untitled chat"
                  : "Untitled chat";

                  return (
                    <div key={session._id} className="relative group">
                      <button
                        onClick={() => {
                          setOpenMenuId(null);
                          loadSession(session._id);
                          if (isMobile) setSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full text-left flex items-center justify-between gap-2 px-3 py-2 pr-10 rounded-lg text-[13.5px] font-normal transition-colors cursor-pointer group relative",
                          isActive
                            ? "bg-[#212121] text-white"
                            : "text-zinc-200/90 hover:text-white hover:bg-white/[0.05]"
                        )}
                        title={cleanTitle}
                      >
                        <span className="truncate leading-normal flex-1">
                          {cleanTitle}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Actions for ${cleanTitle}`}
                        aria-expanded={openMenuId === session._id}
                        disabled={deletingSessionId === session._id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) => current === session._id ? null : session._id);
                        }}
                        className={cn(
                          "gc-session-actions absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-opacity cursor-pointer",
                          openMenuId === session._id || isActive
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        )}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {openMenuId === session._id && (
                        <div className="absolute right-2 top-[calc(100%-0.2rem)] z-20 min-w-32 rounded-lg border border-white/10 bg-[#242424] p-1 shadow-xl">
                          <button
                            type="button"
                            disabled={deletingSessionId === session._id}
                            onClick={async (event) => {
                              event.stopPropagation();
                              const confirmed = window.confirm(`Delete “${cleanTitle}”?`);
                              if (!confirmed) return;

                              setDeletingSessionId(session._id);
                              await deleteSession(session._id);
                              setDeletingSessionId(null);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                          >
                            <Trash2 size={13} />
                            {deletingSessionId === session._id ? "Deleting…" : "Delete chat"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sessionsHasMore && (
                  <button
                    type="button"
                    onClick={loadMoreSessions}
                    disabled={sessionsLoadingMore}
                    className="w-full px-3 py-2.5 mt-1 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors disabled:opacity-60"
                  >
                    {sessionsLoadingMore ? "Loading older chats…" : "Load older chats"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
});
