import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compareSemver, getInstalledAppVersion } from "./desktopUpdateService";

describe("desktopUpdateService", () => {
  describe("compareSemver", () => {
    it("should return 0 for identical versions", () => {
      expect(compareSemver("1.3.1", "1.3.1")).toBe(0);
      expect(compareSemver("v1.3.1", "1.3.1")).toBe(0);
      expect(compareSemver("1.3.1-beta.1", "1.3.1")).toBe(0);
    });

    it("should return > 0 when v1 is newer than v2", () => {
      expect(compareSemver("1.3.1", "1.3.0")).toBeGreaterThan(0);
      expect(compareSemver("1.4.0", "1.3.9")).toBeGreaterThan(0);
      expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
    });

    it("should return < 0 when v1 is older than v2", () => {
      expect(compareSemver("1.3.0", "1.3.1")).toBeLessThan(0);
      expect(compareSemver("1.2.9", "1.3.0")).toBeLessThan(0);
    });
  });

  describe("getInstalledAppVersion", () => {
    beforeEach(() => {
      (globalThis as any).window = {};
    });

    afterEach(() => {
      delete (globalThis as any).window;
    });

    it("should return fallback when electronAPI is absent", async () => {
      const ver = await getInstalledAppVersion("1.3.1");
      expect(ver).toBe("1.3.1");
    });

    it("should return native version when electronAPI is available", async () => {
      (globalThis as any).window.electronAPI = {
        getAppVersion: vi.fn().mockResolvedValue("1.3.1"),
      };
      const ver = await getInstalledAppVersion("1.3.0");
      expect(ver).toBe("1.3.1");
    });
  });
});
