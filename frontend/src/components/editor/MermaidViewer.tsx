import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

interface MermaidViewerProps {
  code: string;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    // Initialize mermaid with dark theme to match app aesthetic
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      // Diagram source is model/user supplied; loose mode enables raw HTML and
      // click handlers inside labels.
      securityLevel: 'strict',
      fontFamily: 'inherit',
      suppressErrorRendering: true,
      themeVariables: {
        darkMode: true,
        background: 'transparent',
      }
    });

    const renderDiagram = async () => {
      if (!code.trim()) return;
      
      try {
        // Generate a random ID for this render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        setSvgContent(svg);
        setError(null);
      } catch (err: any) {
        console.error("Mermaid parsing error:", err);
        setError(err.message || "Failed to render diagram");
      }
    };

    renderDiagram();
  }, [code, theme, systemTheme]);

  if (error) {
    return (
      <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-sm overflow-auto font-mono">
        <p className="font-bold mb-2">Syntax Error in Diagram:</p>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid-container flex justify-center p-4 bg-black/20 rounded-md overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svgContent || `<div class="animate-pulse h-24 w-full bg-stone-800 rounded"></div>` }}
    />
  );
};
