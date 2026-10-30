import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";

type ElectronAuth = {
  getRefreshToken?: () => Promise<string | null>;
  setRefreshToken?: (token: string) => Promise<boolean>;
  clearRefreshToken?: () => Promise<boolean>;
};

const getElectronAuth = (): ElectronAuth | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as any).electronAPI?.auth as ElectronAuth | undefined;
};

/**
 * Reads the refresh token from the platform-specific persistent store:
 * Electron safeStorage, Capacitor Preferences, or nowhere on the web.
 */
export const getStoredRefreshToken = async (): Promise<string | null> => {
  const electronAuth = getElectronAuth();
  if (electronAuth?.getRefreshToken) {
    try {
      return await electronAuth.getRefreshToken();
    } catch (error) {
      console.error("[Auth] Failed to read the desktop refresh token:", error);
      return null;
    }
  }

  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_STORAGE_KEY });
    return value ?? null;
  }

  return null;
};

export const setStoredRefreshToken = async (token: string): Promise<void> => {
  const electronAuth = getElectronAuth();
  if (electronAuth?.setRefreshToken) {
    await electronAuth.setRefreshToken(token);
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: REFRESH_TOKEN_STORAGE_KEY, value: token });
  }
};

export const clearStoredRefreshToken = async (): Promise<void> => {
  const electronAuth = getElectronAuth();
  if (electronAuth?.clearRefreshToken) {
    await electronAuth.clearRefreshToken();
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: REFRESH_TOKEN_STORAGE_KEY });
  }
};
