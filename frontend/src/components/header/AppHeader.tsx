import { Moon, Plus, Sun } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "@/components/header/UserMenu";
import HeaderSearch from "@/components/header/HeaderSearch";
import NotificationsMenu from "@/components/header/NotificationsMenu";
import { useState } from "react";
import { FolderFormDialog } from "@/components/folders/FolderFormDialog";
import { useFolderStore } from "@/store/useFolderStore";
import notesifyLogo from "@/assets/notesify-favicon.png";

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
      <Link
        to="/"
        className={`desktop-brand ${onMenuOpen ? "mobile-menu-trigger" : ""}`}
        onClick={(e) => {
          if (onMenuOpen) {
            e.preventDefault();
            onMenuOpen();
          }
        }}
        aria-label={onMenuOpen ? "Open menu" : "Notesify home"}
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

      <div className="desktop-header-search-slot">
        <HeaderSearch />
      </div>

      <div className="desktop-header-actions">
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
            className="ignite-button bg-[#2563eb] border-[#2563eb]/20 hover:bg-[#1d4ed8] text-white transition-colors shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Notebook</span>
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
