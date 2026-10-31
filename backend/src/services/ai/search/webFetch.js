/**
 * Native web fetch for Iris.
 *
 * Fetches one public URL and returns readable text. No API key required, so it
 * works on every transport tier (OpenRouter, Groq, Gemini) instead of being
 * stripped like the provider-specific `openrouter:web_fetch` tool.
 *
 * Safety:
 *   - http(s) only
 *   - localhost, private ranges, link-local, and .local hosts are refused
 *   - redirects are followed manually so each hop is re-validated
 *   - response body is capped in bytes and characters
 *
 * Never throws. Failures come back as `{ error }`.
 */

import { stripHtml } from "../../../utils/stripHtml.js";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_CHARS = 12000;
const HARD_MAX_CHARS = 20000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
  // IPv6 unique-local, link-local, and IPv4-mapped literals.
  /^\[f[cd]/i,
  /^\[fe[89ab]/i,
  /^\[::ffff:/i,
  /\.local$/i,
  /^metadata\./i,
];

const isPrivateHost = (hostname) => {
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  // 172.16.0.0 – 172.31.255.255
  const match = hostname.match(/^172\.(\d{1,3})\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
};

const parsePublicUrl = (raw) => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

// `stripHtml` removes tags but leaves entities, which pollutes titles and
// snippets. Decode the common set plus numeric references.
const decodeEntities = (value = "") =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (entity, name) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      return decoded === undefined ? entity : decoded;
    });

// Tags are dropped by `stripHtml`, but the *contents* of script, style, and
// similar blocks are text nodes, so they would otherwise reach the model.
const NON_CONTENT_BLOCKS = /<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi;

const htmlToText = (html = "") =>
  decodeEntities(
    stripHtml(
      html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(NON_CONTENT_BLOCKS, " "),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();

const extractTitle = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 200) : "";
};

const readCapped = async (response) => {
  const reader = response.body?.getReader?.();

  if (!reader) {
    const text = await response.text();
    return {
      text: text.slice(0, MAX_BYTES),
      truncated: text.length > MAX_BYTES,
    };
  }

  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    if (received > MAX_BYTES) {
      const allowed = Math.max(0, value.length - (received - MAX_BYTES));
      text += decoder.decode(value.slice(0, allowed), { stream: true });
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return { text, truncated };
};

export const isNativeFetchEnabled = () =>
  (process.env.WEB_FETCH_PROVIDER || "").trim().toLowerCase() !== "openrouter";

export const fetchPage = async (
  rawUrl,
  { maxChars = DEFAULT_MAX_CHARS, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) => {
  const limit = Math.min(Math.max(500, maxChars), HARD_MAX_CHARS);
  let current = parsePublicUrl(rawUrl);

  if (!current) {
    return {
      error: `Refusing to fetch "${rawUrl}": only public http(s) URLs are allowed.`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5",
          "User-Agent": "NotesifyBot/1.0 (+https://notesify.in)",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return { error: "Redirect response had no Location header." };
        }

        const next = parsePublicUrl(new URL(location, current).toString());
        if (!next) {
          return { error: "Refusing to follow a redirect to a non-public URL." };
        }

        current = next;
        continue;
      }

      if (!response.ok) {
        return {
          url: current.toString(),
          error: `Fetch failed with HTTP ${response.status}.`,
          status: response.status,
        };
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const isAllowed =
        !contentType ||
        ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type));

      if (!isAllowed) {
        return {
          url: current.toString(),
          error: `Unsupported content type "${contentType.split(";")[0]}". Only text pages can be read.`,
        };
      }

      const { text: raw, truncated: byteTruncated } = await readCapped(response);
      const looksLikeHtml =
        contentType.includes("html") || /<html[\s>]|<body[\s>]/i.test(raw);

      const title = looksLikeHtml ? extractTitle(raw) : "";
      const plain = looksLikeHtml
        ? htmlToText(raw)
        : raw.replace(/\s+/g, " ").trim();
      const clipped =
        plain.length > limit ? `${plain.slice(0, limit)}…` : plain;

      return {
        url: current.toString(),
        title: title || current.hostname,
        text: clipped,
        truncated: byteTruncated || plain.length > limit,
      };
    }

    return {
      url: current.toString(),
      error: `Too many redirects (limit ${MAX_REDIRECTS}).`,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        url: current.toString(),
        error: `Fetch timed out after ${timeoutMs}ms.`,
      };
    }
    return {
      url: current.toString(),
      error: `Fetch failed: ${error.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
};
