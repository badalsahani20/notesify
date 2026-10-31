import DOMPurify, { type WindowLike } from "dompurify";

const purify =
  typeof window === "undefined" ? null : DOMPurify(window as unknown as WindowLike);

export interface SvgParseResult {
  isValid: boolean;
  sanitizedSvg: string;
  viewBox?: string;
  aspectRatio: number; // width / height
  title?: string;
  error?: string;
}

/**
 * Extracts viewBox or width/height attributes from raw SVG string.
 */
export const extractSvgDimensions = (svgString: string): { viewBox?: string; aspectRatio: number } => {
  const viewBoxMatch = svgString.match(/\bviewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return {
        viewBox: viewBoxMatch[1],
        aspectRatio: parts[2] / parts[3],
      };
    }
  }

  const widthMatch = svgString.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = svgString.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
  if (widthMatch && heightMatch) {
    const w = parseFloat(widthMatch[1]);
    const h = parseFloat(heightMatch[1]);
    if (w > 0 && h > 0) {
      return {
        viewBox: `0 0 ${w} ${h}`,
        aspectRatio: w / h,
      };
    }
  }

  // Default fallback 16:9 aspect ratio
  return {
    viewBox: undefined,
    aspectRatio: 16 / 9,
  };
};

/**
 * Sanitizes and validates an SVG string.
 * Strips scripts, event handlers, and dangerous elements while ensuring valid XML.
 */
export const sanitizeAndValidateSvg = (rawSvg: string): SvgParseResult => {
  if (!rawSvg || !purify) {
    return {
      isValid: false,
      sanitizedSvg: "",
      aspectRatio: 16 / 9,
      error: "Empty SVG content",
    };
  }

  try {
    // 1. Sanitize with DOMPurify SVG profile
    let cleaned = purify.sanitize(rawSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed", "base"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus"],
      RETURN_TRUSTED_TYPE: false,
    });

    if (!cleaned || !cleaned.includes("<svg")) {
      return {
        isValid: false,
        sanitizedSvg: "",
        aspectRatio: 16 / 9,
        error: "No valid SVG element found",
      };
    }

    // 2. Validate with DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      return {
        isValid: false,
        sanitizedSvg: cleaned,
        aspectRatio: 16 / 9,
        error: parserError.textContent || "Invalid SVG XML structure",
      };
    }

    const svgElement = doc.querySelector("svg");
    if (!svgElement) {
      return {
        isValid: false,
        sanitizedSvg: cleaned,
        aspectRatio: 16 / 9,
        error: "Missing <svg> root element",
      };
    }

    // Extract title if present
    const titleEl = svgElement.querySelector("title");
    const title = titleEl?.textContent?.trim() || undefined;

    // Ensure responsive attributes
    const { viewBox, aspectRatio } = extractSvgDimensions(cleaned);
    if (!svgElement.getAttribute("viewBox") && viewBox) {
      svgElement.setAttribute("viewBox", viewBox);
    }
    if (!svgElement.getAttribute("preserveAspectRatio")) {
      svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    // Serialized clean responsive SVG
    const serializer = new XMLSerializer();
    const finalSvg = serializer.serializeToString(svgElement);

    return {
      isValid: true,
      sanitizedSvg: finalSvg,
      viewBox: svgElement.getAttribute("viewBox") || viewBox,
      aspectRatio,
      title,
    };
  } catch (err: any) {
    return {
      isValid: false,
      sanitizedSvg: "",
      aspectRatio: 16 / 9,
      error: err.message || "Failed to parse SVG",
    };
  }
};

/**
 * Exports an SVG string to a high-resolution PNG blob using HTML Canvas.
 */
export const exportSvgToPng = (svgString: string, scale = 2): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const { viewBox, aspectRatio } = extractSvgDimensions(svgString);
      let width = 800;
      let height = 800 / aspectRatio;

      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          width = parts[2];
          height = parts[3];
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not acquire 2D canvas context"));
        return;
      }

      // Draw background (subtle dark surface for transparency clarity)
      ctx.fillStyle = "#0c0d11";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          }, "image/png");
        } catch (drawErr) {
          URL.revokeObjectURL(url);
          reject(drawErr);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG into Image element for PNG conversion"));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
};

