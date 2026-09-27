import React from "react";
import ReactMarkdown from "react-markdown";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import { sharedMarkdownComponents } from "@/utils/sharedMarkdownComponents";
import IrisVisualBlock from "./IrisVisualBlock";
import type { IrisSegment } from "@/store/useGlobalChatStore";
import type { WebCitation } from "@/components/ai/types";
import { CitationsContext } from "@/context/CitationsContext";
import { linkifyCitations } from "@/utils/linkifyCitations";
import { sanitizeStream } from "@/utils/streamSanitizer";

interface IrisMessageBodyProps {
  segments: IrisSegment[];
  isStreaming?: boolean;
  streamingText?: string;
  citations?: WebCitation[];
}

const EMPTY_CITATIONS: WebCitation[] = [];

const IrisMessageBody = ({ segments, isStreaming = false, streamingText, citations }: IrisMessageBodyProps) => {
  return (
    <CitationsContext.Provider value={citations ?? EMPTY_CITATIONS}>
      <div className="iris-message-body">
        {isStreaming && streamingText !== undefined ? (
          <StreamingMessageText text={streamingText} />
        ) : (
          segments.map((seg, index) => {
            const key = seg.id ?? `${seg.kind}-${index}`;

            if (seg.kind === "text") {
              return <MemoizedMarkdown key={key} content={seg.content} />;
            }

            return <IrisVisualBlock key={key} visualization={seg} />;
          })
        )}
      </div>
    </CitationsContext.Provider>
  );
};

export default IrisMessageBody;

interface MarkdownProps {
  content: string;
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeRaw, rehypeKatex];
const markdownComponents = sharedMarkdownComponents(false);
const streamingMarkdownComponents = sharedMarkdownComponents(true);
const streamingPlugins = { code, mermaid, math, cjk };

// Streamdown keeps streaming Markdown formatted while reparsing only the
// active/incomplete block. The completed message still switches to the
// existing renderer below so its final output remains canonical.
const StreamingMessageText = React.memo(({ text }: { text: string }) => (
  <Streamdown
    animated
    isAnimating
    plugins={streamingPlugins}
    components={streamingMarkdownComponents}
    className="break-words"
  >
    {text}
  </Streamdown>
));

const MemoizedMarkdown = React.memo(({ content }: MarkdownProps) => {
  const citations = React.useContext(CitationsContext);
  const linkified = linkifyCitations(content, citations);
  const sanitized = sanitizeStream(linkified);

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={markdownComponents}
    >
      {sanitized}
    </ReactMarkdown>
  );
});
