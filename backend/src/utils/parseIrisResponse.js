const BLOCK_REGEX = /\[(?:IRIS_VIZ|\/IRIS_VIZ(?=\s|:))([^\]]*)\]([\s\S]*?)\[\/IRIS_VIZ\]/gi;
const ATTR_REGEX = /(\w+)=["']([^"']*)["']/g;
const FENCED_MERMAID_REGEX = /```mermaid\s*\n([\s\S]*?)\n```/gi;
const ALLOWED_TYPES = new Set(["mermaid", "chart", "math"]);

const parseAttributes = (rawAttributes = "") => {
  const attrs = {};
  let match;

  while ((match = ATTR_REGEX.exec(rawAttributes)) !== null) {
    attrs[match[1].toLowerCase()] = match[2].trim();
  }

  return attrs;
};

const pushTextAndMarkdownVizSegments = (segments, rawText = "") => {
  let lastIndex = 0;
  let match;

  while ((match = FENCED_MERMAID_REGEX.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      const textContent = rawText.slice(lastIndex, match.index).trim();
      if (textContent) {
        segments.push({
          kind: "text",
          content: textContent,
        });
      }
    }

    const mermaidCode = match[1]?.trim();
    if (mermaidCode) {
      segments.push({
        kind: "viz",
        type: "mermaid",
        title: "",
        data: mermaidCode,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < rawText.length) {
    const remaining = rawText.slice(lastIndex).trim();
    if (remaining) {
      segments.push({
        kind: "text",
        content: remaining,
      });
    }
  }
};

export const parseIrisResponse = (rawText = "") => {
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = BLOCK_REGEX.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      pushTextAndMarkdownVizSegments(
        segments,
        rawText.slice(lastIndex, match.index)
      );
    }

    const attrs = parseAttributes(match[1]);
    const type = attrs.type?.toLowerCase();

    if (!type || !ALLOWED_TYPES.has(type)) {
      lastIndex = match.index + match[0].length;
      continue;
    }

    let cleanData = match[2].trim();
    cleanData = cleanData.replace(/^```[a-z]*\n?/i, "");
    cleanData = cleanData.replace(/\n?```$/i, "");
    cleanData = cleanData.trim();

    segments.push({
      kind: "viz",
      type,
      title: attrs.title || "",
      data: cleanData,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < rawText.length) {
    pushTextAndMarkdownVizSegments(segments, rawText.slice(lastIndex));
  }

  if (segments.length === 0) {
    segments.push({ kind: "text", content: rawText.trim() });
  }

  return segments;
};
