import { useMemo, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SpecSheet, type SpecRow } from "@/components/spec-sheet";

interface SpecSheetPayload {
  title: string;
  subtitle?: string;
  rows: SpecRow[];
}

interface SpecSheetBlockProps {
  data: string;
  isStreaming?: boolean;
}

const safeParseSpecSheet = (raw: string): SpecSheetPayload | null => {
  try {
    let cleaned = raw
      .replace(/```[a-z_-]*\n?/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
    const obj = JSON.parse(cleaned);

    if (!obj || typeof obj !== "object") return null;

    const title = String(obj.title || "Specifications");
    const subtitle = obj.subtitle ? String(obj.subtitle) : undefined;

    const rawRows = Array.isArray(obj.rows)
      ? obj.rows
      : Array.isArray(obj.specs)
      ? obj.specs
      : Array.isArray(obj.items)
      ? obj.items
      : [];

    const rows: SpecRow[] = rawRows
      .map((r: any) => ({
        label: String(r.label || r.key || r.name || ""),
        value: String(r.value || r.val || ""),
        emphasis: Boolean(r.emphasis || r.highlight),
      }))
      .filter((r: SpecRow) => r.label || r.value);

    if (rows.length === 0) return null;

    return { title, subtitle, rows };
  } catch {
    return null;
  }
};

const SpecSheetBlock = ({ data, isStreaming = false }: SpecSheetBlockProps) => {
  const parsed = useMemo(() => safeParseSpecSheet(data), [data]);
  const rowCount = parsed?.rows.length ?? 0;
  const [visibleCount, setVisibleCount] = useState(isStreaming ? 0 : rowCount);

  useEffect(() => {
    if (!rowCount) return;
    if (!isStreaming) {
      setVisibleCount(rowCount);
      return;
    }

    setVisibleCount(0);
    let revealed = 0;
    const timer = window.setInterval(() => {
      revealed += 1;
      setVisibleCount(revealed);
      if (revealed >= rowCount) window.clearInterval(timer);
    }, 80);

    return () => window.clearInterval(timer);
  }, [rowCount, isStreaming]);

  if (!parsed) {
    if (isStreaming) {
      return (
        <div className="flex h-28 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs text-stone-400 animate-pulse">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
          <span>Generating specification sheet...</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
        ⚠️ Unable to parse specification data.
      </div>
    );
  }

  return (
    <div className="my-2 max-w-full overflow-x-auto">
      <SpecSheet
        title={parsed.title}
        subtitle={parsed.subtitle}
        rows={parsed.rows}
        visibleCount={visibleCount || rowCount}
      />
    </div>
  );
};

export default SpecSheetBlock;

