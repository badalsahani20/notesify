// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";

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

  it("falls back to execCommand and shows Copied when the Clipboard API is blocked", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MarkdownCodeBlock code="const x = 1;" language="typescript" />);
    });

    const button = container.querySelector("button.gc-code-copy") as HTMLButtonElement;
    expect(button).toBeTruthy();

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeText).toHaveBeenCalledWith("const x = 1;");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(button.getAttribute("aria-label")).toBe("Copied");

    await act(async () => root.unmount());
    container.remove();
  });
});
