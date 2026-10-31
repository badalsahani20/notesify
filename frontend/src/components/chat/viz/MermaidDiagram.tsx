import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  code: string;
}

const MERMAID_THEME_CONFIG = {
  startOnLoad: false,
  theme: "dark" as const,
  // Strict mode encodes HTML in labels and removes click handlers. Diagrams
  // come from model output, so "loose" would be an XSS vector.
  securityLevel: "strict" as const,
  suppressErrorRendering: true,
};

mermaid.initialize(MERMAID_THEME_CONFIG);

const sanitizeMermaidCode = (rawCode: string) => {
  let cleaned = rawCode
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .trim()
  // Subgraphs with spaces without quotes: subgraph Input Layer -> subgraph "Input Layer"
  cleaned = cleaned.replace(/^(\s*subgraph\s+)([^"[\n\r]+)$/gim, (_match, prefix: string, title: string) => {
    const trimmed = title.trim();
    if (trimmed.includes(" ") && !trimmed.startsWith('"') && !trimmed.startsWith("[")) {
      return `${prefix}"${trimmed}"`;
    }
    return `${prefix}${trimmed}`;
  });

  // Models sometimes emit flowchart edge labels as -->|Label|> B.
  // Mermaid expects -->|Label| B, so strip the extra chevron.
  cleaned = cleaned.replace(/\|([^|\n]+)\|>/g, "|$1| ");

  // Edge labels: quote labels containing arithmetic, parentheses, or math symbols
  cleaned = cleaned.replace(/\|([^|\n]+)\|/g, (_match, label: string) => {
    let normalizedLabel = label
      .replace(/\[([^[\]\n]+)\]/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (
      !normalizedLabel.startsWith('"') &&
      /[*()=+<>/\\^Σ₁₂₃₄₅₆₇₈₉₀-]/.test(normalizedLabel)
    ) {
      normalizedLabel = `"${normalizedLabel.replace(/"/g, "'")}"`;
    }
    return `|${normalizedLabel}|`;
  });

  // Flowchart labels with parentheses inside square brackets can trip Mermaid.
  // Convert A[Client (Browser)] into A["Client (Browser)"].
  cleaned = cleaned.replace(
    /\b([A-Za-z0-9_]+)\[([^"\]\n]*[()]+[^"\]\n]*)\]/g,
    (_match, nodeId: string, label: string) => {
      const normalizedLabel = label.replace(/"/g, "&quot;").trim();
      return `${nodeId}["${normalizedLabel}"]`;
    }
  );

  // Mermaid sequenceDiagram notes support one or two participants, not more.
  cleaned = cleaned.replace(
    /^(\s*Note\s+over\s+)([^:]+)(\s*:.*)$/gim,
    (_match, prefix: string, actors: string, suffix: string) => {
      const parts = actors
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length <= 2) return `${prefix}${actors}${suffix}`;
      return `${prefix}${parts[0]},${parts[parts.length - 1]}${suffix}`;
    }
  );

  // xychart-beta: models often emit `x-axis "Label" ["A", "B"]` which is invalid.
  // The x-axis directive only accepts the array — strip the stray quoted label.
  cleaned = cleaned.replace(
    /^(\s*x-axis\s+)"[^"]*"\s+(\[)/gim,
    "$1$2"
  );

  // xychart-beta: emojis in title lines break the Mermaid parser — strip them.
  // Handles both quoted (`title "Foo 😅"`) and unquoted (`title Foo 😅`) forms.
  cleaned = cleaned.replace(
    /^(\s*title\s+.+)$/gim,
    (match: string) => match.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{FE00}-\u{FE0F}]/gu, "").trimEnd()
  );

  return cleaned;
};

const makeSvgResponsive = (svg: string) => {
  const widthMatch = svg.match(/\bwidth="([^"]+)"/i);
  const heightMatch = svg.match(/\bheight="([^"]+)"/i);
  const viewBoxMatch = svg.match(/\bviewBox="([^"]+)"/i);

  let responsiveSvg = svg
    .replace(/\bwidth="[^"]*"/i, 'width="100%"')
    .replace(/\bheight="[^"]*"/i, 'height="100%"');

  if (!viewBoxMatch && widthMatch && heightMatch) {
    const rawWidth = Number.parseFloat(widthMatch[1]);
    const rawHeight = Number.parseFloat(heightMatch[1]);

    if (Number.isFinite(rawWidth) && Number.isFinite(rawHeight)) {
      responsiveSvg = responsiveSvg.replace(
        /<svg\b/i,
        `<svg viewBox="0 0 ${rawWidth} ${rawHeight}" preserveAspectRatio="xMidYMin meet"`
      );
    }
  } else if (viewBoxMatch && !/preserveAspectRatio=/i.test(responsiveSvg)) {
    responsiveSvg = responsiveSvg.replace(
      /<svg\b/i,
      '<svg preserveAspectRatio="xMidYMin meet"'
    );
  }

  if (!/style="/i.test(responsiveSvg)) {
    responsiveSvg = responsiveSvg.replace(
      /<svg\b/i,
      '<svg style="width:100%;height:auto;display:block;"'
    );
  } else {
    responsiveSvg = responsiveSvg.replace(
      /style="([^"]*)"/i,
      (_match, styles: string) =>
        `style="${styles};width:100%;height:auto;display:block;"`
    );
  }

  return responsiveSvg;
};

const MermaidDiagram = ({ code }: MermaidDiagramProps) => {
  const renderIdRef = useRef(0);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sanitizedCode, setSanitizedCode] = useState("");
  const [svgHtml, setSvgHtml] = useState("");

  useEffect(() => {
    if (!code) {
      setError(true);
      setLoading(false);
      return;
    }

    renderIdRef.current += 1;
    const currentRenderId = renderIdRef.current;

    const renderDiagram = async () => {
      setLoading(true);
      setError(false);

      try {
        let cleanCode = sanitizeMermaidCode(code);
        setSanitizedCode(cleanCode);

        try {
          await mermaid.parse(cleanCode);
        } catch {
          // Resilient fallback: strip `style ...` statements if they tripped the parser
          const strippedStyles = cleanCode.replace(/^\s*style\s+[^\n\r]+$/gim, "").trim();
          await mermaid.parse(strippedStyles);
          cleanCode = strippedStyles;
        }

        // Generate a fresh ID each time — Mermaid caches by ID and will
        // skip re-renders if the same ID is reused across calls.
        const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(diagramId, cleanCode);
        const responsiveSvg = makeSvgResponsive(svg);

        if (renderIdRef.current !== currentRenderId) return;

        setSvgHtml(responsiveSvg);
        setLoading(false);
      } catch {
        if (renderIdRef.current !== currentRenderId) return;
        setError(true);
        setLoading(false);
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="iris-viz-error">
        Failed to render diagram.
        <pre className="text-xs opacity-60">{sanitizedCode || code}</pre>
      </div>
    );
  }

  return (
    <div className="iris-mermaid-wrap">
      {loading && <div>Rendering diagram...</div>}
      <div
        className="iris-mermaid"
        style={{ display: loading ? "none" : "block" }}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  );
};

export default MermaidDiagram;
