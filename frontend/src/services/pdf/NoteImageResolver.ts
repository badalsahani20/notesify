export interface ImageResolutionStats {
  totalImages: number;
  resolvedImages: number;
  missingImages: string[];
}

export class NoteImageResolver {
  private static FETCH_TIMEOUT_MS = 4000;

  /**
   * Scans all <img> elements in the container and resolves their sources to safe,
   * offline-embeddable Data URLs. Replaces missing/blocked images with informative placeholders.
   */
  static async resolveAll(container: HTMLElement): Promise<ImageResolutionStats> {
    const imgElements = Array.from(container.querySelectorAll("img"));
    const stats: ImageResolutionStats = {
      totalImages: imgElements.length,
      resolvedImages: 0,
      missingImages: [],
    };

    if (imgElements.length === 0) {
      return stats;
    }

    const tasks = imgElements.map((img) => this.resolveSingleImage(img, stats));
    await Promise.allSettled(tasks);

    return stats;
  }

  private static async resolveSingleImage(
    img: HTMLImageElement,
    stats: ImageResolutionStats
  ): Promise<void> {
    const rawSrc = img.getAttribute("src")?.trim() || "";
    const altText = img.getAttribute("alt")?.trim() || "";

    if (!rawSrc) {
      this.replaceWithPlaceholder(img, altText, "No image source specified");
      stats.missingImages.push("(empty src)");
      return;
    }

    // 1. Data URLs are already embedded in-memory
    if (rawSrc.startsWith("data:image/")) {
      stats.resolvedImages++;
      return;
    }

    // 2. Blob or Remote URLs: convert to base64 Data URL
    try {
      const dataUrl = await this.fetchWithTimeoutToDataUrl(rawSrc, this.FETCH_TIMEOUT_MS);
      img.src = dataUrl;
      stats.resolvedImages++;
    } catch (err: any) {
      console.warn(`[NoteImageResolver] Failed to resolve image (${rawSrc}):`, err?.message || err);
      stats.missingImages.push(rawSrc);
      this.replaceWithPlaceholder(
        img,
        altText,
        "Image unavailable during export (offline or restricted)"
      );
    }
  }

  /**
   * Fetches an image URL (Blob or HTTPS) and converts it to a base64 Data URL.
   * Employs timeout racing and CORS canvas fallback.
   */
  private static async fetchWithTimeoutToDataUrl(
    url: string,
    timeoutMs: number
  ): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      // Ensure timer doesn't keep node/browser worker alive
      if (typeof timer === "object" && "unref" in timer) {
        (timer as any).unref();
      }
    });

    const fetchPromise = (async () => {
      // For blob: URLs, standard fetch is fast and local
      if (url.startsWith("blob:")) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Blob fetch failed with status ${resp.status}`);
        const blob = await resp.blob();
        return this.blobToDataUrl(blob);
      }

      // For remote URLs, try fetch first with CORS
      try {
        const resp = await fetch(url, { mode: "cors" });
        if (resp.ok) {
          const blob = await resp.blob();
          return await this.blobToDataUrl(blob);
        }
      } catch {
        // Fall back to Image loading onto canvas
      }

      // Fallback: Image object with crossOrigin
      return await this.imageElementToDataUrl(url);
    })();

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("FileReader did not produce a string"));
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }

  private static imageElementToDataUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 200;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get 2D canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => reject(new Error("Image element failed to load"));
      img.src = url;
    });
  }

  private static replaceWithPlaceholder(
    img: HTMLImageElement,
    altText: string,
    reason: string
  ): void {
    const placeholder = document.createElement("div");
    placeholder.className = "pdf-image-fallback";
    placeholder.style.border = "1.5px dashed #94a3b8";
    placeholder.style.borderRadius = "8px";
    placeholder.style.padding = "16px";
    placeholder.style.margin = "14px 0";
    placeholder.style.textAlign = "center";
    placeholder.style.backgroundColor = "rgba(148, 163, 184, 0.08)";
    placeholder.style.color = "#64748b";
    placeholder.style.fontSize = "11.5px";
    placeholder.style.lineHeight = "1.5";
    placeholder.style.breakInside = "avoid";
    placeholder.style.pageBreakInside = "avoid";

    placeholder.innerHTML = `
      <div style="font-weight: 600; color: #475569; margin-bottom: 2px;">
        🖼️ [Image unavailable during export]
      </div>
      <div style="font-size: 10.5px; opacity: 0.85;">
        ${reason}
      </div>
      ${
        altText
          ? `<div style="font-size: 10px; margin-top: 4px; font-style: italic;">
              "${this.escapeHtml(altText)}"
            </div>`
          : ""
      }
    `;

    img.replaceWith(placeholder);
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

