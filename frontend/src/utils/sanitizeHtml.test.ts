// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeNoteHtml } from "./sanitizeHtml";

describe("sanitizeNoteHtml", () => {
  it("removes script tags and inline event handlers", () => {
    const clean = sanitizeNoteHtml(
      '<p>Hello</p><script>alert(1)</script><img src="x" onerror="alert(2)">',
    );

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("<p>Hello</p>");
  });

  it("blocks javascript: and data: URLs while keeping ordinary links", () => {
    const clean = sanitizeNoteHtml(
      '<a href="javascript:alert(1)">bad</a><a href="data:text/html,<script>x</script>">bad</a><a href="/notes">ok</a>',
    );

    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("data:text/html");
    expect(clean).toContain('href="/notes"');
  });

  it("removes frames, plugins, forms, styles and style attributes", () => {
    const clean = sanitizeNoteHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object>' +
        '<form action="https://evil.example"><input name="q"></form>' +
        '<style>body{display:none}</style><p style="position:fixed">text</p>',
    );

    expect(clean).not.toMatch(/<(iframe|object|form|style)/i);
    expect(clean).not.toContain("style=");
    expect(clean).toContain("text");
  });

  it("keeps safe note markup, data attributes and data images", () => {
    const clean = sanitizeNoteHtml(
      '<h2>Title</h2><ul><li data-type="taskItem">Item</li></ul>' +
        '<table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>' +
        '<img src="data:image/png;base64,AAAA" alt="dot">',
    );

    expect(clean).toContain("<h2>Title</h2>");
    expect(clean).toContain('data-type="taskItem"');
    expect(clean).toContain('colspan="2"');
    expect(clean).toContain("data:image/png;base64,AAAA");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeNoteHtml("")).toBe("");
  });
});
