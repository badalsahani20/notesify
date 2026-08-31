import { create } from "zustand";

interface PanelState {
  /** Whether the folder tree panel is open (desktop only).
   *  Hidden by default; toggled by the Folder icon in the activity bar. */
  isFolderPanelOpen: boolean;
  toggleFolderPanel: () => void;
  openFolderPanel: () => void;
  closeFolderPanel: () => void;

  /** Mobile-only side drawer (navigation). */
  isMobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;

  /** Editor AI Assistant panel. */
  isAiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;

  /** Global Search Command Palette modal. */
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  isFolderPanelOpen: false,
  toggleFolderPanel: () =>
    set((s) => ({ isFolderPanelOpen: !s.isFolderPanelOpen })),
  openFolderPanel: () => set({ isFolderPanelOpen: true }),
  closeFolderPanel: () => set({ isFolderPanelOpen: false }),

  isMobileDrawerOpen: false,
  setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

  isAiPanelOpen: false,
  setAiPanelOpen: (open) => set({ isAiPanelOpen: open }),

  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
}));
