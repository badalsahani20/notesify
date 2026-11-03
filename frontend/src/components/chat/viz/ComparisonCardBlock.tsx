import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ComparisonCard, type ComparisonOption } from "@/components/comparison-card";

interface ComparisonCardPayload {
  traitLabels: string[];
  options: ComparisonOption[];
  recommendedId: string;
  reason: string;
}

interface ComparisonCardBlockProps {
  data: string;
  isStreaming?: boolean;
}

const safeParseComparisonCard = (raw: string): ComparisonCardPayload | null => {
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

    const traitLabels = Array.isArray(obj.traitLabels)
      ? obj.traitLabels.map(String)
      : Array.isArray(obj.traits)
      ? obj.traits.map(String)
      : [];

    const options = Array.isArray(obj.options)
      ? obj.options.map((opt: any, idx: number) => ({
          id: String(opt.id || `opt-${idx}`),
          name: String(opt.name || opt.title || `Option ${idx + 1}`),
          headline: String(opt.headline || opt.subtitle || opt.description || ""),
          traits: Array.isArray(opt.traits)
            ? opt.traits.map((t: any) => (t === false || t === null ? false : String(t)))
            : [],
        }))
      : [];

    if (options.length === 0) return null;

    const recommendedId = String(obj.recommendedId || obj.recommended || options[0].id);
    const reason = String(obj.reason || obj.summary || "");

    return {
      traitLabels,
      options,
      recommendedId,
      reason,
    };
  } catch {
    return null;
  }
};

const ComparisonCardBlock = ({ data, isStreaming = false }: ComparisonCardBlockProps) => {
  const parsed = useMemo(() => safeParseComparisonCard(data), [data]);

  if (!parsed) {
    if (isStreaming) {
      return (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs text-stone-400 animate-pulse">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
          <span>Generating comparison card...</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
        ⚠️ Unable to parse comparison card data.
      </div>
    );
  }

  return (
    <div className="my-2 max-w-full overflow-x-auto">
      <ComparisonCard
        traitLabels={parsed.traitLabels}
        options={parsed.options}
        recommendedId={parsed.recommendedId}
        reason={parsed.reason}
      />
    </div>
  );
};

export default ComparisonCardBlock;

