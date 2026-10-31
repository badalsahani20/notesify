import React from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import IrisMarkdownRenderer, { createIrisMarkdownComponents } from "./IrisMarkdownRenderer";
import IrisVisualBlock from "./IrisVisualBlock";
import type { IrisSegment } from "@/store/useGlobalChatStore";
import type { WebCitation } from "@/components/ai/types";
import { CitationsContext } from "@/context/CitationsContext";
import { linkifyCitations } from "@/utils/linkifyCitations";
import { sanitizeStream } from "@/utils/streamSanitizer";
import { normalizeIrisDirectives } from "@/utils/irisMarkdown";
import { extractSvgDimensions } from "@/utils/svgSanitizer";

interface IrisMessageBodyProps {
  segments: IrisSegment[];
  isStreaming?: boolean;
  streamingText?: string;
  citations?: WebCitation[];
}

const EMPTY_CITATIONS: WebCitation[] = [];

const IrisMessageBody = ({ segments, isStreaming = false, streamingText, citations }: IrisMessageBodyProps) => {
  const effectiveSegments =
    segments && segments.length > 0
      ? segments
      : streamingText !== undefined
        ? [{ kind: "text" as const, content: streamingText }]
        : [];

  return (
    <CitationsContext.Provider value={citations ?? EMPTY_CITATIONS}>
      <div className="iris-message-body">
        {effectiveSegments.map((seg, index) => {
          const key = seg.id ?? `${seg.kind}-${index}`;

          if (seg.kind === "text") {
            const isLast = index === effectiveSegments.length - 1;
            if (isStreaming && isLast) {
              return <StreamingMessageText key={key} text={seg.content} />;
            }
            return <MemoizedMarkdown key={key} content={seg.content} />;
          }

          return <IrisVisualBlock key={key} visualization={seg} />;
        })}
      </div>
    </CitationsContext.Provider>
  );
};

export default IrisMessageBody;

interface MarkdownProps {
  content: string;
}

const streamingMarkdownComponents = createIrisMarkdownComponents(true);
const streamingPlugins = { code, math, cjk };

/**
 * Catches incomplete mermaid code blocks that are midway through streaming.
 * Replaces the open fence with a valid placeholder so the diagram engine is not
 * executed on partial, broken code before the closing ``` has arrived.
 */
/**
 * Catches unclosed SVG code blocks or raw unclosed <svg> tags midway through streaming.
 * Replaces with %%iris-streaming-svg to reserve space and prevent layout shifts.
 * Also wraps completed raw <svg>...</svg> blocks outside code fences into ```svg ... ```
 * so they are rendered uniformly through SvgPreviewCard.
 */
export const catchStreamingSvg = (text: string): string => {
  if (!text.includes("<svg") && !text.includes("```svg")) return text;

  const parts = text.split("```");
  const isInsideCodeBlock = parts.length % 2 === 0;

  if (isInsideCodeBlock) {
    const lastBlock = parts[parts.length - 1];
    const lang = (lastBlock.split("\n")[0] || "").toLowerCase().trim();
    if (lang === "svg" || (["xml", "html", ""].includes(lang) && lastBlock.includes("<svg"))) {
      const { aspectRatio } = extractSvgDimensions(lastBlock);
      parts[parts.length - 1] = "svg\n%%iris-streaming-svg:aspectRatio=" + aspectRatio.toFixed(3) + "\n";
      return parts.join("```") + "```";
    }
  } else {
    const lastPart = parts[parts.length - 1];
    const svgIndex = lastPart.search(/<svg\b/i);
    if (svgIndex !== -1) {
      const rest = lastPart.slice(svgIndex);
      if (!rest.includes("</svg>")) {
        const { aspectRatio } = extractSvgDimensions(rest);
        parts[parts.length - 1] =
          lastPart.slice(0, svgIndex) +
          "\n```svg\n%%iris-streaming-svg:aspectRatio=" +
          aspectRatio.toFixed(3) +
          "\n```\n";
        return parts.join("```");
      }
    }
  }

  // Wrap completed raw inline <svg>...</svg> outside code blocks
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i].includes("<svg") && parts[i].includes("</svg>")) {
      parts[i] = parts[i].replace(/(<svg\b[\s\S]*?<\/svg>)/gi, "\n```svg\n$1\n```\n");
    }
  }

  return parts.join("```");
};

const catchUnclosedMermaid = (content: string): string => {
  const openFenceMatch = content.match(/(```mermaid)(?![\s\S]*?```)[\s\S]*$/i);
  if (!openFenceMatch || openFenceMatch.index === undefined) {
    return content;
  }
  return (
    content.slice(0, openFenceMatch.index) +
    "```mermaid\n%%iris-streaming-diagram\n```"
  );
};

// Streamdown keeps streaming Markdown formatted while reparsing only the
// active/incomplete block. The completed message still switches to the
// existing renderer below so its final output remains canonical.
const StreamingMessageText = React.memo(({ text }: { text: string }) => {
  const citations = React.useContext(CitationsContext);
  const linkified = React.useMemo(() => linkifyCitations(text, citations), [text, citations]);

  // Catch unclosed mermaid blocks while streaming so diagrams don't fail midway
  const contentToStream = React.useMemo(() => catchStreamingSvg(catchUnclosedMermaid(linkified)), [linkified]);

  // Once a complete semantic directive arrives, use the canonical renderer so
  // the callout/table is interactive and visually identical to the final state.
  if (linkified.includes(":::") && normalizeIrisDirectives(linkified) !== linkified) {
    return <IrisMarkdownRenderer content={linkified} isStreaming />;
  }

  return (
    <Streamdown
      animated
      isAnimating
      plugins={streamingPlugins}
      components={streamingMarkdownComponents}
      className="break-words"
    >
      {contentToStream}
    </Streamdown>
  );
});

const MemoizedMarkdown = React.memo(({ content }: MarkdownProps) => {
  const citations = React.useContext(CitationsContext);
  const linkified = linkifyCitations(content, citations);
  const sanitized = sanitizeStream(catchStreamingSvg(linkified));

  return <IrisMarkdownRenderer content={sanitized} />;
});
