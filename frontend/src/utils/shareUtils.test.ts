import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPublicAppBaseUrl, getNoteShareUrl } from "./shareUtils";

describe("shareUtils", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      location: {
        protocol: "file:",
        origin: "file://",
        href: "file:///C:/app/index.html",
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("should return public HTTPS URL when running under file: protocol (packaged Electron)", () => {
    expect(getPublicAppBaseUrl()).toBe("https://app.notesify.in");
    expect(getNoteShareUrl("test-slug-123")).toBe("https://app.notesify.in/shared/test-slug-123");
  });

  it("should return public HTTPS URL when electronAPI is defined and origin is null/file", () => {
    (globalThis as any).window.electronAPI = { isElectron: true };
    (globalThis as any).window.location = {
      protocol: "file:",
      origin: "null",
      href: "file:///C:/app/index.html",
    };

    expect(getNoteShareUrl("desktop-slug-abc")).toBe("https://app.notesify.in/shared/desktop-slug-abc");
  });

  it("should return http origin when running in browser on localhost", () => {
    (globalThis as any).window.location = {
      protocol: "http:",
      origin: "http://localhost:5173",
      href: "http://localhost:5173",
    };

    expect(getNoteShareUrl("my-slug")).toBe("http://localhost:5173/shared/my-slug");
  });

  it("should return empty string if no share slug provided", () => {
    expect(getNoteShareUrl("")).toBe("");
    expect(getNoteShareUrl(null)).toBe("");
    expect(getNoteShareUrl(undefined)).toBe("");
  });
});
