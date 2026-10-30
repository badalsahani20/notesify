// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IrisMarkdownRenderer } from "./IrisMarkdownRenderer";

describe("IrisMarkdownRenderer sanitization", () => {
  it("strips raw HTML event handlers and scripts from model output", () => {
    const html = renderToStaticMarkup(
      <IrisMarkdownRenderer
        content={'<img src="x" onerror="alert(1)">\n\n<script>alert(2)</script>\n\n**safe**'}
      />,
    );

    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).toContain("<strong>safe</strong>");
  });

  it("preserves Iris directive elements and their data attributes", () => {
    const html = renderToStaticMarkup(
      <IrisMarkdownRenderer
        content={'<iris-callout data-variant="warning" data-title="Watch out">Body</iris-callout>'}
      />,
    );

    expect(html).toContain("Watch out");
    expect(html).toContain("Body");
  });

  it("drops javascript: links but keeps ordinary links", () => {
    const html = renderToStaticMarkup(
      <IrisMarkdownRenderer content={'[bad](javascript:alert(1)) [good](https://notesify.in)'} />,
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://notesify.in");
  });

  it("still renders math and GFM tables after sanitizing", () => {
    const html = renderToStaticMarkup(
      <IrisMarkdownRenderer
        content={'$E=mc^2$\n\n| A | B |\n| - | - |\n| 1 | 2 |'}
      />,
    );

    expect(html).toContain("katex");
    expect(html).toContain("<table");
    expect(html).toContain("<td>1</td>");
  });
});
