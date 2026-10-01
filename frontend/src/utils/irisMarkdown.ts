export const irisTypography = {
  body: "text-[15px] leading-7",
  heading: "text-[18px] font-semibold leading-6",
  subheading: "text-[15px] font-semibold leading-6",
  code: "font-mono text-[13px]",
  caption: "text-[12px] leading-5",
} as const;

export const irisSpacing = {
  paragraph: "mb-4",
  heading: "mt-8 mb-3",
  list: "my-3",
  code: "my-5",
  callout: "my-5",
} as const;

const CALLOUT_VARIANTS = new Set(["insight", "warning", "tip", "correction", "takeaway", "key-takeaway"]);

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeDirectiveBody = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Turns the small, human-readable Iris directive syntax into private HTML
 * elements. ReactMarkdown's rehypeRaw pass then hands those elements to the
 * semantic React components without making the model responsible for styling.
 *
 * Directives are deliberately line-based and are ignored inside fenced code
 * blocks, so examples and pasted code remain ordinary Markdown.
 */
export const normalizeIrisDirectives = (markdown: string): string => {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let fence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);

    if (fenceMatch) {
      if (!fence) {
        fence = fenceMatch[1]?.[0] ?? null;
      } else if (fence === fenceMatch[1]?.[0]) {
        fence = null;
      }
      output.push(line);
      continue;
    }

    if (fence) {
      output.push(line);
      continue;
    }

    const opening = line.match(/^\s{0,3}:::([a-z-]+)(?:\s+(.+?))?\s*$/i);
    if (!opening) {
      output.push(line);
      continue;
    }

    const kind = opening[1]?.toLowerCase() ?? "";
    if (kind !== "comparison" && !CALLOUT_VARIANTS.has(kind)) {
      output.push(line);
      continue;
    }

    const body: string[] = [];
    let closingIndex = -1;
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      if (/^\s{0,3}:::\s*$/.test(lines[bodyIndex] ?? "")) {
        closingIndex = bodyIndex;
        break;
      }
      body.push(lines[bodyIndex] ?? "");
    }

    // Keep an incomplete directive as text while the model is streaming.
    if (closingIndex === -1) {
      output.push(line, ...body);
      index = lines.length;
      continue;
    }

    const title = (opening[2] ?? "").trim();
    const bodyText = body.join("\n").trim();
    if (kind === "comparison") {
      output.push(
        `<iris-comparison>${escapeDirectiveBody(bodyText)}</iris-comparison>`,
      );
    } else if (kind === "takeaway" || kind === "key-takeaway") {
      output.push(
        `<iris-takeaway${title ? ` data-title="${escapeAttribute(title)}"` : ""}>${escapeDirectiveBody(bodyText)}</iris-takeaway>`,
      );
    } else {
      output.push(
        `<iris-callout data-variant="${kind}"${title ? ` data-title="${escapeAttribute(title)}"` : ""}>${escapeDirectiveBody(bodyText)}</iris-callout>`,
      );
    }

    index = closingIndex;
  }

  return output.join("\n");
};
