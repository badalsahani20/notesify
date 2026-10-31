import { Plus } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePanelStore } from "@/store/usePanelStore";

const MobileCreateButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { folderId } = useParams();
  const { isMobileDrawerOpen, isAiPanelOpen } = usePanelStore();

  const hideOnRoute =
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/trash") ||
    location.pathname.startsWith("/chat");

  if (hideOnRoute || isMobileDrawerOpen || isAiPanelOpen) return null;

  const handleCreateNote = () => {
    const targetFolderId = folderId || null;
    navigate(targetFolderId ? `/folders/${targetFolderId}/note/new` : `/note/new`);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCreateNote()}
      className="mobile-create-button z-40 md:hidden"
      aria-label="Create note"
      title="Create note"
    >
      <Plus size={26} />
    </button>
  );
};

export default MobileCreateButton;
