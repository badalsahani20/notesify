import { create } from "zustand";
import { isDesktopApp } from "@/lib/desktop";
import { CURRENT_VERSION } from "@/hooks/user/useWhatsNew";
import {
  fetchLatestRelease,
  compareSemver,
  getInstalledAppVersion,
  triggerNativeNotification,
  openExternalUrl,
  type UpdateInfo,
} from "@/services/desktopUpdateService";

interface DesktopUpdateState {
  status: "idle" | "checking" | "available" | "up-to-date" | "error";
  latestRelease: UpdateInfo | null;
  dismissedVersion: string | null;
  currentVersion: string;
  lastChecked: number | null;
  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: () => void;
  openDownload: () => void;
  openReleaseNotes: () => void;
}

const STORAGE_KEY = "notesify_dismissed_update_version";

export const useDesktopUpdateStore = create<DesktopUpdateState>((set, get) => ({
  status: "idle",
  latestRelease: null,
  dismissedVersion:
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  currentVersion: CURRENT_VERSION,
  lastChecked: null,

  checkForUpdates: async (force = false) => {
    // Only automatically ping in desktop or when explicitly forced by user click
    if (!force && !isDesktopApp()) return;

    // Avoid checking too frequently (min 15 min throttle unless forced)
    const now = Date.now();
    const lastChecked = get().lastChecked;
    if (
      !force &&
      lastChecked &&
      now - lastChecked < 15 * 60 * 1000 &&
      get().status !== "idle"
    ) {
      return;
    }

    set({ status: "checking" });

    const activeVersion = await getInstalledAppVersion(CURRENT_VERSION);
    set({ currentVersion: activeVersion });

    const release = await fetchLatestRelease();
    if (!release) {
      set({ status: "error", lastChecked: now, currentVersion: activeVersion });
      return;
    }

    const hasUpdate = compareSemver(release.version, activeVersion) > 0;

    if (hasUpdate) {
      set({
        status: "available",
        latestRelease: release,
        currentVersion: activeVersion,
        lastChecked: now,
      });

      // Trigger native OS notification if not already dismissed for this version
      const dismissed = get().dismissedVersion;
      if (dismissed !== release.version && isDesktopApp()) {
        triggerNativeNotification(release);
      }
    } else {
      set({
        status: "up-to-date",
        latestRelease: release,
        currentVersion: activeVersion,
        lastChecked: now,
      });
    }
  },

  dismissUpdate: () => {
    const release = get().latestRelease;
    if (release) {
      try {
        localStorage.setItem(STORAGE_KEY, release.version);
      } catch {
        /* storage might be restricted */
      }
      set({ dismissedVersion: release.version });
    }
  },

  openDownload: () => {
    const release = get().latestRelease;
    if (release?.downloadUrl) {
      openExternalUrl(release.downloadUrl);
    }
  },

  openReleaseNotes: () => {
    const release = get().latestRelease;
    if (release?.htmlUrl) {
      openExternalUrl(release.htmlUrl);
    }
  },
}));
