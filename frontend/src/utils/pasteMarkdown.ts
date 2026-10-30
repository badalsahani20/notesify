// Heuristics for deciding how pasted plain text should be inserted into the
// note editor. Kept outside TipTap so the rules can be unit-tested without
// mounting an editor.
import { DOCUMENT_PATTERNS } from "./markdownToHtml";

/** Language/structural markers that suggest the text is source code. */
const CODE_MARKERS = [
  /[{};]\s*\n/,
  /\b(function|const|let|var|class|import|export|async|await|def|print)\b\s*[\s(]/,
  /=>\s*[{(]/,
  /^\s*(if|for|while|switch)\s*\(/m,
];

/** Block-level markdown constructs that almost never appear in source code. */
const DOCUMENT_SIGNALS = [
  /^#{1,6}\s+\S/m, // ATX heading
  /^\s*>\s+\S/m, // blockquote
  /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/m, // thematic break
  /^\s*\|.+\|\s*$/m, // table row
  /^\s*[-*+]\s+\S/m, // bullet list
  /^\s*\d+\.\s+\S/m, // ordered list
];

const isProseLine = (line: string) => line.length >= 50 && /[.!?]$/.test(line);

export const looksLikeCodeSnippet = (text: string) => {
  if (!text.includes("\n")) return false;

  // 1. Detect standard programming languages
  const matchCount = CODE_MARKERS.filter((p) => p.test(text)).length;
  if (matchCount >= 2) return true; // Strong code confidence overrides document patterns

  // 2. Reject if it looks like a markdown document
  if (DOCUMENT_PATTERNS.some((p) => p.test(text))) return false; // Likely a document with a stray code word

  // 3. Detect Mermaid definitions
  const isMermaid = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(text);
  if (isMermaid) return true;

  // 4. Detect ASCII Art / Diagrams (box drawing characters, structural arrows with indentation)
  const hasBoxDrawing = /[─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬╭╮╯╰]/.test(text);
  const hasDiagramArrows = /──►|◄──|-->|<--|==>|<==/.test(text);
  const hasVerticalAlignment = /^\s{2,}[│▼▲|]/m.test(text) || /\s{4,}/.test(text);

  if ((hasBoxDrawing || hasDiagramArrows) && hasVerticalAlignment) {
    return true;
  }

  return matchCount >= 1;
};

/**
 * True when `text` reads like a markdown document (headings, lists, tables,
 * quotes, prose) rather than a bare code snippet.
 *
 * This exists because a long document is full of code-ish tokens — `const`,
 * `=>`, `{ }`, `;` — so the "looks like code" check fires on it and the whole
 * document used to be pasted as one giant code block.
 */
export function looksLikeMarkdownDocument(text: string): boolean {
  if (!text.trim()) return false;

  // Fenced code anywhere means the source itself is markdown.
  if (/^\s*```/m.test(text)) return true;

  // Two independent block constructs is already conclusive.
  const signals = DOCUMENT_SIGNALS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
  if (signals >= 2) return true;

  // Copies taken from a rendered view (browser, chat, PDF) lose the `#`, `-`
  // and `|` markers, so fall back to prose density: long sentences that end
  // in punctuation, measured by characters rather than line count because
  // code lines are short.
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 6) return false;

  const prose = lines.filter(isProseLine);
  if (prose.length < 5) return false;

  const proseChars = prose.reduce((sum, line) => sum + line.length, 0);
  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  return proseChars / totalChars >= 0.3;
}

/**
 * Decide whether a paste should be inserted as a single code block.
 *
 * `isIdeCopy` is true when the clipboard HTML carries IDE/monospace markers.
 * A markdown document must never take this path, no matter how much code it
 * contains.
 */
export function shouldPasteAsCodeBlock(
  plainText: string,
  html: string,
  isIdeCopy: boolean
): boolean {
  if (!plainText) return false;

  // Fenced markdown is markdown, not a snippet.
  if (/^\s*```/m.test(plainText)) return false;
  if (looksLikeMarkdownDocument(plainText)) return false;
  if (!isIdeCopy && !looksLikeCodeSnippet(plainText)) return false;

  // Clipboard HTML that already carries document structure wins.
  if (html && /<(?:h[1-6]|ul|ol|table|blockquote)\b/i.test(html)) return false;
  if (!html) return true;

  return (
    /<(?:pre|code)\b/i.test(html) ||
    (/<(?:div|span)\b/i.test(html) && !/<(?:p|h[1-6]|ul|ol|table|blockquote)\b/i.test(html))
  );
}
