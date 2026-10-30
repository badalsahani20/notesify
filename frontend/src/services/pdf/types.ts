export type PdfPageSize = "a4" | "letter";
export type PdfOrientation = "portrait" | "landscape";

export interface PdfExportOptions {
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
  theme?: "light" | "dark";
  includeHeader?: boolean;
  includeDate?: boolean;
  onProgress?: (stage: string, progress: number) => void;
}

export interface ExportDiagnostics {
  missingImages: string[];
  totalImages: number;
  resolvedImages: number;
  durationMs: number;
  pageCount?: number;
}

export interface PdfExportResult {
  blob: Blob;
  fileName: string;
  fileUri?: string;
  diagnostics: ExportDiagnostics;
}

