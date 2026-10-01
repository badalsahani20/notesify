import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { sharedMarkdownComponents } from "@/utils/sharedMarkdownComponents";
import { irisSpacing, irisTypography, normalizeIrisDirectives } from "@/utils/irisMarkdown";
import { IrisCallout, IrisComparison, IrisKeyTakeaway } from "./IrisSemanticBlocks";

type MarkdownNode = { properties?: Record<string, unknown> };

const getProperty = (node: MarkdownNode | undefined, name: string): string | undefined => {
  const camelName = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const value = node?.properties?.[name] ?? node?.properties?.[camelName];
  return typeof value === "string" ? value : undefined;
};

export const createIrisMarkdownComponents = (isStreaming = false) => {
  const shared = sharedMarkdownComponents(isStreaming);

  return {
    ...shared,
    p: ({ children, ...props }: any) => (
      <p className={`${irisTypography.body} ${irisSpacing.paragraph} iris-md-paragraph`} {...props}>{children}</p>
    ),
    h1: ({ children, ...props }: any) => (
      <h1 className={`${irisTypography.heading} ${irisSpacing.heading} iris-md-heading iris-md-h1`} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className={`${irisTypography.heading} ${irisSpacing.heading} iris-md-heading`} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className={`${irisTypography.subheading} ${irisSpacing.heading} iris-md-heading`} {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className={`${irisTypography.subheading} ${irisSpacing.heading} iris-md-heading`} {...props}>{children}</h4>
    ),
    ul: ({ children, ...props }: any) => <ul className={`iris-md-list ${irisSpacing.list}`} {...props}>{children}</ul>,
    ol: ({ children, ...props }: any) => <ol className={`iris-md-list ${irisSpacing.list}`} {...props}>{children}</ol>,
    li: ({ children, ...props }: any) => <li className="iris-md-list-item" {...props}>{children}</li>,
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="iris-md-blockquote" {...props}>{children}</blockquote>
    ),
    table: ({ children, ...props }: any) => (
      <div className="iris-md-table-wrapper">
        <table className="iris-md-table" {...props}>{children}</table>
      </div>
    ),
    "iris-callout": ({ children, node }: { children?: ReactNode; node?: MarkdownNode }) => (
      <IrisCallout
        variant={getProperty(node, "data-variant")}
        title={getProperty(node, "data-title")}
      >
        {children}
      </IrisCallout>
    ),
    "iris-takeaway": ({ children, node }: { children?: ReactNode; node?: MarkdownNode }) => (
      <IrisKeyTakeaway title={getProperty(node, "data-title")}>{children}</IrisKeyTakeaway>
    ),
    "iris-comparison": ({ children }: { children?: ReactNode }) => (
      <IrisComparison>{children}</IrisComparison>
    ),
  };
};

interface IrisMarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const IrisMarkdownRenderer = ({ content, isStreaming = false }: IrisMarkdownRendererProps) => {
  const components = useMemo(() => createIrisMarkdownComponents(isStreaming), [isStreaming]);
  const markdown = useMemo(() => normalizeIrisDirectives(content), [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  );
};

export default IrisMarkdownRenderer;
