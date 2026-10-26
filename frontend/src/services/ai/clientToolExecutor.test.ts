import { describe, it, expect } from "vitest";
import { combineNoteContent, replaceTargetInHtml, ensureBlockHtml } from "./clientToolExecutor";

describe("clientToolExecutor — combineNoteContent & replaceTargetInHtml", () => {
  it("replaces exact target in simple HTML", () => {
    const existing = "<p>Introduction</p><p>4.2 Chain of Thought (CoT) The model generates intermediate reasoning steps.</p><p>Conclusion</p>";
    const target = "4.2 Chain of Thought (CoT) The model generates intermediate reasoning steps.";
    const replacement = "<p>4.2 Chain of Thought (CoT) updated reasoning process.</p>";

    const result = combineNoteContent(existing, "", "replace_target", target, replacement);
    expect(result).toContain("updated reasoning process");
    expect(result).not.toContain("intermediate reasoning steps");
    expect(result).toContain("<p>Introduction</p>");
    expect(result).toContain("<p>Conclusion</p>");
  });

  it("replaces target spanning across heading and paragraph tags", () => {
    const existing = "<h3>4.2 Chain of Thought (CoT)</h3>\n<p>The model generates intermediate reasoning steps.</p>";
    const target = "4.2 Chain of Thought (CoT) The model generates intermediate reasoning steps.";
    const replacement = "<h3>4.2 Chain of Thought (CoT)</h3>\n<p>Replaced content with deep reasoning.</p>";

    const result = combineNoteContent(existing, "", "replace_target", target, replacement);
    expect(result).toContain("Replaced content with deep reasoning");
    expect(result).not.toContain("intermediate reasoning steps");
  });

  it("replaces target containing inline formatting like strong or em", () => {
    const existing = "<p><strong>4.2 Chain of Thought (CoT)</strong> The model generates intermediate reasoning steps.</p>";
    const target = "4.2 Chain of Thought (CoT) The model generates intermediate reasoning steps.";
    const replacement = "<p>Updated entire paragraph cleanly.</p>";

    const result = combineNoteContent(existing, "", "replace_target", target, replacement);
    expect(result).toContain("Updated entire paragraph cleanly");
    expect(result).not.toContain("intermediate reasoning steps");
  });

  it("handles markdown markers in targetContent gracefully", () => {
    const existing = "<h3>4.2 Chain of Thought (CoT)</h3><p>The model generates intermediate reasoning steps.</p>";
    const target = "### 4.2 Chain of Thought (CoT)\nThe model generates intermediate reasoning steps.";
    const replacement = "<p>Replaced successfully.</p>";

    const result = combineNoteContent(existing, "", "replace_target", target, replacement);
    expect(result).toContain("Replaced successfully");
  });

  it("safely falls back to appending if target is completely absent without throwing a fatal crash", () => {
    const existing = "<p>Original document content.</p>";
    const target = "Completely non-existent section";
    const replacement = "<p>Appended section content.</p>";

    const result = combineNoteContent(existing, "", "replace_target", target, replacement);
    expect(result).toContain("<p>Original document content.</p>");
    expect(result).toContain("<p>Appended section content.</p>");
  });

  it("appends by default when no targetContent is provided", () => {
    const existing = "<p>First paragraph.</p>";
    const newContent = "Second paragraph.";

    const result = combineNoteContent(existing, newContent, "append");
    expect(result).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
  });

  it("surgically replaces a block by blockId (Option 2 - Gold Standard)", () => {
    const existing = '<h3 data-block-id="b_heading1">4.2 Chain of Thought (CoT)</h3><p data-block-id="b_para1">The model generates intermediate reasoning steps.</p><p data-block-id="b_para2">Next concept.</p>';
    const replacement = '<p data-block-id="b_para1">Surgically updated reasoning paragraph.</p>';

    const result = combineNoteContent(existing, "", "replace_target", undefined, replacement, "b_para1");
    expect(result).toContain("Surgically updated reasoning paragraph");
    expect(result).not.toContain("intermediate reasoning steps");
    expect(result).toContain('data-block-id="b_heading1"');
    expect(result).toContain('data-block-id="b_para2"');
  });

  it("prioritizes blockId over targetContent when both are provided", () => {
    const existing = '<p data-block-id="b_target">Old text to replace.</p><p data-block-id="b_other">Other text.</p>';
    const replacement = '<p data-block-id="b_target">New text by ID.</p>';

    const result = combineNoteContent(existing, "", "replace_target", "Other text", replacement, "b_target");
    expect(result).toContain("New text by ID.");
    expect(result).toContain("Other text.");
  });
});
