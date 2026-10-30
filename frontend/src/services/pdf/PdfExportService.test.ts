/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { NoteExportDocumentBuilder } from "./NoteExportDocumentBuilder";
import { NoteImageResolver } from "./NoteImageResolver";

describe("NoteExportDocumentBuilder", () => {
  it("builds an isolated export document with proper typography and title", async () => {
    const note = {
      title: "My Architecture Note",
      content: "<h1>Overview</h1><p>This is a paragraph.</p><blockquote>Important quote</blockquote>",
      updatedAt: "2026-10-30T00:00:00.000Z",
    };

    const prepared = await NoteExportDocumentBuilder.build(note);
    expect(prepared.element).toBeDefined();
    expect(prepared.element.innerHTML).toContain("My Architecture Note");
    expect(prepared.element.innerHTML).toContain("Overview");
    expect(prepared.element.innerHTML).toContain("Important quote");

    prepared.cleanup();
  });

  it("removes interactive editor buttons from the export document", async () => {
    const note = {
      title: "Note with UI chrome",
      content: '<p>Content</p><button class="delete-img">Delete</button>',
    };

    const prepared = await NoteExportDocumentBuilder.build(note);
    expect(prepared.element.querySelector("button")).toBeNull();
    prepared.cleanup();
  });
});

describe("NoteImageResolver", () => {
  it("keeps valid data:image URLs intact", async () => {
    const container = document.createElement("div");
    const validDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    container.innerHTML = `<img src="${validDataUrl}" alt="Test" />`;

    const stats = await NoteImageResolver.resolveAll(container);
    expect(stats.totalImages).toBe(1);
    expect(stats.resolvedImages).toBe(1);
    expect(stats.missingImages.length).toBe(0);

    const img = container.querySelector("img");
    expect(img?.src).toContain("data:image/png;base64");
  });

  it("replaces unavailable or invalid remote URLs with graceful placeholders", async () => {
    const container = document.createElement("div");
    container.innerHTML = `<img src="https://invalid-domain-non-existent-xyz.com/image.png" alt="Broken Diagram" />`;

    const stats = await NoteImageResolver.resolveAll(container);
    expect(stats.totalImages).toBe(1);
    expect(stats.missingImages.length).toBe(1);

    // The <img> should be replaced by the placeholder <div>
    expect(container.querySelector("img")).toBeNull();
    const placeholder = container.querySelector(".pdf-image-fallback");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain("[Image unavailable during export]");
    expect(placeholder?.textContent).toContain("Broken Diagram");
  });
});
