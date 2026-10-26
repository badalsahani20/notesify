export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts structured HTML into clean, multiline plain text.
 * Preserves paragraph, heading, list, and table row linebreaks (\n)
 * so diff engines can perform accurate line-by-line comparisons.
 */
export function htmlToMultilineText(html: string): string {
  if (!html) return "";
  return html
    // Line breaks and horizontal rules
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    // Block-level tags: append newline on closing
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|pre|div)>/gi, "\n")
    // Table cells: separate with a clean space
    .replace(/<\/(td|th)>/gi, " ")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize spaces within each line while preserving \n line breaks
    .split("\n")
    .map((line) => line.replace(/[ \t\r]+/g, " ").trim())
    // Collapse multiple blank lines
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join("\n")
    .trim();
}
