import DOMPurify, { type WindowLike } from "dompurify";

/**
 * AI-generated note HTML and pasted editor HTML are untrusted. DOMPurify runs
 * in the browser only; during SSR/tests without a DOM we return an empty string
 * rather than risk rendering unsanitized markup.
 */
const purify =
  typeof window === "undefined" ? null : DOMPurify(window as unknown as WindowLike);

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "code", "dd", "del", "details", "div", "dl",
  "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "input", "ins", "kbd", "li", "mark", "ol", "p", "pre",
  "s", "samp", "span", "strong", "sub", "summary", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
];

const ALLOWED_ATTR = [
  "alt", "checked", "cite", "class", "colspan", "disabled", "href", "id",
  "lang", "rel", "rowspan", "src", "start", "title", "type",
];

export const sanitizeNoteHtml = (html: string): string => {
  if (!html || !purify) return "";

  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    // Never let note content pull in styles, frames, plugins or form posts.
    FORBID_TAGS: ["base", "embed", "form", "iframe", "link", "meta", "object", "script", "style"],
    FORBID_ATTR: ["srcset", "style"],
    RETURN_TRUSTED_TYPE: false,
  });
};
