import React from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
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
const streamingPlugins = { code, mermaid, math, cjk };

// Streamdown keeps streaming Markdown formatted while reparsing only the
// active/incomplete block. The completed message still switches to the
// existing renderer below so its final output remains canonical.
const StreamingMessageText = React.memo(({ text }: { text: string }) => {
  const citations = React.useContext(CitationsContext);
  const linkified = React.useMemo(() => linkifyCitations(text, citations), [text, citations]);

  // Once a complete semantic directive arrives, use the canonical renderer so
  // the callout/table is interactive and visually identical to the final state.
  if (normalizeIrisDirectives(linkified) !== linkified) {
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
      {linkified}
    </Streamdown>
  );
});

const MemoizedMarkdown = React.memo(({ content }: MarkdownProps) => {
  const citations = React.useContext(CitationsContext);
  const linkified = linkifyCitations(content, citations);
  const sanitized = sanitizeStream(linkified);

  return <IrisMarkdownRenderer content={sanitized} />;
});
