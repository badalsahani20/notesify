// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Reasoning, ReasoningContent } from "./reasoning";

const renderThought = (text: string) =>
  renderToStaticMarkup(
    <Reasoning open>
      <ReasoningContent markdown>{text}</ReasoningContent>
    </Reasoning>,
  );

describe("ReasoningContent markdown", () => {
  it("preserves single newlines as line breaks", () => {
    const html = renderThought("Analyze the input\nDetermine the tone");

    expect(html).toContain("<br/>");
    expect(html).toContain("Analyze the input");
    expect(html).toContain("Determine the tone");
  });

  it("renders blank-line separated thoughts as paragraphs, not extra blank lines", () => {
    const html = renderThought("First paragraph\n\nSecond paragraph");

    expect(html.match(/<p>/g)).toHaveLength(2);
    // `whitespace-pre-wrap` made the renderer's inter-block newlines paint as
    // additional empty lines on top of normal paragraph margins.
    expect(html).not.toContain("whitespace-pre-wrap");
  });

  it("keeps bold emphasis in reasoning", () => {
    expect(renderThought("**Analyze the input:** resolved")).toContain(
      "<strong>Analyze the input:</strong>",
    );
  });
});
