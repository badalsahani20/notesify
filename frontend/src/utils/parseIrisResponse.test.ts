import { describe, it, expect } from "vitest";
import { parseIrisResponse } from "../utils/parseIrisResponse";

// ─── Helper ───────────────────────────────────────────────────────────────────
const mermaidViz = (data: string, title = "Test Diagram") =>
  `[IRIS_VIZ type="mermaid" title="${title}"]${data}[/IRIS_VIZ]`;

// ─── parseIrisResponse — Mermaid block parsing ────────────────────────────────

describe("parseIrisResponse — mermaid viz block", () => {
  it("parses a complete mermaid block into a viz segment", () => {
    const code = "graph TD\n  A --> B";
    const segments = parseIrisResponse(mermaidViz(code));

    const viz = segments.find((s) => s.kind === "viz");
    expect(viz).toBeDefined();
    expect(viz?.kind).toBe("viz");
    if (viz?.kind === "viz") {
      expect(viz.type).toBe("mermaid");
      expect(viz.data).toBe(code.trim());
      expect(viz.isStreaming).toBeFalsy();
    }
  });

  it("treats an unclosed [IRIS_VIZ] block as streaming", () => {
    const partial = '[IRIS_VIZ type="mermaid" title="Live"]graph TD\n  A --> B';
    const segments = parseIrisResponse(partial);

    const viz = segments.find((s) => s.kind === "viz");
    expect(viz?.kind).toBe("viz");
    if (viz?.kind === "viz") {
      expect(viz.isStreaming).toBe(true);
    }
  });

  it("normalises xychart-beta type to mermaid", () => {
    const block = '[IRIS_VIZ type="xychart-beta" title="Chart"]xychart-beta\n  title "Sales"\n[/IRIS_VIZ]';
    const segments = parseIrisResponse(block);

    const viz = segments.find((s) => s.kind === "viz");
    if (viz?.kind === "viz") {
      expect(viz.type).toBe("mermaid");
    }
  });

  it("parses legacy colon-format: [IRIS_VIZ:mermaid:Title]", () => {
    const block = "[IRIS_VIZ:mermaid:My Flow]graph LR\n  A --> B[/IRIS_VIZ]";
    const segments = parseIrisResponse(block);

    const viz = segments.find((s) => s.kind === "viz");
    expect(viz?.kind).toBe("viz");
    if (viz?.kind === "viz") {
      expect(viz.type).toBe("mermaid");
      expect(viz.title).toBe("My Flow");
    }
  });

  it("preserves surrounding text as a text segment", () => {
    const code = "graph TD\n  A --> B";
    const input = `Here is a diagram:\n${mermaidViz(code)}\nEnd of message.`;
    const segments = parseIrisResponse(input);

    const kinds = segments.map((s) => s.kind);
    expect(kinds).toContain("text");
    expect(kinds).toContain("viz");

    const textBefore = segments.find(
      (s) => s.kind === "text" && s.kind === "text" && s.content?.includes("Here is a diagram")
    );
    expect(textBefore).toBeDefined();
  });

  it("parses multiple mermaid blocks in one response", () => {
    const input = [
      mermaidViz("graph TD\n  A --> B", "Flow 1"),
      "Some text between",
      mermaidViz("sequenceDiagram\n  A->>B: Hello", "Seq 1"),
    ].join("\n");

    const segments = parseIrisResponse(input);
    const vizSegments = segments.filter((s) => s.kind === "viz");
    expect(vizSegments.length).toBe(2);
  });

  it("returns a text segment for a response with no viz blocks", () => {
    const input = "This is a plain response with no diagrams.";
    const segments = parseIrisResponse(input);

    expect(segments.length).toBe(1);
    expect(segments[0].kind).toBe("text");
    if (segments[0].kind === "text") {
      expect(segments[0].content).toBe(input);
    }
  });

  it("handles empty IRIS_VIZ data gracefully", () => {
    const block = '[IRIS_VIZ type="mermaid" title="Empty"][/IRIS_VIZ]';
    const segments = parseIrisResponse(block);

    const viz = segments.find((s) => s.kind === "viz");
    if (viz?.kind === "viz") {
      expect(viz.data).toBe("");
    }
  });

  it("uses 'Visualization' as fallback title when title is missing", () => {
    const block = `[IRIS_VIZ type="mermaid" title=""]graph TD\n  A --> B[/IRIS_VIZ]`;
    const segments = parseIrisResponse(block);

    const viz = segments.find((s) => s.kind === "viz");
    if (viz?.kind === "viz") {
      expect(viz.title).toBe("Visualization");
    }
  });

  it("streaming block contains the partial diagram data so far", () => {
    // Simulates a mid-stream state: block is open, LLM has emitted partial code
    const partialCode = "graph TD\n  A --> B\n  B --> ";
    const partial = `[IRIS_VIZ type="mermaid" title="Partial"]${partialCode}`;
    const segments = parseIrisResponse(partial);

    const viz = segments.find((s) => s.kind === "viz");
    if (viz?.kind === "viz") {
      expect(viz.isStreaming).toBe(true);
      expect(viz.data).toContain("graph TD");
    }
  });

  it("does not produce a viz segment for a completely closed block mistyped as text", () => {
    // This is just regular text that looks like mermaid — no IRIS_VIZ wrapper
    const input = "graph TD\n  A --> B\n  B --> C";
    const segments = parseIrisResponse(input);

    const viz = segments.find((s) => s.kind === "viz");
    expect(viz).toBeUndefined();
    expect(segments[0].kind).toBe("text");
  });
});
