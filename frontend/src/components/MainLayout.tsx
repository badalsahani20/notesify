import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import FoldersPanel from "./folders/FolderPanel";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import AppHeader from "./header/AppHeader";
import MobileDrawer from "./header/MobileDrawer";
import AppLayout from "./AppLayout";
import { useNotesLayout } from "@/hooks/notes/useNotesLayout";
import ActivityBar from "./header/SideBar";
import { useFolderStore } from "@/store/useFolderStore";
import { usePanelStore } from "@/store/usePanelStore";
import { useWhatsNew } from "@/hooks/user/useWhatsNew";
import { useSettingsUIStore } from "@/store/useSettingsStore";
import { DesktopUpdateToast } from "@/components/desktop/DesktopUpdateToast";
import { useDesktopUpdateStore } from "@/store/useDesktopUpdateStore";

const WhatsNewModal = lazy(() =>
  import("@/components/ui/WhatsNewModal").then((m) => ({ default: m.WhatsNewModal }))
);
const SettingsDialog = lazy(() =>
  import("@/components/settings/SettingsDialog").then((m) => ({ default: m.SettingsDialog }))
);

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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("notesify_theme");
      if (saved === "light" || saved === "dark") return saved;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("notesify_theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;
    void fetchFolders();
  }, [fetchFolders]);

  const checkForDesktopUpdates = useDesktopUpdateStore((s) => s.checkForUpdates);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for updates 4 seconds after mount to keep startup instant
    const timer = setTimeout(() => {
      void checkForDesktopUpdates(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [checkForDesktopUpdates]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/⌘ + Shift + J → Toggle full Global Iris Chat from anywhere
      if (mod && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (location.pathname.startsWith("/chat")) {
          navigate(-1);
        } else {
          const lastSession = sessionStorage.getItem("notesify_last_chat_session");
          navigate(lastSession ? `/chat/${lastSession}` : "/chat");
        }
        return;
      }

      // Ctrl/⌘ + J when NOT in a note editor → Open Global Iris Chat
      if (mod && !e.shiftKey && e.key.toLowerCase() === "j") {
        if (!isNoteEditor) {
          e.preventDefault();
          if (location.pathname.startsWith("/chat")) {
            navigate(-1);
          } else {
            const lastSession = sessionStorage.getItem("notesify_last_chat_session");
            navigate(lastSession ? `/chat/${lastSession}` : "/chat");
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [location.pathname, navigate, isNoteEditor]);

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
      {isWhatsNewOpen && (
        <Suspense fallback={null}>
          <WhatsNewModal isOpen={isWhatsNewOpen} onDismiss={dismissWhatsNew} />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog open={settingsOpen} onOpenChange={(v) => !v && closeSettings()} />
        </Suspense>
      )}
      <DesktopUpdateToast />
    </>
  );
};

export default MainLayout;
