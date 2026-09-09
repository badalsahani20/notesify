import type { Editor } from "@tiptap/react";
import {
  tipTapToNoteDocument,
  getBlockAtCursor,
  getBlocksInRange,
  type NoteBlock,
  type NoteDocument,
} from "@/utils/noteDocument";
import { getSelection } from "@/utils/ai/aiContext";

export interface StructuredSelection {
  text: string;
  blockIds: string[];
}

export interface StructuredNoteContext {
  noteId: string;
  revisionId: number;
  hasSelection: boolean;
  selection?: StructuredSelection;
  activeBlock?: NoteBlock;
  surroundingBlocks: NoteBlock[];
  headingPath: string[];
}

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
}

/**
 * Resolves the parent heading hierarchy up to the active block position.
 */
export const getHeadingPathToBlock = (
  doc: NoteDocument,
  activeBlock: NoteBlock | null
): string[] => {
  if (!activeBlock) return [];
  const headingStack: HeadingEntry[] = [];

  for (const block of doc.blocks) {
    if (block.order >= activeBlock.order) break;

    if (block.type === "heading" && block.headingLevel !== undefined) {
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= block.headingLevel
      ) {
        headingStack.pop();
      }
      headingStack.push({
        id: block.id,
        text: block.text,
        level: block.headingLevel,
      });
    }
  }

  return headingStack.map((h) => h.text);
};

const NEIGHBORHOOD_RADIUS = 3;

/**
 * Builds a structured document neighborhood for an AI request.
 */
export const buildNoteContext = (
  editor: Editor | null,
  noteId: string,
  revisionId: number
): StructuredNoteContext => {
  const document = tipTapToNoteDocument(editor, noteId, revisionId);
  const { text: selectionText, range } = getSelection(editor);

  // ── SELECTION CASE ──────────────────────────────────────────────────────────
  if (range && selectionText) {
    const selectedBlocks = getBlocksInRange(
      editor,
      noteId,
      range.from,
      range.to,
      document
    );
    // WHAT + WHERE: Preserve heading hierarchy breadcrumbs for the selected block
    const headingPath =
      selectedBlocks.length > 0
        ? getHeadingPathToBlock(document, selectedBlocks[0])
        : [];

    return {
      noteId,
      revisionId,
      hasSelection: true,
      selection: {
        text: selectionText,
        blockIds: selectedBlocks.map((b) => b.id),
      },
      surroundingBlocks: selectedBlocks,
      headingPath,
    };
  }

  // ── NO-SELECTION CASE (Active Block + Neighborhood) ────────────────────────
  const activeBlock = getBlockAtCursor(editor, noteId, document);

  let surroundingBlocks: NoteBlock[] = [];
  if (activeBlock && document.blocks.length > 0) {
    const activeIndex = document.blocks.findIndex((b) => b.id === activeBlock.id);
    if (activeIndex !== -1) {
      const startIndex = Math.max(0, activeIndex - NEIGHBORHOOD_RADIUS);
      const endIndex = Math.min(
        document.blocks.length,
        activeIndex + NEIGHBORHOOD_RADIUS + 1
      );
      surroundingBlocks = document.blocks.slice(startIndex, endIndex);
    } else {
      // Explicit fallback when active block cannot be found in indexed blocks
      surroundingBlocks = document.blocks.slice(0, NEIGHBORHOOD_RADIUS * 2);
    }
  } else {
    surroundingBlocks = document.blocks.slice(0, NEIGHBORHOOD_RADIUS * 2);
  }

  const headingPath = getHeadingPathToBlock(document, activeBlock);

  return {
    noteId,
    revisionId,
    hasSelection: false,
    activeBlock: activeBlock || undefined,
    surroundingBlocks,
    headingPath,
  };
};