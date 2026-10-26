import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ComparisonBlock from "@/components/chat/viz/ComparisonBlock";
import { sharedMarkdownComponents } from "@/utils/sharedMarkdownComponents";

export type CalloutVariant = "insight" | "warning" | "tip" | "correction";

interface VariantMeta {
  mark: string;
  tag: string;
  label: string;
}

const CALLOUT_META: Record<CalloutVariant, VariantMeta> = {
  insight: { mark: "※", tag: "INSIGHT", label: "Core Observation" },
  warning: { mark: "▲", tag: "CAUTION", label: "Critical Caveat" },
  tip: { mark: "✦", tag: "METHOD", label: "Practical Technique" },
  correction: { mark: "Δ", tag: "REVISION", label: "Direct Adjustment" },
};

const TAKEAWAY_META: VariantMeta = {
  mark: "↳",
  tag: "TAKEAWAY",
  label: "Executive Synthesis",
};

export const childrenToText = (children: ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  return "";
};

const SemanticBody = ({ children }: { children?: ReactNode }) => {
  const content = childrenToText(children).trim();
  if (!content) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={sharedMarkdownComponents()}
    >
      {content}
    </ReactMarkdown>
  );
};

interface IrisCalloutProps {
  variant?: string;
  title?: string;
  children?: ReactNode;
}

export const IrisCallout = ({ variant = "insight", title, children }: IrisCalloutProps) => {
  const safeVariant: CalloutVariant = variant in CALLOUT_META ? variant as CalloutVariant : "insight";
  const meta = CALLOUT_META[safeVariant];

  return (
    <aside className={`iris-callout iris-callout-${safeVariant}`} role="note">
      <header className="iris-callout-header">
        <div className="iris-callout-meta">
          <span className="iris-callout-glyph" aria-hidden="true">{meta.mark}</span>
          <span className="iris-callout-tag">{meta.tag}</span>
          <span className="iris-callout-sep" aria-hidden="true">/</span>
          <span className="iris-callout-label">{title || meta.label}</span>
        </div>
      </header>
      <div className="iris-callout-content">
        <SemanticBody>{children}</SemanticBody>
      </div>
    </aside>
  );
};

export const IrisKeyTakeaway = ({ title, children }: { title?: string; children?: ReactNode }) => (
  <aside className="iris-key-takeaway" role="note">
    <header className="iris-callout-header">
      <div className="iris-callout-meta">
        <span className="iris-callout-glyph" aria-hidden="true">{TAKEAWAY_META.mark}</span>
        <span className="iris-callout-tag">{TAKEAWAY_META.tag}</span>
        <span className="iris-callout-sep" aria-hidden="true">/</span>
        <span className="iris-callout-label">{title || TAKEAWAY_META.label}</span>
      </div>
    </header>
    <div className="iris-callout-content">
      <SemanticBody>{children}</SemanticBody>
    </div>
  </aside>
);

export const IrisComparison = ({ children }: { children?: ReactNode }) => (
  <div className="iris-semantic-comparison">
    <ComparisonBlock data={childrenToText(children)} />
  </div>
);
