import {
  Archive,
  FileStack,
  Folders,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { NavLink, useParams, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useNoteStore } from "@/store/useNoteStore";
import { usePanelStore } from "@/store/usePanelStore";
import { cn } from "@/lib/utils";
import { useSettingsUIStore } from "@/store/useSettingsStore";

const ActivityBar = () => {
  const { noteId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useNoteStore();
  const { isFolderPanelOpen, closeFolderPanel } = usePanelStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const openSettings = useSettingsUIStore((s) => s.openSettings);

  const toggleNotesPanel = (e: React.MouseEvent) => {
    // Only toggle focus mode if we are actually viewing a note
    if (!noteId) return;
    
    const params = new URLSearchParams(location.search);
    const focus = params.get("focus");
    // If in focus mode, toggle between focus=1 (notes visible) and focus=2 (notes hidden)
    if (focus === "1" || focus === "2") {
      e.preventDefault();
      params.set("focus", focus === "1" ? "2" : "1");
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  };

  return (
    <aside className="desktop-rail">
      <div className="flex-1 flex sm:block py-2 sm:py-4 dark:bg-zinc-900 overflow-hidden">
        {isSearchOpen ? (
          <div className="flex items-center w-full px-3 gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
            <Search size={16} className="text-[var(--muted-text)] shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-transparent border-none outline-none text-sm text-[var(--text-strong)] placeholder:text-[var(--muted-text)]"
              onBlur={() => !searchQuery && setIsSearchOpen(false)}
            />
            <button
              onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
              className="text-[var(--muted-text)] hover:text-[var(--text-strong)] text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <nav className="flex w-full flex-row sm:flex-col gap-2 justify-around sm:justify-start">
            {/* All Notes */}
            <NavLink
              to={noteId ? `/note/${noteId}${location.search}` : `/${location.search}`}
              onClick={toggleNotesPanel}
              className={({ isActive }) => {
                const focus = new URLSearchParams(location.search).get("focus");
                const isNotesActive = focus ? focus === "1" : isActive;
                return cn(
                  "nav-action-btn transition-all duration-300", 
                  isNotesActive && "nav-action-btn-active"
                );
              }}
              style={{ "--highlight-color": "#10b981" } as any}
              title="All Notes"
            >
              <FileStack size={18} className="nav-icon" />
            </NavLink>

            {/* Favorites */}
            <NavLink
              to={noteId ? `/favorites/note/${noteId}${location.search}` : `/favorites${location.search}`}
              className={({ isActive }) =>
                cn("nav-action-btn transition-all duration-300", isActive && "nav-action-btn-active")
              }
              style={{ "--highlight-color": "#fbbf24" } as any}
              title="Favorites"
            >
              <Star size={18} className="nav-icon" />
            </NavLink>

            {/* AI Chat */}
            {/* Iris AI */}
            <NavLink
              to={`/chat${location.search}`}
              className={({ isActive }) =>
                cn(
                  "ai-rail-button group mx-auto mb-2 flex items-center justify-center transition-all",
                  isActive && "ai-rail-button-active"
                )
              }
              title="Iris AI"
            >
              <div className="iris-orb" />
            </NavLink>

            {/* Folders navigation */}
            <NavLink
              to={`/folders${location.search}`}
              onClick={() => {
                if (isFolderPanelOpen) closeFolderPanel();
              }}
              className={({ isActive }) =>
                cn(
                  "nav-action-btn transition-all duration-300",
                  (isActive || location.pathname.startsWith("/folders")) && "nav-action-btn-active"
                )
              }
              style={{ "--highlight-color": "#3b82f6" } as any}
              title="Notebooks"
            >
              <Folders size={18} className="nav-icon" />
            </NavLink>

            {/* Mobile search button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-(--muted-text) hover:bg-white/5 hover:text-[#d1d5db] transition sm:hidden"
              title="Search"
            >
              <Search size={16} />
            </button>
          </nav>
        )}
      </div>

      <div className="flex flex-row sm:flex-col items-center gap-2 px-2 sm:px-0 pb-2 sm:pb-4 dark:bg-zinc-900">
        <NavLink
          to={`/archive${location.search}`}
          className={({ isActive }) =>
            cn("nav-action-btn transition-all duration-300", isActive && "nav-action-btn-active")
          }
          style={{ "--highlight-color": "#94a3b8" } as any}
          title="Archive"
        >
          <Archive size={18} className="nav-icon" />
        </NavLink>

        <NavLink
          to={`/trash${location.search}`}
          className={({ isActive }) =>
            cn("nav-action-btn transition-all duration-300", isActive && "nav-action-btn-active")
          }
          style={{ "--highlight-color": "#ef4444" } as any}
          title="Trash"
        >
          <Trash2 size={18} className="nav-icon" />
        </NavLink>

        <button
          className="nav-action-btn"
          aria-label="Settings"
          onClick={openSettings}
        >
          <Settings size={18} className="nav-icon" />
        </button>
      </div>
    </aside>
  );
};

export default ActivityBar;
