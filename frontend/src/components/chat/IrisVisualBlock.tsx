import { useState, useEffect, lazy, Suspense } from "react";
import { Expand, Loader2, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import type { IrisSegment } from "@/store/useGlobalChatStore";

const MermaidDiagram = lazy(() => import("./viz/MermaidDiagram"));
const ChartBlock = lazy(() => import("./viz/ChartBlock"));
const MathBlock = lazy(() => import("./viz/MathBlock"));

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type VizSegment = Extract<IrisSegment, { kind: "viz" }>;

interface IrisVisualBlockProps {
  visualization: VizSegment;
}

const IrisVisualBlock = ({ visualization: v }: IrisVisualBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const isMath = v.type === "math";

  useEffect(() => {
    if (!isExpanded) {
      setScale(1);
    }
  }, [isExpanded]);

  const renderViz = (expanded = false) => {
    switch (v.type) {
      case "mermaid":
        return <MermaidDiagram code={v.data} />;
      case "chart":
        return <ChartBlock data={v.data} expanded={expanded} />;
      case "math":
        return <MathBlock formula={v.data} />;
      default:
        return (
          <div className="iris-viz-error">
            ⚠️ Unsupported visualization type: {v.type}
          </div>
        );
    }
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className={`iris-viz-block ${v.isStreaming ? "iris-viz-streaming" : ""}`}
    >
      {v.isStreaming ? (
        <div className={isMath ? "py-2" : ""}>
          {v.title && v.title !== "Visualization" && <p className="iris-viz-title">{v.title}</p>}
          <div className={`flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center ${isMath ? "h-16" : "h-36 flex-col"}`}>
            <Loader2 className={`animate-spin text-indigo-500 ${isMath ? "h-4 w-4 mr-2" : "h-6 w-6 mb-2"}`} />
            <div>
              <p className="text-sm font-semibold text-white">
                {isMath ? "Formatting equation..." : `Generating ${v.type === "chart" ? "chart" : "diagram"}...`}
              </p>
              {!isMath && <p className="text-xs text-stone-500 mt-1">Please wait while the visualization compiles.</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {v.title && <p className="iris-viz-title">{v.title}</p>}
          <button
            type="button"
            className="iris-viz-surface"
            onClick={() => setIsExpanded(true)}
            aria-label={v.title ? `Expand ${v.title}` : "Expand diagram"}
          >
            <span className="iris-viz-expand" aria-hidden="true">
              <Expand size={16} />
            </span>
            <Suspense fallback={
              <div className="flex h-36 items-center justify-center rounded-xl bg-white/[0.03] animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500/50" />
              </div>
            }>
              {renderViz(false)}
            </Suspense>
          </button>
          <div className="iris-viz-footer">
            <button 
              className="iris-viz-btn"
              onClick={() => setIsExpanded(true)}
            >
              <Expand size={12} />
              <span>View Full Diagram</span>
            </button>
          </div>
        </>
      )}
    </motion.div>
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent
        className="iris-viz-modal"
        showCloseButton={true}
        aria-describedby={undefined}
      >
        <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-2.5 mb-1.5 gap-2">
          <DialogTitle className="iris-viz-modal-title !mb-0 !pb-0">
            {v.title || "Expanded diagram"}
          </DialogTitle>
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1 rounded-lg">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              disabled={scale <= 0.5}
              className="p-1 rounded hover:bg-white/5 disabled:opacity-40 text-stone-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono font-medium min-w-[36px] text-center text-stone-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.1))}
              disabled={scale >= 3}
              className="p-1 rounded hover:bg-white/5 disabled:opacity-40 text-stone-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />
            <button
              onClick={() => setScale(1)}
              disabled={scale === 1}
              className="p-1 rounded hover:bg-white/5 disabled:opacity-40 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 text-[10px] font-semibold"
              title="Reset Zoom"
            >
              <RefreshCw size={10} />
              <span>Reset</span>
            </button>
          </div>
        </div>
        <div className="iris-viz-modal-body">
          <div style={{ zoom: scale, width: "100%", height: "100%" }}>
            <Suspense fallback={
               <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
               </div>
            }>
              {renderViz(true)}
            </Suspense>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default IrisVisualBlock;
