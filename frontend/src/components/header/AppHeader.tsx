import { Menu, Moon, Plus, Sun } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "@/components/header/UserMenu";
import HeaderSearch from "@/components/header/HeaderSearch";
import NotificationsMenu from "@/components/header/NotificationsMenu";
import { useState } from "react";
import { FolderFormDialog } from "@/components/folders/FolderFormDialog";
import { useFolderStore } from "@/store/useFolderStore";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { useDesktopUpdateStore } from "@/store/useDesktopUpdateStore";

type AppHeaderProps = {
  theme: "light" | "dark";
  onToggleTheme: (event: React.MouseEvent) => void;
  onMenuOpen?: () => void;
};

const AppHeader = ({ theme, onToggleTheme, onMenuOpen }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { addFolder } = useFolderStore();

  const [isNewNotebookOpen, setIsNewNotebookOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { status: updateStatus, latestRelease, openDownload } = useDesktopUpdateStore();

  const isDesktop = typeof window !== "undefined" && (
    Boolean((window as any).electronAPI) ||
    navigator.userAgent.toLowerCase().includes("electron") ||
    window.location.protocol === "file:"
  );

  const handleCreateFolder = async (name: string) => {
    setIsSaving(true);
    try {
      const folder = await addFolder(name);
      if (folder?._id) {
        setIsNewNotebookOpen(false);
        navigate(`/folders/${folder._id}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header
      className={`desktop-header ${isDesktop ? "is-desktop-app" : ""}`}
      style={isDesktop ? { paddingRight: "clamp(140px, 9.5rem, 160px)" } : undefined}
    >
      {onMenuOpen ? (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onMenuOpen}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer active:scale-95 shadow-sm"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu size={19} />
          </button>
          <button
            type="button"
            onClick={onMenuOpen}
            className="text-[1.05rem] font-semibold tracking-[-0.03em] whitespace-nowrap text-white hover:text-zinc-200 transition-colors cursor-pointer text-left"
          >
            Notesify
          </button>
        </div>
      ) : (
        <Link
          to="/"
          className="desktop-brand"
          aria-label="Notesify home"
        >
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-white/5 blur-md" />
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] flex items-center justify-center">
              <img
                src={notesifyLogo}
                alt="Notesify"
                width={26}
                height={26}
                className="w-6.5 h-6.5 object-contain"
              />
            </div>
          </div>
          <div className="shrink-0">
            <h1 className="text-[1.05rem] font-semibold tracking-[-0.03em] whitespace-nowrap md:text-[1.15rem]">Notesify</h1>
          </div>
        </Link>
      )}

      <div className="desktop-header-search-slot">
        <HeaderSearch />
      </div>

      <div className="desktop-header-actions">
        {isDesktop && updateStatus === "available" && latestRelease ? (
          <button
            type="button"
            onClick={openDownload}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.06] text-white/90 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors shadow-sm group cursor-pointer"
            title={`Notesify ${latestRelease.version} is available. Click to download.`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">Update</span>
            <span className="font-mono text-[11px] text-white/80">v{latestRelease.version}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => onToggleTheme(e)}
          className="nav-action-btn"
          style={{ '--highlight-color': '#94a3b8' } as any}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} className="nav-icon" /> : <Moon size={18} className="nav-icon" />}
        </button>
        <NotificationsMenu />
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewNotebookOpen(true)}
            className="ignite-button !bg-white !text-zinc-950 font-semibold border-white/20 hover:!bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus size={18} className="text-zinc-950" />
            <span className="hidden sm:inline text-zinc-950 font-semibold">New Notebook</span>
          </button>
        </div>
        <UserMenu />
      </div>

      <FolderFormDialog
        open={isNewNotebookOpen}
        mode="create"
        isSaving={isSaving}
        onClose={() => setIsNewNotebookOpen(false)}
        onSubmit={handleCreateFolder}
      />
    </header>
  );
};

export default AppHeader;
