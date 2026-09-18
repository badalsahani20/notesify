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
 * Combines existing note HTML and new raw content with a clean block-level boundary.
 * Never glues blocks or inline text together.
 */
export function combineNoteContent(
  existingContent: string,
  newRawContent: string,
  mode: "append" | "replace" = "append"
): string {
  const newBlockHtml = ensureBlockHtml(newRawContent);

  if (mode === "replace" || !existingContent || !existingContent.trim()) {
    return newBlockHtml;
  }

  const existingBlockHtml = ensureBlockHtml(existingContent);
  if (!newBlockHtml) {
    return existingBlockHtml;
  }

  // Clean block boundary: ensure both existing and new blocks sit on separate lines
  return `${existingBlockHtml}\n${newBlockHtml}`;
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

    const mode = args.mode === "replace" ? "replace" : "append";
    const rawContent = typeof args.content === "string" ? args.content : "";
    
    let updatedContent = existingNote.content;

    if (rawContent && rawContent.trim()) {
      updatedContent = combineNoteContent(existingNote.content, rawContent, mode);
    }

    const updates: Partial<Note> = {};
    if (typeof args.title === "string" && args.title.trim()) {
      updates.title = args.title.trim();
    }

    if (rawContent && rawContent.trim()) {
      updates.content = updatedContent;
    }

    const updatedNote = await noteRepository.updateNote(noteId, updates, existingNote.version);

    queryClient.setQueryData(["note", noteId], updatedNote);
    queryClient.setQueryData<Note[]>(["notes"], (old = []) =>
      old.map((n) => (n._id === noteId ? { ...n, ...updatedNote } : n))
    );
    
    return {
      success: true,
      tool: "update_note",
      data: updatedNote,
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