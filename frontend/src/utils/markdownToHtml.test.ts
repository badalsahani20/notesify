import { describe, it, expect } from "vitest";
import { markdownToHtml } from "./markdownToHtml";

describe("markdownToHtml", () => {
  it("should parse basic paragraphs (single line lacks <p> wrapper)", () => {
    const md = "Hello world";
    const html = markdownToHtml(md);
    expect(html).toBe("Hello world");
  });

  it("should parse inline formatting (bold, italic, inline code)", () => {
    const md = "This is **bold**, *italic*, and `code`.";
    const html = markdownToHtml(md);
    expect(html).toBe("This is <strong>bold</strong>, <em>italic</em>, and <code>code</code>.");
  });

  it("should parse basic unordered lists", () => {
    const md = "- Item 1\n- Item 2";
    const html = markdownToHtml(md);
    expect(html).toBe("<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>");
  });

  it("should parse basic ordered lists", () => {
    const md = "1. First\n2. Second";
    const html = markdownToHtml(md);
    expect(html).toBe("<ol><li><p>First</p></li><li><p>Second</p></li></ol>");
  });

  it("should parse fenced code blocks", () => {
    const md = "```javascript\nconst x = 1;\n```";
    const html = markdownToHtml(md);
    expect(html).toBe('<pre><code class="language-javascript">const x = 1;</code></pre>');
  });

  it("should parse code blocks immediately following an unordered list (no blank line)", () => {
    const md = "- Item 1\n```javascript\nconst x = 1;\n```";
    const html = markdownToHtml(md);
    // The list should be closed BEFORE the code block starts
    expect(html).toBe('<ul><li><p>Item 1</p></li></ul><pre><code class="language-javascript">const x = 1;</code></pre>');
  });

  it("should parse task lists", () => {
    const md = "- [ ] Incomplete\n- [x] Complete";
    const html = markdownToHtml(md);
    expect(html).toBe('<ul><li data-type="taskItem"><p>Incomplete</p></li><li data-type="taskItem" data-checked="true"><p>Complete</p></li></ul>');
  });

  it("should parse horizontal rules", () => {
    const md = "---";
    const html = markdownToHtml(md);
    expect(html).toBe("<hr>");
  });

  it("should parse blockquotes", () => {
    const md = "> This is a quote";
    const html = markdownToHtml(md);
    expect(html).toBe("<blockquote><p>This is a quote</p></blockquote>");
  });

  it("should parse markdown tables", () => {
    const md = "| Col1 | Col2 |\n| --- | --- |\n| Val1 | Val2 |";
    const html = markdownToHtml(md);
    expect(html).toBe("<table><tr><th>Col1</th><th>Col2</th></tr><tr><td>Val1</td><td>Val2</td></tr></table>");
  });

  it("should discard empty placeholder tables", () => {
    const md = "|   |   |\n| --- | --- |\n|   |   |";
    const html = markdownToHtml(md);
    expect(html).not.toContain("<table>");
  });

  it("should not treat a horizontal rule following a pipe character as a table", () => {
    const md = "Option A | Option B\n---";
    const html = markdownToHtml(md);
    expect(html).not.toContain("<table>");
    expect(html).toContain("<hr>");
  });

  it("should parse links", () => {
    const md = "Check [Google](https://google.com)";
    const html = markdownToHtml(md);
    expect(html).toBe('Check <a href="https://google.com">Google</a>');
  });
});
