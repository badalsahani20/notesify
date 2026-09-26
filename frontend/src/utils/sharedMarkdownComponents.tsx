import { useContext } from "react";
import MarkdownCodeBlock from "@/components/chat/MarkdownCodeBlock";
import MarkdownWritingBlock from "@/components/chat/MarkdownWritingBlock";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";
import { CitationsContext } from "@/context/CitationsContext";

export const MarkdownLink = ({ href, children, ...props }: any) => {
  const citations = useContext(CitationsContext);
  if (!href) return <a {...props}>{children}</a>;

  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  if (!isExternal) {
    return (
      <a href={href} {...props} className="iris-link">
        {children}
      </a>
    );
  }

  // Look for matching citation in citations array
  const normHref = href.trim().toLowerCase().replace(/\/$/, "");
  const matchedCitation = citations?.find((c) => {
    const normC = (c.url || "").trim().toLowerCase().replace(/\/$/, "");
    return normC === normHref || normHref.startsWith(normC) || normC.startsWith(normHref);
  });

  let domain = "";
  try {
    domain = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    domain = href;
  }

  const childText = typeof children === "string" ? children.trim() : "";
  const isNumericCitation = /^\d+$/.test(childText) || /^\[\d+\]$/.test(childText);
  const label = isNumericCitation ? childText.replace(/[\[\]]/g, "") : (childText || domain);
  const title = matchedCitation?.title || (childText && !isNumericCitation ? childText : domain) || domain;
  const description = matchedCitation?.content || href;

  return (
    <Source href={href}>
      <SourceTrigger
        label={label}
        showFavicon={true}
        className={isNumericCitation ? "mx-0.5 px-1.5" : "mx-1 px-2"}
      />
      <SourceContent title={title} description={description} />
    </Source>
  );
};

export const sharedMarkdownComponents = (isStreaming = false) => ({
  code({ className, children, ...props }: any) {
    const rawCode = String(children ?? "").replace(/\n$/, "");
    const language = className?.replace("language-", "") || "";
    const isBlock = Boolean(language) || rawCode.includes("\n");

    if (!isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    if (language === "writing") {
      return <MarkdownWritingBlock content={rawCode} />;
    }

    return <MarkdownCodeBlock code={rawCode} language={language} isStreaming={isStreaming} />;
  },
  a: MarkdownLink,
  table({ children, ...props }: any) {
    return (
      <div className="tableWrapper">
        <table {...props}>{children}</table>
      </div>
    );
  },
});
