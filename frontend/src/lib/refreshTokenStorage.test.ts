import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

const isNativePlatform = vi.hoisted(() => vi.fn(() => false));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: preferences,
}));

import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from "./refreshTokenStorage";

const nativeWindow = globalThis as typeof globalThis & {
  window?: { electronAPI?: { auth?: Record<string, unknown> } };
};

describe("refreshTokenStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePlatform.mockReturnValue(false);
    delete nativeWindow.window;
  });

  afterEach(() => {
    delete nativeWindow.window;
  });

  it("uses the Electron bridge when it is available", async () => {
    const auth = {
      getRefreshToken: vi.fn().mockResolvedValue("desktop-token"),
      setRefreshToken: vi.fn().mockResolvedValue(true),
      clearRefreshToken: vi.fn().mockResolvedValue(true),
    };
    nativeWindow.window = { electronAPI: { auth } };

    await expect(getStoredRefreshToken()).resolves.toBe("desktop-token");
    await setStoredRefreshToken("new-desktop-token");
    await clearStoredRefreshToken();

    expect(auth.setRefreshToken).toHaveBeenCalledWith("new-desktop-token");
    expect(auth.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(preferences.get).not.toHaveBeenCalled();
  });

  it("uses Capacitor Preferences on native platforms", async () => {
    isNativePlatform.mockReturnValue(true);
    preferences.get.mockResolvedValue({ value: "mobile-token" });

    await expect(getStoredRefreshToken()).resolves.toBe("mobile-token");
    await setStoredRefreshToken("new-mobile-token");
    await clearStoredRefreshToken();

    expect(preferences.get).toHaveBeenCalledWith({ key: "refreshToken" });
    expect(preferences.set).toHaveBeenCalledWith({
      key: "refreshToken",
      value: "new-mobile-token",
    });
    expect(preferences.remove).toHaveBeenCalledWith({ key: "refreshToken" });
  });

  it("returns null and does not persist anything on the web", async () => {
    await expect(getStoredRefreshToken()).resolves.toBeNull();
    await setStoredRefreshToken("web-token");
    await clearStoredRefreshToken();

    expect(preferences.get).not.toHaveBeenCalled();
    expect(preferences.set).not.toHaveBeenCalled();
    expect(preferences.remove).not.toHaveBeenCalled();
  });

  it("treats a missing native value as no token", async () => {
    isNativePlatform.mockReturnValue(true);
    preferences.get.mockResolvedValue({ value: null });

    await expect(getStoredRefreshToken()).resolves.toBeNull();
  });

  it("returns null if the Electron bridge fails to read the token", async () => {
    nativeWindow.window = {
      electronAPI: {
        auth: {
          getRefreshToken: vi.fn().mockRejectedValue(new Error("keychain locked")),
        },
      },
    };

    await expect(getStoredRefreshToken()).resolves.toBeNull();
  });
});
