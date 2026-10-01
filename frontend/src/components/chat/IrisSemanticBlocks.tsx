import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, PencilLine, ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ComparisonBlock from "@/components/chat/viz/ComparisonBlock";
import { sharedMarkdownComponents } from "@/utils/sharedMarkdownComponents";

export type CalloutVariant = "insight" | "warning" | "tip" | "correction";

const CALLOUT_META: Record<CalloutVariant, { label: string; icon: typeof Lightbulb }> = {
  insight: { label: "Insight", icon: Lightbulb },
  warning: { label: "Watch for", icon: AlertTriangle },
  tip: { label: "Tip", icon: CheckCircle2 },
  correction: { label: "Correction", icon: PencilLine },
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
  const Icon = meta.icon;

  return (
    <aside className={`iris-callout iris-callout-${safeVariant}`} role="note">
      <div className="iris-callout-heading">
        <span className="iris-callout-icon" aria-hidden="true"><Icon size={15} /></span>
        <span>{title || meta.label}</span>
      </div>
      <div className="iris-callout-body"><SemanticBody>{children}</SemanticBody></div>
    </aside>
  );
};

export const IrisKeyTakeaway = ({ title, children }: { title?: string; children?: ReactNode }) => (
  <aside className="iris-key-takeaway" role="note">
    <div className="iris-key-takeaway-heading">
      <ShieldAlert size={15} aria-hidden="true" />
      <span>{title || "Key takeaway"}</span>
    </div>
    <div className="iris-key-takeaway-body"><SemanticBody>{children}</SemanticBody></div>
  </aside>
);

export const IrisComparison = ({ children }: { children?: ReactNode }) => (
  <div className="iris-semantic-comparison">
    <ComparisonBlock data={childrenToText(children)} />
  </div>
);
