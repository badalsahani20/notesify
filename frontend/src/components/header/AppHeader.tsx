import { Moon, Plus, Sun } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import UserMenu from "@/components/header/UserMenu";
import HeaderSearch from "@/components/header/HeaderSearch";
import NotificationsMenu from "@/components/header/NotificationsMenu";
import { useState } from "react";
import { FolderFormDialog } from "@/components/folders/FolderFormDialog";
import { useFolderStore } from "@/store/useFolderStore";

type AppHeaderProps = {
  theme: "light" | "dark";
  onToggleTheme: (event: React.MouseEvent) => void;
  onMenuOpen?: () => void;
};

const AppHeader = ({ theme, onToggleTheme, onMenuOpen }: AppHeaderProps) => {
  const { folderId } = useParams();
  const navigate = useNavigate();

  const { addFolder } = useFolderStore();

  const [isNewNotebookOpen, setIsNewNotebookOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateNote = () => {
    navigate(folderId ? `/folders/${folderId}/note/new` : `/note/new`);
  };

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
    <header className="desktop-header">
      <div
        className={`desktop-brand ${onMenuOpen ? "mobile-menu-trigger" : ""}`}
        onClick={onMenuOpen}
        role={onMenuOpen ? "button" : undefined}
        tabIndex={onMenuOpen ? 0 : undefined}
        onKeyDown={(e) => e.key === "Enter" && onMenuOpen?.()}
        aria-label={onMenuOpen ? "Open menu" : undefined}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-white/5 blur-md" />
          <div className="relative w-8 h-8 overflow-hidden bg-black shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <img 
              src="./notesify-favicon.png" 
              alt="Notesify" 
              width={32} 
              height={32} 
              className="w-full h-full" 
            />
          </div>
        </div>
        <div>
          {/* <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-text)]">Workspace</p> */}
          <h1 className="text-[1.05rem] font-semibold tracking-[-0.04em] md:text-[1.15rem]">Notesify</h1>
        </div>
      </div>

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
            onClick={handleCreateNote} 
            className="ignite-button bg-[#2563eb] border-[#2563eb]/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Note</span>
          </button>

          <button 
            type="button" 
            onClick={() => setIsNewNotebookOpen(true)} 
            className="ignite-button !bg-transparent border-white/10"
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
