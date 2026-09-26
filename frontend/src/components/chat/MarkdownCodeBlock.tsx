import { memo, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { CheckCheck, Copy, Code2, Loader2 } from "lucide-react";
import IrisVisualBlock from "./IrisVisualBlock";

const ComparisonBlock = lazy(() => import("@/components/chat/viz/ComparisonBlock"));

type MarkdownCodeBlockProps = {
  code: string;
  language?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const normalizeLanguage = (language = "") => language.toLowerCase().trim();

const MAX_HIGHLIGHT_CHARS = 12_000;
const HIGHLIGHT_DEBOUNCE_MS = 90;
const highlightCache = new Map<string, string>();

const tokenPatterns: Record<string, RegExp[]> = {
  comment: [
    /\/\/[^\n]*/g,
    /\/\*[\s\S]*?\*\//g,
    /#[^\n]*/g,
    /--[^\n]*/g,
  ],
  string: [
    /"(?:\\.|[^"\\])*"/g,
    /'(?:\\.|[^'\\])*'/g,
    /`(?:\\.|[^`\\])*`/g,
  ],
  keyword: [
    /\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|from|export|default|async|await|typeof|instanceof|in|of|null|undefined|true|false)\b/g,
    /\b(?:def|class|lambda|from|import|as|return|if|elif|else|for|while|try|except|finally|raise|with|yield|True|False|None|async|await)\b/g,
    /\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|LIMIT|AS|AND|OR|NOT|NULL|VALUES|INTO|CREATE|TABLE|ALTER|DROP)\b/gi,
    /\b(?:echo|if|then|fi|for|do|done|case|esac|function|export)\b/g,
  ],
  number: [/\b\d+(?:\.\d+)?\b/g],
  function: [/\b([A-Za-z_]\w*)(?=\()/g],
  property: [/\b([A-Za-z_]\w*)(?=:)/g],
  tag: [/<\/?[A-Za-z][^&]*?>/g],
};

const applyPattern = (
  source: string,
  pattern: RegExp,
  className: string,
  placeholders: string[]
) =>
  source.replace(pattern, (match) => {
    const token = `__TOK_${placeholders.length}__`;
    placeholders.push(`<span class="gc-token-${className}">${match}</span>`);
    return token;
  });

const highlightCode = (code: string, language?: string) => {
  const escaped = escapeHtml(code);
  const lang = normalizeLanguage(language);

  if (!escaped.trim()) {
    return escaped;
  }

  // If the language is "text" or unspecified, do not apply syntax highlighting colors
  if (lang === "text" || !lang) {
    return escaped;
  }

  // Very large blocks are expensive to tokenize and are usually logs or
  // generated data. Keep the chat responsive and preserve the raw code.
  if (code.length > MAX_HIGHLIGHT_CHARS) {
    return escaped;
  }

  const cacheKey = `${lang}\u0000${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;

  if (["html", "xml", "svg"].includes(lang)) {
    const result = escaped
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="gc-token-comment">$1</span>')
      .replace(/(&lt;\/?)([A-Za-z][\w:-]*)/g, '$1<span class="gc-token-tag">$2</span>')
      .replace(/([A-Za-z-:]+)=(&quot;.*?&quot;)/g, '<span class="gc-token-property">$1</span>=<span class="gc-token-string">$2</span>');
    highlightCache.set(cacheKey, result);
    return result;
  }

  const placeholders: string[] = [];
  let highlighted = escaped;

  for (const pattern of tokenPatterns.comment) {
    highlighted = applyPattern(highlighted, pattern, "comment", placeholders);
  }

  for (const pattern of tokenPatterns.string) {
    highlighted = applyPattern(highlighted, pattern, "string", placeholders);
  }

  for (const pattern of tokenPatterns.keyword) {
    highlighted = applyPattern(highlighted, pattern, "keyword", placeholders);
  }

  for (const pattern of tokenPatterns.number) {
    highlighted = applyPattern(highlighted, pattern, "number", placeholders);
  }

  if (["json", "yaml", "yml"].includes(lang)) {
    for (const pattern of tokenPatterns.property) {
      highlighted = applyPattern(highlighted, pattern, "property", placeholders);
    }
  } else {
    for (const pattern of tokenPatterns.function) {
      highlighted = applyPattern(highlighted, pattern, "function", placeholders);
    }
  }

  for (let index = placeholders.length - 1; index >= 0; index -= 1) {
    highlighted = highlighted.replace(`__TOK_${index}__`, placeholders[index]);
  }

  // Bound the cache so a long conversation cannot retain every streamed
  // intermediate forever.
  if (highlightCache.size >= 80) {
    const oldestKey = highlightCache.keys().next().value;
    if (oldestKey) highlightCache.delete(oldestKey);
  }
  highlightCache.set(cacheKey, highlighted);
  return highlighted;
};

const getLanguageLabel = (language?: string) => {
  const normalized = normalizeLanguage(language);
  if (!normalized) return "Code";
  return normalized.toUpperCase();
};

const MarkdownCodeBlock = ({ code, language }: MarkdownCodeBlockProps) => {
  const normalizedLanguage = normalizeLanguage(language);
  const [copied, setCopied] = useState(false);
  const [highlightSource, setHighlightSource] = useState(code);

  // During streaming, code changes every few milliseconds. Show the current
  // escaped source immediately, but wait briefly before doing the expensive
  // token pass. The final pause highlights the complete block once.
  useEffect(() => {
    const timer = window.setTimeout(() => setHighlightSource(code), HIGHLIGHT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [code]);

  const highlighted = useMemo(() => highlightCode(highlightSource, language), [highlightSource, language]);
  const renderedCode = highlightSource === code ? highlighted : escapeHtml(code);

  if (normalizedLanguage === "mermaid") {
    return (
      <IrisVisualBlock
        visualization={{
          kind: "viz",
          type: "mermaid",
          title: "Diagram",
          data: code,
        }}
      />
    );
  }

  if (normalizedLanguage === "comparison") {
    return (
      <Suspense fallback={
        <div className="flex h-48 items-center justify-center rounded-xl bg-white/5 animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      }>
        <ComparisonBlock data={code} />
      </Suspense>
    );
  }



  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="gc-code-block">
      <div className="gc-code-header">
        <div className="gc-code-header-left">
          <Code2 size={14} className="gc-code-lang-icon" />
          <span className="gc-code-language">{getLanguageLabel(language)}</span>
        </div>
        <button
          type="button"
          className="gc-code-copy"
          onClick={() => void handleCopy()}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <CheckCheck size={15} className="gc-code-copy-icon-ok" /> : <Copy size={15} />}
        </button>
      </div>
      <pre className="gc-code-pre">
        <code
          className="gc-code-content"
          dangerouslySetInnerHTML={{ __html: renderedCode }}
        />
      </pre>
    </div>
  );
};

export default memo(MarkdownCodeBlock);
