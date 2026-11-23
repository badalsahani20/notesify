import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { CheckCheck, Copy, Eye, Code2 } from "lucide-react";

// mermaid is ~3 MB; only load it when a diagram preview is actually opened.
const MermaidViewer = lazy(() =>
  import("./MermaidViewer").then((m) => ({ default: m.MermaidViewer }))
);

export const TipTapCodeBlock = React.memo(({ node, editor, getPos }: NodeViewProps) => {
  const [copied, setCopied] = useState(false);
  
  const text = node.textContent.trim();
  const isMermaid = 
    node.attrs.language === "mermaid" || 
    node.attrs.language === "mermaid-code" ||
    text.startsWith("graph ") ||
    text.startsWith("flowchart ") ||
    text.startsWith("sequenceDiagram") ||
    text.startsWith("classDiagram") ||
    text.startsWith("stateDiagram") ||
    text.startsWith("erDiagram") ||
    text.startsWith("gantt") ||
    text.startsWith("pie");

  const [viewMode, setViewMode] = useState<"code" | "preview">(isMermaid ? "preview" : "code");
  
  // Use a ref to always have the latest content for the copy button 
  // without triggering re-renders of the frozen memo
  const contentRef = useRef(node.textContent);
  
  useEffect(() => {
    contentRef.current = node.textContent;
  }, [node.textContent]);

  const handleCopy = async () => {
    let textToCopy = contentRef.current;
    
    // Try to get live content from editor if possible
    if (typeof getPos === 'function') {
      const pos = getPos();
      if (typeof pos === 'number') {
        const liveNode = editor.state.doc.nodeAt(pos);
        if (liveNode) textToCopy = liveNode.textContent;
      }
    }
    
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <NodeViewWrapper className="editor-code-block tiptap-nodeview relative group">
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10" contentEditable={false}>
        {isMermaid && (
          <button
            type="button"
            className="flex items-center justify-center p-1.5 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition-colors border border-white/10 backdrop-blur-sm"
            onClick={() => setViewMode(prev => prev === "code" ? "preview" : "code")}
            title={viewMode === "preview" ? "Show Code" : "Show Preview"}
          >
            {viewMode === "preview" ? <Code2 size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button
          type="button"
          className="flex items-center justify-center p-1.5 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition-colors border border-white/10 backdrop-blur-sm"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <CheckCheck size={14} className="text-emerald-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>

      {isMermaid && viewMode === "preview" && (
        <div className="my-2 border border-white/10 rounded-lg overflow-hidden bg-black/40" contentEditable={false}>
          <Suspense
            fallback={
              <div className="p-4 text-xs text-stone-400 animate-pulse">Rendering diagram…</div>
            }
          >
            <MermaidViewer code={node.textContent} />
          </Suspense>
        </div>
      )}

      {/* 
        We must ALWAYS render NodeViewContent so TipTap doesn't lose track of the node content.
        If we are in preview mode, we hide it visually.
      */}
      <pre className={`editor-code-pre ${isMermaid && viewMode === "preview" ? "hidden" : ""}`}>
        <NodeViewContent
          as={"code" as any}
          className="editor-code-content outline-none"
        />
      </pre>
    </NodeViewWrapper>
  );
}, () => true);

