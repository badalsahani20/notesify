import mermaid from "mermaid";
import type { PdfExportOptions } from "./types";

export interface PreparedExportDocument {
  element: HTMLElement;
  cleanup: () => void;
}

export class NoteExportDocumentBuilder {
  /**
   * Builds an isolated DOM element prepared specifically for PDF generation.
   * Excludes any editor chrome, adds print styles, and converts diagrams.
   */
  static async build(
    note: { title?: string; content: string; updatedAt?: string },
    options: PdfExportOptions = {}
  ): Promise<PreparedExportDocument> {
    const isDark = options.theme === "dark";
    const container = document.createElement("div");

    // Off-screen rendering container
    container.className = "pdf-export-root";
    container.style.isolation = "isolate";
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "750px"; // standard A4 printable pixel width at 96 DPI
    container.style.zIndex = "-9999";
    container.style.background = isDark ? "#0f172a" : "#ffffff";
    container.style.color = isDark ? "#f1f5f9" : "#0f172a";
    container.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.fontSize = "13px";
    container.style.lineHeight = "1.65";
    container.style.padding = "32px 36px";
    container.style.boxSizing = "border-box";

    // ── Build Header ─────────────────────────────────────────────────────────
    const titleText = (note.title || "Untitled Note").trim();
    const formattedDate = note.updatedAt
      ? new Date(note.updatedAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString();

    let headerHtml = "";
    if (options.includeHeader !== false) {
      headerHtml = `
        <div style="margin-bottom: 24px; padding-bottom: 14px; border-bottom: 2px solid ${
          isDark ? "#334155" : "#e2e8f0"
        };">
          <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 700; color: ${
            isDark ? "#ffffff" : "#09090b"
          }; letter-spacing: -0.02em; line-height: 1.25;">
            ${escapeHtml(titleText)}
          </h1>
          ${
            options.includeDate !== false
              ? `<div style="font-size: 11px; color: ${
                  isDark ? "#94a3b8" : "#64748b"
                }; font-weight: 500;">
                  Exported from Notesify • ${escapeHtml(formattedDate)}
                </div>`
              : ""
          }
        </div>
      `;
    }

    // ── Print Specific Styles ────────────────────────────────────────────────
    const styles = `
      <style>
        .pdf-export-body h1, .pdf-export-body h2, .pdf-export-body h3, 
        .pdf-export-body h4, .pdf-export-body h5, .pdf-export-body h6 {
          break-after: avoid;
          page-break-after: avoid;
          color: ${isDark ? "#f8fafc" : "#0f172a"};
          font-weight: 700;
          line-height: 1.3;
        }
        .pdf-export-body h1 { font-size: 22px; margin: 24px 0 10px 0; }
        .pdf-export-body h2 { font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid ${isDark ? "#334155" : "#e2e8f0"}; padding-bottom: 4px; }
        .pdf-export-body h3 { font-size: 15px; margin: 16px 0 6px 0; }
        .pdf-export-body h4 { font-size: 13.5px; margin: 14px 0 4px 0; }

        .pdf-export-body p {
          margin: 0 0 10px 0;
          color: ${isDark ? "#cbd5e1" : "#334155"};
        }

        .pdf-export-body blockquote {
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 14px 0;
          padding: 8px 14px;
          border-left: 3.5px solid #6366f1;
          background: ${isDark ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.05)"};
          color: ${isDark ? "#e2e8f0" : "#374151"};
          border-radius: 0 6px 6px 0;
          font-style: italic;
        }

        .pdf-export-body pre {
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 14px 0;
          padding: 12px 14px;
          background: ${isDark ? "#020617" : "#f8fafc"};
          border: 1px solid ${isDark ? "#1e293b" : "#e2e8f0"};
          border-radius: 8px;
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
          font-size: 11px;
          line-height: 1.5;
          color: ${isDark ? "#e2e8f0" : "#0f172a"};
          white-space: pre-wrap;
          word-break: break-all;
          overflow: hidden;
        }

        .pdf-export-body code:not(pre code) {
          padding: 1.5px 5px;
          border-radius: 4px;
          background: ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"};
          color: ${isDark ? "#93c5fd" : "#2563eb"};
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-size: 0.9em;
        }

        .pdf-export-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 11.5px;
          break-inside: auto;
          page-break-inside: auto;
        }

        .pdf-export-body th, .pdf-export-body td {
          padding: 7px 10px;
          border: 1px solid ${isDark ? "#334155" : "#cbd5e1"};
          text-align: left;
        }

        .pdf-export-body th {
          background: ${isDark ? "#1e293b" : "#f1f5f9"};
          font-weight: 600;
          color: ${isDark ? "#f8fafc" : "#0f172a"};
        }

        .pdf-export-body tr:nth-child(even) td {
          background: ${isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)"};
        }

        .pdf-export-body ul, .pdf-export-body ol {
          margin: 0 0 10px 0;
          padding-left: 22px;
          color: ${isDark ? "#cbd5e1" : "#334155"};
        }

        .pdf-export-body li {
          margin-bottom: 4px;
        }

        .pdf-export-body li[data-type="taskItem"] {
          list-style: none;
          margin-left: -18px;
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        .pdf-export-body hr {
          border: none;
          border-top: 1px solid ${isDark ? "#334155" : "#e2e8f0"};
          margin: 20px 0;
        }

        .pdf-export-body img {
          break-inside: avoid;
          page-break-inside: avoid;
          max-width: 100% !important;
          height: auto !important;
          border-radius: 6px;
          display: block;
          margin: 14px auto;
        }

        .pdf-export-body a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .pdf-export-diagram {
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 16px 0;
          padding: 12px;
          background: ${isDark ? "#090d16" : "#f8fafc"};
          border: 1px solid ${isDark ? "#1e293b" : "#e2e8f0"};
          border-radius: 8px;
          display: flex;
          justify-content: center;
        }
      </style>
    `;

    container.innerHTML = `
      ${styles}
      ${headerHtml}
      <div class="pdf-export-body">
        ${note.content || "<p><em>Empty note</em></p>"}
      </div>
    `;

    // ── Clean up editor-specific chrome ──────────────────────────────────────
    // Remove delete buttons, drag handles, bubble menus, etc.
    const editorArtifacts = container.querySelectorAll(
      "button, .editor-code-block-header, [contenteditable='false']:not(img):not(svg):not(table)"
    );
    editorArtifacts.forEach((el) => {
      // Keep taskItem checkboxes, remove interactive buttons
      if (el.tagName === "BUTTON") {
        el.remove();
      }
    });

    // ── Render Mermaid diagrams to clean SVGs ────────────────────────────────
    await this.renderMermaidDiagrams(container, isDark);

    // Append to DOM so layout engines can compute bounding boxes and styles
    document.body.appendChild(container);

    return {
      element: container,
      cleanup: () => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      },
    };
  }

  /**
   * Finds code blocks with language="mermaid" and converts them to SVG vectors
   */
  private static async renderMermaidDiagrams(root: HTMLElement, isDark: boolean): Promise<void> {
    const codeBlocks = Array.from(root.querySelectorAll("pre code"));
    
    // Check if mermaid is needed
    const mermaidNodes: { block: HTMLElement; code: string }[] = [];
    for (const codeEl of codeBlocks) {
      const isMermaid =
        codeEl.classList.contains("language-mermaid") ||
        codeEl.classList.contains("language-mermaid-code") ||
        /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(
          codeEl.textContent || ""
        );

      if (isMermaid) {
        const pre = codeEl.closest("pre");
        if (pre) {
          mermaidNodes.push({ block: pre, code: codeEl.textContent || "" });
        }
      }
    }

    if (mermaidNodes.length === 0) return;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "inherit",
        themeVariables: {
          background: "transparent",
        },
      });

      for (let i = 0; i < mermaidNodes.length; i++) {
        const { block, code } = mermaidNodes[i];
        const id = `pdf-mermaid-${Date.now()}-${i}`;
        try {
          const { svg } = await mermaid.render(id, code.trim());
          const wrapper = document.createElement("div");
          wrapper.className = "pdf-export-diagram";
          wrapper.innerHTML = svg;
          block.replaceWith(wrapper);
        } catch (e) {
          console.warn("Failed to render diagram for PDF export:", e);
          // Keep the raw pre/code block if diagram compilation fails
        }
      }
    } catch (e) {
      console.warn("Mermaid initialization failed:", e);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

