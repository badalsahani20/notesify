import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend
);

interface ChartData {
  chartType?: "bar" | "line" | "pie" | "doughnut";
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

interface ChartBlockProps {
  data: string;
  expanded?: boolean;
}

// 🎨 Color palette
const CHART_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981",
  "#f43f5e", "#a78bfa", "#34d399", "#fb923c",
];

const looksLikePlaceholderChart = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "chart_data" ||
    normalized === "chart data" ||
    normalized === "sample chart" ||
    normalized === "placeholder" ||
    !normalized.includes("{")
  );
};

// 🔐 Safe JSON parsing (handles LLM weirdness + Chart.js native format)
const safeParse = (raw: string): ChartData | null => {
  try {
    let cleaned = raw
      .replace(/```(?:json|chart|comparison)\s*\n?/gi, "")
      .replace(/```/g, "")
      .trim();

    // Extract ONLY the JSON part (from first '{' to last '}')
    // This ignores any hallucinated text or duplicate tags the LLM adds
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    cleaned = jsonMatch[0];

    // Fix trailing commas (e.g., [1, 2, 3,] -> [1, 2, 3])
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

    const obj = JSON.parse(cleaned);

    if (!obj || typeof obj !== "object") return null;

    if (
      Object.prototype.hasOwnProperty.call(obj, "__proto__") ||
      Object.prototype.hasOwnProperty.call(obj, "constructor")
    ) {
      return null;
    }

    // ── Normalize: support both flat format AND Chart.js native format ──
    // Flat format:     { chartType, labels, datasets }
    // Chart.js format: { type, data: { labels, datasets }, options }
    let labels: string[] | undefined;
    let datasets: ChartData["datasets"] | undefined;
    let chartType: ChartData["chartType"] | undefined;

    if (Array.isArray(obj.labels) && Array.isArray(obj.datasets)) {
      // Flat format (our preferred)
      labels = obj.labels;
      datasets = obj.datasets;
      chartType = obj.chartType;
    } else if (obj.data && typeof obj.data === "object" && Array.isArray(obj.data.labels) && Array.isArray(obj.data.datasets)) {
      // Chart.js native format: { type, data: { labels, datasets } }
      labels = obj.data.labels;
      datasets = obj.data.datasets;
      chartType = obj.type || obj.chartType;
    }

    if (!labels || !datasets) return null;

    // Normalize chartType string
    const validTypes = ["bar", "line", "pie", "doughnut"] as const;
    const normalizedType = String(chartType || "bar").toLowerCase().trim();
    const resolvedType = validTypes.includes(normalizedType as any)
      ? (normalizedType as ChartData["chartType"])
      : "bar";

    return { chartType: resolvedType, labels, datasets };
  } catch (err) {
    console.error("Chart JSON Parse Error:", err);
    return null;
  }
};

// ✅ Validate data integrity (Forgiving version)
const isValidData = (d: ChartData) => {
  if (!d.labels || !d.datasets) return false;
  if (!Array.isArray(d.labels) || !Array.isArray(d.datasets)) return false;
  if (!d.labels.length || !d.datasets.length) return false;

  return d.datasets.every(ds => {
    if (!Array.isArray(ds.data)) return false;
    // Map string numbers to actual numbers if the LLM hallucinated
    ds.data = ds.data.map(n => typeof n === "string" ? parseFloat(n) : n);
    // Ensure all data points are numbers
    return ds.data.every(n => typeof n === "number" && Number.isFinite(n));
  });
};

// 🎨 Apply colors smartly
const withColors = (type: ChartData["chartType"], datasets: ChartData["datasets"]) =>
  datasets.map((ds, i) => {
    const base = CHART_COLORS[i % CHART_COLORS.length];

    // Pie/Doughnut → per slice color
    if (type === "pie" || type === "doughnut") {
      return {
        ...ds,
        backgroundColor: ds.backgroundColor ??
          ds.data.map((_, j) => CHART_COLORS[j % CHART_COLORS.length] + "cc"),
        borderColor: ds.borderColor ??
          ds.data.map((_, j) => CHART_COLORS[j % CHART_COLORS.length]),
        borderWidth: 1,
      };
    }

    // Bar/Line → per dataset color
    return {
      ...ds,
      backgroundColor: ds.backgroundColor ?? base + "cc",
      borderColor: ds.borderColor ?? base,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
    };
  });

// 📊 Chart options
const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#94a3b8" } },
    tooltip: { enabled: true },
  },
} as const;

const CARTESIAN_OPTIONS = {
  ...BASE_OPTIONS,
  scales: {
    x: { ticks: { color: "#94a3b8" }, grid: { color: "#ffffff10" } },
    y: { ticks: { color: "#94a3b8" }, grid: { color: "#ffffff10" } },
  },
};

const ChartBlock = ({ data, expanded = false }: ChartBlockProps) => {
  const parsed = safeParse(data);
  const valid = parsed && isValidData(parsed) ? parsed : null;
  const type = valid?.chartType ?? "bar";

  // Hooks must run before any conditional return.
  const chartData = useMemo(
    () => (valid ? { labels: valid.labels, datasets: withColors(type, valid.datasets) } : null),
    [valid, type]
  );

  if (looksLikePlaceholderChart(data)) {
    return (
      <div className="iris-viz-error">
        Chart data was not provided.
      </div>
    );
  }

  if (!valid || !chartData) {
    return (
      <div className="iris-viz-error">
        ⚠️ Invalid chart data
        <pre className="text-xs opacity-60">{data}</pre>
      </div>
    );
  }

  const options =
    type === "pie" || type === "doughnut"
      ? BASE_OPTIONS
      : CARTESIAN_OPTIONS;

  const props = { data: chartData, options };

  return (
    <div className={`iris-chart${expanded ? " iris-chart-expanded" : ""}`} style={{ height: expanded ? 460 : 280 }}>
      {type === "line"     && <Line {...props} />}
      {type === "pie"      && <Pie {...props} />}
      {type === "doughnut" && <Doughnut {...props} />}
      {(type === "bar")    && <Bar {...props} />}
    </div>
  );
};

export default ChartBlock;
