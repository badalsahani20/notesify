// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./IrisVisualBlock", () => ({
  default: ({ visualization }: { visualization: Record<string, unknown> }) => (
    <div
      data-testid="viz"
      data-type={String(visualization.type)}
      data-streaming={String(Boolean(visualization.isStreaming))}
    />
  ),
}));

import MarkdownCodeBlock from "./MarkdownCodeBlock";
import ComparisonCardBlock from "./viz/ComparisonCardBlock";
import SpecSheetBlock from "./viz/SpecSheetBlock";

describe("MarkdownCodeBlock routing", () => {
  it("renders a mermaid diagram via IrisVisualBlock", () => {
    const html = renderToStaticMarkup(
      <MarkdownCodeBlock code="graph TD\n  A --> B" language="mermaid" />,
    );

    expect(html).toContain('data-type="mermaid"');
    expect(html).toContain('data-streaming="false"');
  });

  it("handles streaming mermaid diagrams", () => {
    const html = renderToStaticMarkup(
      <MarkdownCodeBlock code="%%iris-streaming-diagram" language="mermaid" isStreaming />,
    );

    expect(html).toContain('data-type="mermaid"');
    expect(html).toContain('data-streaming="true"');
  });

  it("renders normal code block for other languages", () => {
    const html = renderToStaticMarkup(
      <MarkdownCodeBlock code="const x = 1;" language="typescript" />,
    );

    expect(html).toContain("gc-code-block");
    expect(html).toContain("TYPESCRIPT");
  });

  it("renders ComparisonCardBlock directly", () => {
    const cardData = JSON.stringify({
      traitLabels: ["Speed"],
      options: [{ id: "opt1", name: "Option 1", headline: "Fast", traits: ["10x"] }],
      recommendedId: "opt1",
      reason: "Faster execution",
    });
    const html = renderToStaticMarkup(
      <ComparisonCardBlock data={cardData} />,
    );

    expect(html).toContain("Option 1");
    expect(html).toContain("Faster execution");
  });

  it("renders SpecSheetBlock directly", () => {
    const specData = JSON.stringify({
      title: "Device Specs",
      rows: [{ label: "RAM", value: "16 GB", emphasis: true }],
    });
    const html = renderToStaticMarkup(
      <SpecSheetBlock data={specData} />,
    );

    expect(html).toContain("Device Specs");
    expect(html).toContain("16 GB");
  });
});
