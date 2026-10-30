import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export class PdfDeliveryService {
  /**
   * Smart platform delivery:
   * - On Android / iOS (Capacitor): writes the file to device cache and opens the native system share sheet
   *   (enabling both saving to device files/drive and sharing to apps like WhatsApp/Gmail).
   * - On Web & Desktop: directly downloads the .pdf file to the user's downloads folder.
   */
  static async deliver(blob: Blob, fileName: string): Promise<string | undefined> {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      return await this.deliverNative(blob, fileName);
    }

    this.download(blob, fileName);
    return undefined;
  }

  /**
   * Native Capacitor file delivery via Filesystem and Share plugins.
   */
  private static async deliverNative(blob: Blob, fileName: string): Promise<string> {
    const base64Data = await this.blobToBase64(blob);
    // Sanitize path for Android filesystem
    const safePath = `exports/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const savedFile = await Filesystem.writeFile({
      path: safePath,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    const fileUri = savedFile.uri;

    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: fileName,
          files: [fileUri],
          dialogTitle: "Export PDF",
        });
      }
    } catch (err: any) {
      // User dismissing or swiping away the share sheet is normal
      if (err?.message?.includes("canceled") || err?.message?.includes("dismissed")) {
        console.log("[PdfDeliveryService] User closed native share sheet.");
      } else {
        console.warn("[PdfDeliveryService] Native share error:", err);
      }
    }

    return fileUri;
  }

  /**
   * Prompts the browser to download the blob as a file.
   */
  static download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          // Strip data URL prefix (e.g. "data:application/pdf;base64,")
          const base64 = reader.result.split(",")[1] || "";
          resolve(base64);
        } else {
          reject(new Error("FileReader did not produce string"));
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }
}
