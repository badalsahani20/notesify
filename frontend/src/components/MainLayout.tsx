import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import FoldersPanel from "./folders/FolderPanel";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import AppHeader from "./header/AppHeader";
import MobileDrawer from "./header/MobileDrawer";
import AppLayout from "./AppLayout";
import { useNotesLayout } from "@/hooks/notes/useNotesLayout";
import ActivityBar from "./header/SideBar";
import { useFolderStore } from "@/store/useFolderStore";
import { usePanelStore } from "@/store/usePanelStore";
import { WhatsNewModal } from "@/components/ui/WhatsNewModal";
import { useWhatsNew } from "@/hooks/user/useWhatsNew";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useSettingsUIStore } from "@/store/useSettingsStore";

type Pops = {
  middlePanel: React.ReactNode;
}
const MainLayout = ({ middlePanel }: Pops) => {
  const { isOpen: isWhatsNewOpen, dismiss: dismissWhatsNew } = useWhatsNew();
  const { settingsOpen, closeSettings } = useSettingsUIStore();
  const bootstrapStartedRef = useRef(false);
  const {
    showGlobalHeader,
    showFoldersPanel,
    showNotesPanel,
    showMainPanel,
    isMobile,
    animationKey,
    isNoteEditor,
    isFolderWorkspace,
  } = useNotesLayout();
  const { fetchFolders } = useFolderStore();
  const { isMobileDrawerOpen, setMobileDrawerOpen } = usePanelStore();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;
    void fetchFolders();
  }, [fetchFolders]);

  const onToggleTheme = (event: React.MouseEvent) => {
    const isDark = theme === "dark";
    const nextTheme = isDark ? "light" : "dark";

    // Fallback if view transition is not supported
    if (!(document as any).startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      document.documentElement.classList.add("theme-transitioning");
      setTheme(nextTheme);
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove("theme-transitioning");
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return (
    <>
      <AppLayout
        showGlobalHeader={showGlobalHeader}
        showFoldersPanel={showFoldersPanel}
        showNotesPanel={showNotesPanel}
        showMainPanel={showMainPanel}
        isMobile={isMobile}
        animationKey={animationKey}
        isNoteEditor={isNoteEditor}
        
        header={
          <AppHeader
            theme={theme}
            onToggleTheme={onToggleTheme}
            onMenuOpen={isMobile ? () => setMobileDrawerOpen(true) : undefined}
          />
        }
        activityBar={
          <ActivityBar />
        }
        leftPanel={
          isMobile ? (
            <ErrorBoundary fallbackTitle="Notebook panel error">
              <FoldersPanel />
            </ErrorBoundary>
          ) : null
        }

        middlePanel={
          <ErrorBoundary fallbackTitle="Side panel error">
            {isFolderWorkspace ? <FoldersPanel /> : middlePanel}
          </ErrorBoundary>
        }
        main={
          <ErrorBoundary fallbackTitle="Workspace error">
            <Outlet />
          </ErrorBoundary>
        }
      />
      {isMobile && (
        <MobileDrawer open={isMobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />
      )}
      <WhatsNewModal isOpen={isWhatsNewOpen} onDismiss={dismissWhatsNew} />
      <SettingsDialog open={settingsOpen} onOpenChange={(v) => !v && closeSettings()} />
    </>
  );
};

export default MainLayout;
