import { noteRepository } from "@/repositories";
import { queryClient } from "@/lib/queryClient";
import { addNoteToList } from "@/hooks/notes/useNotesMutations";
import { markdownToHtml } from "@/utils/markdownToHtml";
import type { Note } from "@/store/useNoteStore";

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  data?: any;
  error?: string;
}

/**
 * Ensures that all top-level elements are wrapped in valid HTML block elements
 * so TipTap and ProseMirror treat them as discrete document blocks.
 */
export function ensureBlockHtml(content: string): string {
  if (!content || !content.trim()) return "";
  let trimmed = content.trim();

  // If content is Markdown (no HTML block tags detected), convert to HTML
  const hasHtmlBlock = /<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|hr)[^>]*>/i.test(trimmed);
  if (!hasHtmlBlock) {
    trimmed = markdownToHtml(trimmed).trim();
  }

  // Ensure top-level element is enclosed in a block tag
  const isBlockStart = /^<(p|h[1-6]|ul|ol|pre|blockquote|table|hr|div)\b/i.test(trimmed);
  if (!isBlockStart) {
    trimmed = `<p>${trimmed}</p>`;
  }

  return trimmed;
}

/**
 * Decodes standard HTML entities into plain characters for matching
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex that matches target text tokens across HTML tags, entities, and whitespace.
 */
function buildHtmlFlexibleRegex(target: string, maxWords?: number): RegExp | null {
  const clean = target
    .replace(/^[#*`_~\s>0-9.)-]+/u, "")
    .replace(/[#*`_~\s]+$/u, "")
    .trim();

  let words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  if (maxWords && words.length > maxWords) {
    words = words.slice(0, maxWords);
  }

  const escapedWords = words.map((w) => escapeRegex(decodeHtmlEntities(w)));
  const separator = "(?:\\s|<[^>]+>|&(?:nbsp|amp|quot|#39|lt|gt);)+";
  const pattern = escapedWords.join(separator);

  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/**
 * Attempts to locate and replace targetText inside HTML existingContent using
 * multiple strategies: literal match, markdown match, HTML-tag agnostic regex, and anchor match.
 */
export function replaceTargetInHtml(
  existingContent: string,
  targetText: string,
  replacementHtml: string
): string | null {
  if (!targetText || !targetText.trim() || !existingContent) return null;
  const target = targetText.trim();

  // 1. Literal match in raw HTML
  if (existingContent.includes(target)) {
    return existingContent.replace(target, replacementHtml);
  }

  // 2. Markdown-to-HTML target match
  try {
    const mdHtml = markdownToHtml(target).trim();
    if (mdHtml && existingContent.includes(mdHtml)) {
      return existingContent.replace(mdHtml, replacementHtml);
    }
  } catch {
    // Ignore markdown parse error
  }

  // 3. Full HTML-agnostic token regex match (handles tags like </h3><p>, <strong>, &nbsp; between words)
  const fullRegex = buildHtmlFlexibleRegex(target);
  if (fullRegex) {
    const match = fullRegex.exec(existingContent);
    if (match && typeof match.index === "number") {
      let startIndex = match.index;
      let endIndex = match.index + match[0].length;

      // Expand to enclosing block boundary if target started/ended at block boundaries
      const before = existingContent.slice(0, startIndex);
      const openTagMatch = before.match(/<([a-z0-9]+)[^>]*>\s*$/i);
      const closedTagMatch = existingContent.slice(endIndex).match(/^\s*<\/([a-z0-9]+)>/i);

      if (openTagMatch && closedTagMatch) {
        startIndex = before.length - openTagMatch[0].length;
        endIndex = endIndex + closedTagMatch[0].length;
      }

      return existingContent.slice(0, startIndex) + replacementHtml + existingContent.slice(endIndex);
    }
  }

  // 4. Section Anchor match: if target is long (e.g. heading + paragraph), match by first 8-10 words
  const anchorRegex = buildHtmlFlexibleRegex(target, 8);
  if (anchorRegex) {
    const anchorMatch = anchorRegex.exec(existingContent);
    if (anchorMatch && typeof anchorMatch.index === "number") {
      let startIndex = anchorMatch.index;
      const before = existingContent.slice(0, startIndex);
      const openTagMatch = before.match(/<([a-z0-9]+)[^>]*>\s*$/i);
      if (openTagMatch) {
        startIndex = before.length - openTagMatch[0].length;
      }

      // Find the end of the block or section following the anchor
      const afterSlice = existingContent.slice(startIndex);
      const blockEndMatch = afterSlice.match(/<\/(p|div|section|blockquote|li|h[1-6])>/i);
      if (blockEndMatch && typeof blockEndMatch.index === "number") {
        const endIndex = startIndex + blockEndMatch.index + blockEndMatch[0].length;
        return existingContent.slice(0, startIndex) + replacementHtml + existingContent.slice(endIndex);
      }
    }
  }

  return null;
}

/**
 * Surgically replaces a block in note HTML using its persistent data-block-id attribute.
 * Uses native DOMParser in browser environments and clean tag regex in node/test environments.
 */
export function replaceBlockById(
  existingContent: string,
  blockId: string,
  replacementHtml: string
): string | null {
  if (!blockId || !existingContent) return null;
  const cleanId = blockId.trim();

  // Browser / DOM environment
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(existingContent, "text/html");
      const targetElement = doc.querySelector(`[data-block-id="${cleanId}"]`);
      if (targetElement) {
        const temp = doc.createElement("div");
        temp.innerHTML = replacementHtml;
        targetElement.replaceWith(...Array.from(temp.childNodes));
        return doc.body.innerHTML;
      }
    } catch (e) {
      console.warn("[LOCAL EXECUTOR] DOMParser replaceBlockById failed:", e);
    }
  }

  // Regex fallback (Node test environment or where DOMParser is unavailable)
  const escapedId = escapeRegex(cleanId);
  const blockRegex = new RegExp(
    `<([a-z0-9]+)[^>]*data-block-id=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    "i"
  );
  if (blockRegex.test(existingContent)) {
    return existingContent.replace(blockRegex, replacementHtml);
  }

  return null;
}

/**
 * Combines existing note HTML and new raw content with a clean block-level boundary.
 * Never glues blocks or inline text together.
 */
export function combineNoteContent(
  existingContent: string,
  newRawContent: string,
  mode: "append" | "prepend" | "replace_target" | "full_replace" | "replace" = "append",
  targetContent?: string,
  replacementContent?: string,
  blockId?: string
): string {
  const replacementHtml = ensureBlockHtml(replacementContent || newRawContent);

  if (mode === "full_replace" || mode === "replace" || !existingContent || !existingContent.trim()) {
    return replacementHtml;
  }

  const existingBlockHtml = ensureBlockHtml(existingContent);
  if (!replacementHtml) {
    return existingBlockHtml;
  }

  // Prepend to top
  if (mode === "prepend") {
    return `${replacementHtml}\n${existingBlockHtml}`;
  }

  // 1. PRIMARY TARGETING: Direct Block ID Replacement (Option 2 - Gold Standard)
  const cleanBlockId = (blockId || "").trim();
  if (cleanBlockId) {
    const replaced = replaceBlockById(existingContent, cleanBlockId, replacementHtml);
    if (replaced !== null) {
      return replaced;
    }
    console.warn(`[LOCAL EXECUTOR] Block ID "${cleanBlockId}" not located in note content. Checking targetContent fallback.`);
  }

  // 2. SECONDARY TARGETING: HTML-Aware Target Replacement
  const target = (targetContent || "").trim();
  if (mode === "replace_target" || target) {
    if (target) {
      const replaced = replaceTargetInHtml(existingContent, target, replacementHtml);
      if (replaced !== null) {
        return replaced;
      }
      console.warn(`[LOCAL EXECUTOR] Target content "${target.slice(0, 60)}" not located in note. Appending replacement instead.`);
    }
  }

  // Default: Append with clean block boundary
  return `${existingBlockHtml}\n${replacementHtml}`;
}

// Executes a tool locally in the browser/desktop workspace 
export async function executeClientTool(tool: string, args: Record<string, any> = {}): Promise<ToolExecutionResult> {
  switch (tool) {
    case "create_note": 
      return await executeCreateNote(args);
    case "update_note":
      return await executeUpdateNote(args);
    default: 
      return {
        success: false,
        tool,
        error: `Unsupported tool: ${tool}`
      };
  }
}

async function executeCreateNote(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const rawContent = typeof args.content === "string" ? args.content : "";
    const htmlContent = rawContent ? ensureBlockHtml(rawContent) : "";

    const newNote = await noteRepository.createNote({
      title,
      content: htmlContent,
    });

    queryClient.setQueryData<Note[]>(["notes"], (old = []) => 
      addNoteToList(old, newNote)
    );
    queryClient.setQueryData(["note", newNote._id], newNote);
    
    return {
      success: true,
      tool: "create_note",
      data: newNote,
    };
  } catch (err: any) {
    console.error("❌ [LOCAL EXECUTOR] create_note failed:", err);
    return {
      success: false,
      tool: "create_note",
      error: err.message || "Failed to create note locally",
    };
  }
}

async function executeUpdateNote(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const noteId = args.noteId || args.id;
    if (!noteId) {
      throw new Error("Missing noteId for update_note");
    }

    const existingNote = await noteRepository.getNote(noteId);
    if (!existingNote) {
      throw new Error(`Note not found with id: ${noteId}`);
    }

    const blockId = typeof args.blockId === "string" ? args.blockId.trim() : "";
    const targetContent = typeof args.targetContent === "string" ? args.targetContent : "";
    const replacementContent = typeof args.replacementContent === "string" ? args.replacementContent : "";
    const rawContent = typeof args.content === "string" ? args.content : "";
    const mode = args.mode || (blockId || targetContent ? "replace_target" : "append");
    
    let updatedContent = existingNote.content;
    const hasContentChange = Boolean(rawContent.trim() || replacementContent.trim() || targetContent.trim() || blockId);

    if (hasContentChange) {
      updatedContent = combineNoteContent(existingNote.content, rawContent, mode, targetContent, replacementContent, blockId);
    }

    const updates: Partial<Note> = {};
    if (typeof args.title === "string" && args.title.trim()) {
      updates.title = args.title.trim();
    }

    if (hasContentChange) {
      updates.content = updatedContent;
    }

    const updatedNote = await noteRepository.updateNote(noteId, updates, existingNote.version);

    queryClient.setQueryData(["note", noteId], updatedNote);
    queryClient.setQueryData<Note[]>(["notes"], (old = []) =>
      old.map((n) => (n._id === noteId ? { ...n, ...updatedNote } : n))
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("notesify:conflict-resolved", {
          detail: { entityId: noteId, note: updatedNote },
        })
      );
    }
    
    return {
      success: true,
      tool: "update_note",
      data: {
        _id: updatedNote._id,
        noteId: updatedNote._id,
        title: updatedNote.title,
        content: updatedContent,
        updatedContentSnippet: updatedContent.slice(0, 150),
      },
    };
  } catch (err: any) {
    console.error("❌ [LOCAL EXECUTOR] update_note failed:", err);
    return {
      success: false,
      tool: "update_note",
      error: err.message || "Failed to update note locally",
    };
  }
}