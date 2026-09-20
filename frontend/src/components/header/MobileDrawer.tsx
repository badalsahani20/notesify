import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy, useEffect } from "react";
import { Archive, Bot, FileText, Plus, Star, Trash2, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FolderPanelSkeleton } from "@/components/ui/folderPanelSkeleton";
import { useFolderStore } from "@/store/useFolderStore";
import { FolderFormDialog } from "@/components/folders/FolderFormDialog";
import { useState } from "react";

const FoldersPanel = lazy(() => import("@/components/folders/FolderPanel"));

type Props = {
  open: boolean;
  onClose: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

type NavRowProps = {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
};

const NavRow = ({ icon: Icon, label, active, onClick }: NavRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`mobile-drawer-nav-row ${active ? "mobile-drawer-nav-row-active" : ""}`}
  >
    <Icon size={17} className="mobile-drawer-nav-icon" />
    <span className="mobile-drawer-nav-label">{label}</span>
  </button>
);

const MobileDrawer = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { noteId } = useParams();
  const p = location.pathname;
  const { addFolder } = useFolderStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  // Auto-close when user navigates by tapping a link inside the drawer
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleCreateFolder = async (name: string) => {
    setIsSavingFolder(true);
    try {
      const folder = await addFolder(name);
      if (folder?._id) {
        setIsCreateDialogOpen(false);
        navigate(`/folders/${folder._id}`);
      }
    } finally {
      setIsSavingFolder(false);
    }
  };

  const go = (path: string) => navigate(path);

  const isAllNotes  = !p.startsWith("/favorites") && !p.startsWith("/archive") && !p.startsWith("/trash") && !p.startsWith("/chat") && !p.startsWith("/search") && !p.startsWith("/profile") && !p.startsWith("/folders");
  const isFavorites = p.startsWith("/favorites");
  const isAiChat    = p.startsWith("/chat");


  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mob-drawer-backdrop"
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="mob-drawer-panel"
            className="mobile-drawer-panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.32, ease }}
          >
            {/* Header */}
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-brand">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-white/5 blur-md" />
                  <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-black">
                    <img
                      src="/notesify-favicon.png"
                      alt="Notesify"
                      width={28}
                      height={28}
                      className="w-full h-full object-cover scale-[1.15]"
                    />
                  </div>
                </div>
                <span className="mobile-drawer-brand-name">Notesify</span>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={onClose}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="mobile-drawer-content custom-scrollbar">

              {/* ── Top nav links ── */}
              <div className="mobile-drawer-nav-section">
                <NavRow
                  icon={FileText}
                  label="All Notes"
                  active={isAllNotes}
                  onClick={() => go(noteId ? `/note/${noteId}` : "/")}
                />
                <NavRow
                  icon={Star}
                  label="Favorites"
                  active={isFavorites}
                  onClick={() => go(noteId ? `/favorites/note/${noteId}` : "/favorites")}
                />
                {/* Iris AI — prominent gradient chip */}
                <button
                  type="button"
                  onClick={() => go("/chat")}
                  className={`mobile-drawer-ai-btn ${isAiChat ? "mobile-drawer-ai-btn-active" : ""}`}
                >
                  <div className="mobile-drawer-ai-orb">
                    <div className="iris-orb iris-orb-md" />
                  </div>
                  <div>
                    <p className="mobile-drawer-ai-label">Iris AI</p>
                    <p className="mobile-drawer-ai-sub">Ask anything</p>
                  </div>
                  <Bot size={15} className="mobile-drawer-ai-icon-end" />
                </button>
              </div>

              <div className="mobile-drawer-divider" />

              {/* ── Notebooks / Archive / Trash (from FoldersPanel) ── */}
              <div className="mobile-drawer-content py-2">
                <Suspense fallback={<FolderPanelSkeleton />}>
                  <FoldersPanel />
                </Suspense>
              </div>

              {/* ── Bottom nav links ── */}
              <div className="mobile-drawer-nav-section mt-4 pb-4">
                <NavRow
                  icon={Archive}
                  label="Archive"
                  active={p.startsWith("/archive")}
                  onClick={() => go("/archive")}
                />
                <NavRow
                  icon={Trash2}
                  label="Trash"
                  active={p.startsWith("/trash")}
                  onClick={() => go("/trash")}
                />
              </div>
            </div>

            {/* Notebook creation dialog */}
            <FolderFormDialog
              open={isCreateDialogOpen}
              mode="create"
              isSaving={isSavingFolder}
              onClose={() => setIsCreateDialogOpen(false)}
              onSubmit={handleCreateFolder}
            />

            {/* Footer */}
            <div className="mobile-drawer-footer">
              <button
                type="button"
                className="mobile-drawer-create-btn"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus size={17} />
                <span>Create Notebook</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileDrawer;
