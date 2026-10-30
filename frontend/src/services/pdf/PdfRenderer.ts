import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import type { PdfExportOptions } from "./types";

export interface RenderResult {
  blob: Blob;
  pageCount: number;
}

export class PdfRenderer {
  /**
   * Renders the prepared export DOM container into a binary PDF Blob.
   * Uses html2canvas-pro to support modern CSS (oklch, color-mix) and multi-page layout
   * without freezing the main thread.
   */
  static async render(
    element: HTMLElement,
    options: PdfExportOptions = {}
  ): Promise<RenderResult> {
    const orientation = options.orientation || "portrait";
    const format = options.pageSize || "a4";

    // Yield control to the browser so UI/progress updates can render
    await new Promise((resolve) => setTimeout(resolve, 30));

    const isDark = options.theme === "dark";
    const bgColor = isDark ? "#0f172a" : "#ffffff";

    // Render off-screen element using html2canvas-pro (native oklch & color-mix support)
    const canvas = await html2canvas(element, {
      scale: 2, // 2x sharp display
      useCORS: true,
      allowTaint: true,
      backgroundColor: bgColor,
      logging: false,
    });

    const pdf = new jsPDF({
      orientation,
      unit: "pt",
      format,
      compress: true,
    });

    // Page dimensions in points
    const pageWidth = format === "letter" ? 612 : 595.28;
    const pageHeight = format === "letter" ? 792 : 841.89;
    const margin = 24; // 24pt margins (~8.5mm)
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Scale factor to map canvas width -> printable width
    const scale = printableWidth / canvasWidth;
    const scaledTotalHeight = canvasHeight * scale;

    // Single-page note
    if (scaledTotalHeight <= printableHeight) {
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        margin,
        printableWidth,
        scaledTotalHeight,
        undefined,
        "FAST"
      );
      const blob = pdf.output("blob");
      return { blob, pageCount: 1 };
    }

    // Multi-page slicing: slice canvas by printableHeight
    const pageCanvasHeight = Math.floor(printableHeight / scale);
    let renderedHeight = 0;
    let pageCount = 0;

    while (renderedHeight < canvasHeight) {
      const currentSliceHeight = Math.min(pageCanvasHeight, canvasHeight - renderedHeight);

      // Create a page canvas slice
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvasWidth;
      pageCanvas.height = currentSliceHeight;

      const pageCtx = pageCanvas.getContext("2d");
      if (pageCtx) {
        pageCtx.fillStyle = bgColor;
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvasWidth,
          currentSliceHeight,
          0,
          0,
          canvasWidth,
          currentSliceHeight
        );

        if (pageCount > 0) {
          pdf.addPage(format, orientation);
        }

        const sliceImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(
          sliceImgData,
          "JPEG",
          margin,
          margin,
          printableWidth,
          currentSliceHeight * scale,
          undefined,
          "FAST"
        );
        pageCount++;
      }

      renderedHeight += currentSliceHeight;

      // Yield every 2 pages to keep the UI smooth and responsive
      if (pageCount % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const blob = pdf.output("blob");
    return { blob, pageCount: Math.max(1, pageCount) };
  }
}
