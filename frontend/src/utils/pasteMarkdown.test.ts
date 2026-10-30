import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { looksLikeMarkdownDocument, shouldPasteAsCodeBlock } from "./pasteMarkdown";

const doc = readFileSync(
  new URL("../../../docs/android-webview-scroll-jank.md", import.meta.url),
  "utf8"
);

/** Approximates what a browser/chat copy gives you: rendered text, no markers. */
const asRenderedCopy = (markdown: string) =>
  markdown
    .replace(/```[a-z]*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\|/gm, "")
    .replace(/\|$/gm, "")
    .replace(/`/g, "");

const codeSnippet = `const x = 1;
function add(a, b) {
  return a + b;
}`;

describe("looksLikeMarkdownDocument", () => {
  it("recognizes a raw markdown document", () => {
    expect(looksLikeMarkdownDocument(doc)).toBe(true);
  });

  it("recognizes a rendered copy that lost its markdown markers", () => {
    expect(looksLikeMarkdownDocument(asRenderedCopy(doc))).toBe(true);
  });

  it("does not flag a code snippet", () => {
    expect(looksLikeMarkdownDocument(codeSnippet)).toBe(false);
  });

  it("does not flag a python file", () => {
    expect(
      looksLikeMarkdownDocument("# module docstring\n\ndef add(a, b):\n    return a + b\n")
    ).toBe(false);
  });
});

describe("shouldPasteAsCodeBlock", () => {
  it("never wraps a markdown document in a code block", () => {
    expect(shouldPasteAsCodeBlock(doc, "", false)).toBe(false);
    expect(shouldPasteAsCodeBlock(doc, "", true)).toBe(false);
  });

  it("never wraps a rendered copy of a document in a code block", () => {
    expect(shouldPasteAsCodeBlock(asRenderedCopy(doc), "", true)).toBe(false);
  });

  it("wraps a plain code snippet", () => {
    expect(shouldPasteAsCodeBlock(codeSnippet, "", true)).toBe(true);
  });

  it("leaves fenced markdown to the markdown path", () => {
    expect(shouldPasteAsCodeBlock("```ts\nconst x = 1;\n```", "", true)).toBe(false);
  });

  it("prefers rich HTML that already has document structure", () => {
    expect(
      shouldPasteAsCodeBlock(codeSnippet, "<h2>Title</h2><p>const x = 1;</p>", true)
    ).toBe(false);
  });
});
