import { NoteExportDocumentBuilder } from "./NoteExportDocumentBuilder";
import { NoteImageResolver } from "./NoteImageResolver";
import { PdfRenderer } from "./PdfRenderer";
import { PdfDeliveryService } from "./PdfDeliveryService";
import type { PdfExportOptions, PdfExportResult } from "./types";

export class PdfExportService {
  /**
   * Orchestrates the complete pipeline:
   * Build Document -> Resolve Assets -> Render PDF -> Deliver (Download or Native Share)
   */
  static async exportNote(
    note: { title?: string; content: string; updatedAt?: string },
    options: PdfExportOptions = {}
  ): Promise<PdfExportResult> {
    const startTime = performance.now();
    const rawTitle = (note.title || "Untitled Note").trim();
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "Note";
    const fileName = `${cleanTitle}.pdf`;

    options.onProgress?.("Preparing document...", 15);
    const prepared = await NoteExportDocumentBuilder.build(note, options);

    try {
      options.onProgress?.("Resolving images...", 35);
      const imageStats = await NoteImageResolver.resolveAll(prepared.element);

      options.onProgress?.("Generating PDF...", 60);
      const { blob, pageCount } = await PdfRenderer.render(prepared.element, options);

      options.onProgress?.("Delivering file...", 90);
      const fileUri = await PdfDeliveryService.deliver(blob, fileName);

      const durationMs = Math.round(performance.now() - startTime);

      return {
        blob,
        fileName,
        fileUri,
        diagnostics: {
          missingImages: imageStats.missingImages,
          totalImages: imageStats.totalImages,
          resolvedImages: imageStats.resolvedImages,
          durationMs,
          pageCount,
        },
      };
    } finally {
      prepared.cleanup();
    }
  }
}
