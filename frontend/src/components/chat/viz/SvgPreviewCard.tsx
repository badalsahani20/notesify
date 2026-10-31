import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Download,
  FileImage,
  Maximize2,
  Check,
  Code2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sanitizeAndValidateSvg, exportSvgToPng } from "@/utils/svgSanitizer";

interface SvgPreviewCardProps {
  svgCode: string;
}

export const SvgPreviewCard: React.FC<SvgPreviewCardProps> = ({ svgCode }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    initialDistance: number | null;
    initialScale: number;
    initialPosition: { x: number; y: number };
  }>({
    initialDistance: null,
    initialScale: 1,
    initialPosition: { x: 0, y: 0 },
  });
  const lastTapRef = useRef<number>(0);

  // Validate and sanitize the SVG
  const { isValid, sanitizedSvg, aspectRatio, title, error } = useMemo(
    () => sanitizeAndValidateSvg(svgCode),
    [svgCode]
  );

  const displayTitle = title || "Vector Graphic";

  // --- Zoom & Pan Controls ---
  const handleZoomIn = () => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double-tap to zoom in / reset
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scale > 1.2) {
        handleResetZoom();
      } else {
        setScale(2);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Drag pan handlers (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 && position.x === 0 && position.y === 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
    touchStateRef.current.initialDistance = null;
  };

  // Touch pan & pinch-to-zoom handlers (Mobile touch screens)
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDoubleTap();

    // 2-finger pinch gesture
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);

      touchStateRef.current = {
        initialDistance: distance,
        initialScale: scale,
        initialPosition: { ...position },
      };
      setIsDragging(false);
      return;
    }

    // 1-finger pan gesture (when zoomed in)
    if (e.touches.length === 1 && (scale > 1 || position.x !== 0 || position.y !== 0)) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Handle 2-finger pinch zoom
    if (e.touches.length === 2 && touchStateRef.current.initialDistance) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);

      const ratio = distance / touchStateRef.current.initialDistance;
      const nextScale = Math.min(
        4,
        Math.max(0.5, +(touchStateRef.current.initialScale * ratio).toFixed(2))
      );
      setScale(nextScale);
      return;
    }

    // Handle 1-finger pan
    if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  // --- Actions ---
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sanitizedSvg || svgCode);
      setCopied(true);
      toast.success("SVG source copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy SVG to clipboard");
    }
  };

  const handleDownloadSvg = () => {
    try {
      const blob = new Blob([sanitizedSvg || svgCode], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${displayTitle.toLowerCase().replace(/\s+/g, "-")}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("SVG downloaded");
    } catch {
      toast.error("Failed to download SVG");
    }
  };

  const handleExportPng = async () => {
    if (isExportingPng) return;
    setIsExportingPng(true);
    try {
      const blob = await exportSvgToPng(sanitizedSvg || svgCode, 2);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${displayTitle.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PNG exported (2x high resolution)");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PNG");
    } finally {
      setIsExportingPng(false);
    }
  };

  // Fallback for invalid SVG
  if (!isValid) {
    return (
      <div className="my-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
        <div className="flex items-center gap-2 text-amber-500 font-medium mb-2">
          <AlertCircle size={14} />
          <span>Invalid or malformed SVG structure</span>
        </div>
        <p className="text-[11px] text-[var(--muted-text)] mb-3 leading-relaxed">
          {error || "The model generated incomplete SVG code. Raw code is shown below."}
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3 text-[11px] font-mono leading-relaxed text-[var(--text-strong)] max-h-60">
          <code>{svgCode}</code>
        </pre>
      </div>
    );
  }

  return (
    <>
      <div className="my-3 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface-muted)]/50 overflow-hidden shadow-2xs transition-all duration-200 animate-in fade-in duration-300">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--divider)] bg-[var(--surface-muted)]/80 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs select-none gap-2">
          <div className="flex items-center gap-1.5 font-medium text-[var(--text-strong)] min-w-0">
            <span className="truncate text-[11px] sm:text-xs font-semibold">{displayTitle}</span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 text-[var(--muted-text)] overflow-x-auto no-scrollbar py-0.5">
            {/* Zoom Controls */}
            <div className="flex items-center border border-[var(--divider)] rounded-md bg-[var(--surface-ghost)] mr-0.5 sm:mr-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-1 sm:p-1.5 hover:text-[var(--text-strong)] disabled:opacity-40 transition-colors touch-manipulation"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1 sm:px-1.5 text-[9px] sm:text-[10px] font-mono hover:text-[var(--text-strong)] transition-colors touch-manipulation"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="p-1 sm:p-1.5 hover:text-[var(--text-strong)] disabled:opacity-40 transition-colors touch-manipulation"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn size={12} />
              </button>
              {(scale !== 1 || position.x !== 0 || position.y !== 0) && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1 sm:p-1.5 hover:text-[var(--text-strong)] border-l border-[var(--divider)] transition-colors touch-manipulation"
                  title="Reset position"
                  aria-label="Reset position"
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>

            {/* View Raw Code Toggle */}
            <button
              type="button"
              onClick={() => setShowRawCode((s) => !s)}
              className={`p-1.5 sm:p-1.5 rounded-md hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors touch-manipulation ${
                showRawCode ? "bg-[var(--accent-strong)]/10 text-[var(--accent-strong)]" : ""
              }`}
              title={showRawCode ? "Show Preview" : "View SVG Code"}
              aria-label={showRawCode ? "Show Preview" : "View SVG Code"}
            >
              <Code2 size={13} />
            </button>

            {/* Copy SVG */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors touch-manipulation"
              title="Copy SVG"
              aria-label="Copy SVG"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>

            {/* Download SVG */}
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="p-1.5 rounded-md hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors touch-manipulation"
              title="Download as .svg"
              aria-label="Download as .svg"
            >
              <Download size={13} />
            </button>

            {/* Export PNG */}
            <button
              type="button"
              onClick={handleExportPng}
              disabled={isExportingPng}
              className="p-1.5 rounded-md hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] disabled:opacity-50 transition-colors touch-manipulation"
              title="Export high-res PNG"
              aria-label="Export high-res PNG"
            >
              <FileImage size={13} />
            </button>

            {/* Maximize Fullscreen */}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1.5 rounded-md hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors touch-manipulation"
              title="Fullscreen view"
              aria-label="Fullscreen view"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Viewport Canvas or Raw Code */}
        {showRawCode ? (
          <div className="p-3 bg-[var(--surface-muted)]/30 max-h-80 overflow-auto">
            <pre className="font-mono text-[11px] leading-relaxed text-[var(--text-strong)] select-text">
              <code>{sanitizedSvg}</code>
            </pre>
          </div>
        ) : (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className={`relative w-full overflow-hidden flex items-center justify-center p-3 sm:p-4 bg-[#0a0b0e] select-none ${
              scale > 1
                ? "touch-none cursor-grab"
                : "touch-pan-y cursor-default"
            } ${isDragging ? "cursor-grabbing" : ""}`}
            style={{
              aspectRatio: `${Math.max(0.6, Math.min(3, aspectRatio))}`,
              minHeight: "200px",
              maxHeight: "480px",
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto [&_svg]:block pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
              dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
            />
          </div>
        )}
      </div>

      {/* Fullscreen Expand Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="w-[96vw] max-w-5xl h-[90vh] sm:h-[85vh] p-0 flex flex-col bg-[#0a0b0e] border-[var(--divider)] overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--divider)] px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--surface-muted)]/80 text-xs select-none gap-2">
            <DialogTitle className="font-semibold text-xs sm:text-sm text-[var(--text-strong)] truncate max-w-[130px] sm:max-w-none">
              {displayTitle}
            </DialogTitle>

            <div className="flex items-center gap-1 sm:gap-1.5 mr-6 text-[var(--muted-text)]">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 sm:px-2.5 py-1 rounded-md border border-[var(--divider)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors flex items-center gap-1.5 text-[11px] touch-manipulation"
                title="Copy SVG"
              >
                <Copy size={12} />
                <span className="hidden sm:inline">Copy SVG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="px-2 sm:px-2.5 py-1 rounded-md border border-[var(--divider)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors flex items-center gap-1.5 text-[11px] touch-manipulation"
                title="Download SVG"
              >
                <Download size={12} />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                disabled={isExportingPng}
                className="px-2 sm:px-2.5 py-1 rounded-md border border-[var(--divider)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] transition-colors flex items-center gap-1.5 text-[11px] touch-manipulation disabled:opacity-50"
                title="Export PNG"
              >
                <FileImage size={12} />
                <span className="hidden sm:inline">Export PNG</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-3 sm:p-6 bg-[#0a0b0e] [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto [&_svg]:block">
            <div
              className="w-full h-full flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SvgPreviewCard;

