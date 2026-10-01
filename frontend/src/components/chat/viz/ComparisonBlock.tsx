import { useMemo } from "react";
import { Check, X, Info, Loader2 } from "lucide-react";

interface ComparisonData {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface ComparisonBlockProps {
  data: string;
}

// Helper to safely parse LLM JSON (with robust string cleaning and syntax error resilience)
const safeParse = (raw: string): ComparisonData | null => {
  try {
    let cleaned = raw
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    cleaned = jsonMatch[0];
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1"); // Fix trailing commas

    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== "object") return null;

    // Be extremely forgiving during live streaming of data
    const headers = Array.isArray(obj.headers)
      ? obj.headers.map(String)
      : Array.isArray(obj.columns)
        ? obj.columns.map(String)
        : [];
    const rows = Array.isArray(obj.rows)
      ? obj.rows
          .filter((r: any) => Array.isArray(r))
          .map((r: any) => r.map(String))
      : [];

    return {
      title: obj.title || "",
      headers,
      rows,
    };
  } catch (err) {
    console.error("Comparison JSON Parse Error:", err);
    return null;
  }
};

// Check cell content to apply premium, dynamic visual badges (success, danger, info)
const renderCellContent = (content: string) => {
  if (content === undefined || content === null) {
    return "";
  }
  const normalized = String(content).trim().toLowerCase();
  const inlineCode = String(content).trim().match(/^`([^`]+)`$/);
  
  // Success/Positive indicator matches
  if (
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "✅" ||
    normalized.startsWith("supported") ||
    normalized.startsWith("built-in") ||
    normalized === "pro" ||
    normalized.startsWith("yes ")
  ) {
    return (
      <span className="iris-badge iris-badge-success">
        <Check size={12} className="inline mr-1" />
        {content}
      </span>
    );
  }

  // Danger/Negative indicator matches
  if (
    normalized === "no" ||
    normalized === "false" ||
    normalized === "❌" ||
    normalized.startsWith("not supported") ||
    normalized.startsWith("lacks") ||
    normalized === "con" ||
    normalized.startsWith("no ")
  ) {
    return (
      <span className="iris-badge iris-badge-danger">
        <X size={12} className="inline mr-1" />
        {content}
      </span>
    );
  }

  // Warning/Limited indicator matches
  if (
    normalized === "maybe" ||
    normalized.startsWith("partial") ||
    normalized.startsWith("limited") ||
    normalized.startsWith("conditional")
  ) {
    return (
      <span className="iris-badge iris-badge-warning">
        <Info size={12} className="inline mr-1" />
        {content}
      </span>
    );
  }

  if (inlineCode) {
    return <code className="iris-comparison-inline-code">{inlineCode[1]}</code>;
  }

  return <span className="iris-cell-text">{content}</span>;
};

const ComparisonBlock = ({ data }: ComparisonBlockProps) => {
  const parsed = useMemo(() => safeParse(data), [data]);

  // If no data or fields parsed yet, display a premium skeleton loader instead of an error
  if (!parsed || (parsed.headers.length === 0 && parsed.rows.length === 0 && !parsed.title)) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] text-slate-400 animate-pulse">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mb-2 opacity-70" />
        <span className="text-xs tracking-wide opacity-80">Preparing comparison grid...</span>
      </div>
    );
  }

  return (
    <div className="iris-comparison-container animate-fade-in">
      {parsed.title && (
        <div className="iris-comparison-title-wrap">
          <span className="iris-comparison-title-accent"></span>
          <h4 className="iris-comparison-title">{parsed.title}</h4>
        </div>
      )}
      {parsed.headers.length > 0 && (
        <div className="iris-comparison-table-wrapper">
          <table className="iris-comparison-table">
            <thead>
              <tr>
                {parsed.headers.map((header, idx) => (
                  <th key={idx} className="iris-comparison-th">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="iris-comparison-tr">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="iris-comparison-td">
                      {renderCellContent(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComparisonBlock;
