import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useDefaultLayout } from "react-resizable-panels";
import { usePanelStore } from "@/store/usePanelStore";

import MobileCreateButton from "./header/MobileCreateButton";

const panelEase = [0.22, 1, 0.36, 1] as const;

type Props = {
  showGlobalHeader: boolean;
  showFoldersPanel: boolean;
  showNotesPanel: boolean;
  showMainPanel: boolean;
  isMobile: boolean;

  header: React.ReactNode;
  activityBar: React.ReactNode;
  leftPanel: React.ReactNode;
  middlePanel: React.ReactNode;
  main: React.ReactNode;

  animationKey: string;
  isNoteEditor: boolean;
}

const AppLayout = ({
  showGlobalHeader, activityBar, showFoldersPanel, showNotesPanel,
  showMainPanel, isMobile, header, leftPanel, middlePanel, main,
  animationKey, isNoteEditor
}: Props) => {
  const foldersPanelRef = useRef<PanelImperativeHandle | null>(null);
  const notesPanelRef = useRef<PanelImperativeHandle | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const closeFolderPanel = usePanelStore((state) => state.closeFolderPanel);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "notesify-layout-v1" });

  // Handle smooth transition when toggling panels
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 450);
    return () => clearTimeout(timer);
  }, [showNotesPanel, showFoldersPanel]);

  // Folders panel: toggle open/close based on store state
  useEffect(() => {
    if (isMobile) return;
    const panel = foldersPanelRef.current;
    if (!panel) return;
    if (showFoldersPanel) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [showFoldersPanel, isMobile]);

  // Notes panel: collapse in focus=2 mode, expand otherwise
  useEffect(() => {
    if (isMobile) return;
    const panel = notesPanelRef.current;
    if (!panel) return;
    if (showNotesPanel) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [showNotesPanel, isMobile]);

  // Guard: if URL says panel should be visible but user dragged it to 0,
  // re-expand on next render (catches navigation after manual collapse)
  useEffect(() => {
    if (isMobile) return;
    const np = notesPanelRef.current;
    if (np && showNotesPanel && np.isCollapsed()) np.expand();
    const fp = foldersPanelRef.current;
    if (fp && showFoldersPanel && fp.isCollapsed()) fp.expand();
  }); // no deps — intentional

  useEffect(() => {
    if (isMobile || !showFoldersPanel) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(".folders-drawer-desktop") ||
        // A native drag starts with pointerdown. Keep the drawer mounted so
        // the drag can travel from a note card to a folder drop target.
        target?.closest("[draggable='true']") ||
        target?.closest(".nav-action-btn") ||
        target?.closest("[data-radix-popper-content-wrapper]") ||
        target?.closest("[data-slot='dialog-overlay']") ||
        target?.closest("[data-slot='dialog-content']")
      ) {
        return;
      }

      closeFolderPanel();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeFolderPanel, isMobile, showFoldersPanel]);

  return (
    <div className="app-shell">
      <div className={`app-window ${isMobile ? "mobile-app-window" : ""}`}>
        <div className={`app-header-container ${!showGlobalHeader ? "header-collapsed" : ""}`}>
          {header}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {!isMobile ? activityBar : null}

          {/* ── DESKTOP: Floating Folders Drawer ── */}
          {!isMobile && (
            <AnimatePresence>
              {showFoldersPanel && (
                <motion.div
                  key="folders-drawer"
                  initial={{ x: -260, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -260, opacity: 0 }}
                  transition={{ duration: 0.38, ease: panelEase }}
                  className="folders-drawer-desktop"
                >
                  <div className="desktop-folder-column w-full h-full overflow-hidden">
                    {leftPanel}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {isMobile ? (
            /* ── MOBILE ── */
            <>
              <AnimatePresence initial={false}>
                {showFoldersPanel && (
                  <motion.div
                    key="folders"
                    initial={{ width: 0, opacity: 0, x: -24 }}
                    animate={{ width: "100%", opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: -24 }}
                    transition={{ duration: 0.34, ease: panelEase }}
                    className="h-full shrink-0 overflow-hidden"
                  >
                    <div className="desktop-folder-column w-full h-full">
                      {leftPanel}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {showNotesPanel && (
                  <motion.div
                    key="notes"
                    initial={{ width: 0, opacity: 0, x: 24 }}
                    animate={{ width: "100%", opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 24 }}
                    transition={{ duration: 0.36, ease: panelEase }}
                    className="h-full shrink-0 overflow-hidden"
                  >
                    <div className="desktop-notes-column w-full h-full">
                      {middlePanel}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {showMainPanel ? (
                <main className="desktop-main-panel flex-1 relative flex flex-col min-w-0">
                  <div
                    key={animationKey}
                    className="flex-1 h-full min-h-0 flex flex-col page-transition"
                  >
                    {main}
                  </div>
                </main>
              ) : null}
            </>
          ) : (
            /* ── DESKTOP — resizable panels ── */
            <ResizablePanelGroup
              defaultLayout={defaultLayout}
              onLayoutChanged={onLayoutChanged}
              orientation="horizontal"
              className="flex-1 overflow-hidden"
            >
              {/* Notes panel: dynamic default size to prevent layout shift on mount */}
              <ResizablePanel
                id="notes"
                defaultSize={showNotesPanel ? "25%" : "0%"}
                maxSize="30%"
                minSize="25%"
                collapsible={true}
                collapsedSize="0%"
                panelRef={notesPanelRef}
                className={isTransitioning ? "panel-transition" : ""}
              >
                <div 
                  className="desktop-notes-column w-full h-full overflow-hidden"
                  style={{ opacity: showNotesPanel ? 1 : 0 }}
                >
                  {middlePanel}
                </div>
              </ResizablePanel>

              {showNotesPanel && <ResizableHandle />}

              {/* Editor: fills remaining space. initial={false} prevents 8px shift on mount */}
              <ResizablePanel id="main" minSize="20%">
                <main className="desktop-main-panel w-full h-full relative flex flex-col min-w-0">
                  <div
                    key={animationKey}
                    className="flex-1 h-full min-h-0 flex flex-col page-transition"
                  >
                    {main}
                  </div>
                </main>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
        {!isNoteEditor && <MobileCreateButton />}
      </div>
    </div>
  );
};

export default AppLayout;
