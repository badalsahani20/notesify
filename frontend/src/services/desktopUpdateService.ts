export interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

export interface UpdateInfo {
  version: string;
  tagName: string;
  name: string;
  body?: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl: string;
  assetName?: string;
}

/**
 * Compare two semver strings (e.g. "1.3.1" vs "1.3.0").
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[-+]/)[0]
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const [maj1 = 0, min1 = 0, pat1 = 0] = parse(v1);
  const [maj2 = 0, min2 = 0, pat2 = 0] = parse(v2);

  if (maj1 !== maj2) return maj1 - maj2;
  if (min1 !== min2) return min1 - min2;
  return pat1 - pat2;
}

/**
 * Fetches the latest published release from GitHub Releases API.
 */
export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/badalsahani20/notesify/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) {
      console.warn("[DesktopUpdate] Failed to fetch latest release:", res.statusText);
      return null;
    }

    const data = await res.json();
    const tagName = data.tag_name || "";
    const version = tagName.replace(/^v/i, "");

    // Look for Windows installer exe in release assets
    const exeAsset = (data.assets || []).find((a: ReleaseAsset) =>
      a.name.toLowerCase().endsWith(".exe")
    );

    const downloadUrl =
      exeAsset?.browser_download_url ||
      data.html_url ||
      `https://github.com/badalsahani20/notesify/releases/tag/${tagName}`;

    return {
      version,
      tagName,
      name: data.name || `Notesify ${tagName}`,
      body: data.body || "",
      publishedAt: data.published_at || "",
      htmlUrl: data.html_url || "",
      downloadUrl,
      assetName: exeAsset?.name,
    };
  } catch (err) {
    console.error("[DesktopUpdate] Error checking for updates:", err);
    return null;
  }
}

interface ElectronWindow extends Window {
  electronAPI?: {
    getAppVersion?: () => Promise<string>;
    auth?: {
      openExternal?: (url: string) => Promise<void>;
    };
  };
}

/**
 * Retrieves the currently running application version.
 */
export async function getInstalledAppVersion(fallbackVersion = "1.3.1"): Promise<string> {
  if (typeof window !== "undefined") {
    const win = window as unknown as ElectronWindow;
    if (win.electronAPI?.getAppVersion) {
      try {
        const nativeVer = await win.electronAPI.getAppVersion();
        if (nativeVer && typeof nativeVer === "string") {
          return nativeVer.replace(/^v/i, "").trim();
        }
      } catch (err) {
        console.warn("[DesktopUpdate] Failed to get app version from Electron:", err);
      }
    }
  }
  return fallbackVersion;
}

/**
 * Safely opens an external link in the user's default OS browser.
 */
export function openExternalUrl(url: string) {
  if (typeof window !== "undefined") {
    const win = window as unknown as ElectronWindow;
    if (win.electronAPI?.auth?.openExternal) {
      void win.electronAPI.auth.openExternal(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Triggers a native desktop OS notification if permissions allow.
 */
export function triggerNativeNotification(update: UpdateInfo) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const showNotification = () => {
    try {
      const notif = new Notification("Notesify Update Available 🚀", {
        body: `Version ${update.version} is now available. Click to download.`,
        silent: false,
      });
      notif.onclick = () => {
        window.focus();
        openExternalUrl(update.downloadUrl);
      };
    } catch (e) {
      console.warn("[DesktopUpdate] Native notification error:", e);
    }
  };

  if (Notification.permission === "granted") {
    showNotification();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") showNotification();
    });
  }
}
