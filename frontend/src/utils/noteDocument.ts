import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { generateBlockId } from "@/extensions/blockIdExtension";

export type BlockType =
  | "heading"
  | "paragraph"
  | "list_item"
  | "code_block"
  | "quote"
  | "table"
  | "other";

export interface NoteBlock {
  id: string; // Guaranteed invariant in Phase 2+
  type: BlockType;
  text: string;
  parentId?: string;
  order: number;
  headingLevel?: number;
}

export interface NoteDocument {
  noteId: string;
  revisionId: number;
  blocks: NoteBlock[];
}

export interface NoteRevision {
  timestamp: number;
  document: NoteDocument;
}

/**
 * Addressable block node types that represent individual AI-indexable units.
 * Structural container nodes (bulletList, orderedList, taskList, table, tableRow, tableCell)
 * are traversed for their children and do NOT receive independent NoteBlock identities.
 */
export const ADDRESSABLE_BLOCK_TYPES = new Set<string>([
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
  "listItem",
  "taskItem",
]);

/**
 * Extracts plain text recursively from a TipTap JSON node.
 */
const extractNodeText = (node: JSONContent): string => {
  if (node.type === "text") return node.text || "";
  if (!node.content || !Array.isArray(node.content)) return "";
  return node.content.map(extractNodeText).join("");
};

/**
 * Normalization Utility (Migration / Raw Snapshot Use Only):
 * Guarantees that every addressable block node in an unmounted JSONContent tree
 * contains a valid blockId attribute without mutating caller-owned JSON.
 * Active editor instances establish and persist block identity via BlockIdExtension.
 */
export const ensureBlockIds = (json: JSONContent): JSONContent => {
  if (!json || !json.content || !Array.isArray(json.content)) return json;

  const cloned: JSONContent = JSON.parse(JSON.stringify(json));
  const seenIds = new Set<string>();

  const traverse = (nodes: JSONContent[]) => {
    for (const node of nodes) {
      if (node.type && ADDRESSABLE_BLOCK_TYPES.has(node.type)) {
        if (!node.attrs) node.attrs = {};
        const existingId = (node.attrs.blockId || node.attrs["data-block-id"]) as string | undefined;
        if (!existingId || seenIds.has(existingId)) {
          const newId = generateBlockId();
          node.attrs.blockId = newId;
          seenIds.add(newId);
        } else {
          node.attrs.blockId = existingId;
          seenIds.add(existingId);
        }
      }
      if (node.content && Array.isArray(node.content)) {
        traverse(node.content);
      }
    }
  };

  traverse(cloned.content || []);
  return cloned;
};

/**
 * Converts a normalized TipTap document structure (from Editor or raw JSONContent) into a canonical NoteDocument.
 * 
 * Invariants:
 * 1. PURE READ: Never mutates the source document or generates temporary IDs.
 * 2. STRICT IDENTITY: Assumes the document has already been normalized by BlockIdExtension
 *    (in an active editor) or ensureBlockIds (for raw snapshot migration).
 *    Addressable blocks lacking a persistent blockId are skipped with a warning.
 * 3. STRUCTURAL SEPARATION: Container nodes (lists, tables) are traversed for children,
 *    not emitted as NoteBlocks themselves.
 */
export const tipTapToNoteDocument = (
  source: Editor | JSONContent | null | undefined,
  noteId: string,
  revisionId: number = 0
): NoteDocument => {
  if (!source) {
    return {
      noteId,
      revisionId,
      blocks: [],
    };
  }

  const jsonContent: JSONContent =
    "getJSON" in source && typeof source.getJSON === "function"
      ? source.getJSON()
      : (source as JSONContent);

  if (!jsonContent || !jsonContent.content || !Array.isArray(jsonContent.content)) {
    return {
      noteId,
      revisionId,
      blocks: [],
    };
  }

  const blocks: NoteBlock[] = [];
  let orderCounter = 0;

  const traverseNodes = (nodes: JSONContent[], parentId?: string) => {
    for (const node of nodes) {
      if (!node || !node.type) continue;

      const isAddressable = ADDRESSABLE_BLOCK_TYPES.has(node.type);

      if (isAddressable) {
        let type: BlockType = "other";
        let headingLevel: number | undefined;

        switch (node.type) {
          case "heading":
            type = "heading";
            headingLevel = node.attrs?.level || 1;
            break;
          case "paragraph":
            type = "paragraph";
            break;
          case "listItem":
          case "taskItem":
            type = "list_item";
            break;
          case "codeBlock":
            type = "code_block";
            break;
          case "blockquote":
            type = "quote";
            break;
          default:
            type = "other";
        }

        const text = extractNodeText(node).trim();
        const blockId = (node.attrs?.blockId || node.attrs?.["data-block-id"] || "") as string;

        // Invariant: An addressable block MUST have a persistent blockId.
        if (!blockId) {
          if (import.meta.env.DEV) {
            console.warn(
              `[tipTapToNoteDocument] Addressable block <${node.type}> missing persistent blockId. Skipping unnormalized block.`
            );
          }
        } else if (text || type === "heading" || type === "code_block") {
          blocks.push({
            id: blockId,
            type,
            text,
            parentId,
            order: orderCounter++,
            headingLevel,
          });
        }

        // Recursively traverse compound addressable blocks (e.g. blockquote, listItem)
        if (node.content && Array.isArray(node.content) && node.type !== "paragraph" && node.type !== "heading") {
          traverseNodes(node.content, blockId || parentId);
        }
      } else {
        // Container nodes (e.g. bulletList, orderedList, taskList, table, tableRow, tableCell):
        // Traverse children without registering the container as a block
        if (node.content && Array.isArray(node.content)) {
          traverseNodes(node.content, parentId);
        }
      }
    }
  };

  traverseNodes(jsonContent.content || []);

  return {
    noteId,
    revisionId,
    blocks,
  };
};

/**
 * Returns the NoteBlock currently at the editor cursor position.
 * Uses structural document depth traversal to read block identity directly from ProseMirror nodes.
 * Returns null if the cursor is outside an addressable block.
 */
export const getBlockAtCursor = (
  editor: Editor | null,
  noteId: string,
  existingDoc?: NoteDocument
): NoteBlock | null => {
  if (!editor) return null;

  const doc = existingDoc ?? tipTapToNoteDocument(editor, noteId);
  if (doc.blocks.length === 0) return null;

  const { $from } = editor.state.selection;

  // Walk up node tree depth from deepest node to depth 1 to find addressable node carrying a block ID
  let blockId: string | null = null;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node && ADDRESSABLE_BLOCK_TYPES.has(node.type.name)) {
      const id = (node.attrs?.blockId || node.attrs?.["data-block-id"]) as string | undefined;
      if (id) {
        blockId = id;
        break;
      }
    }
  }

  if (blockId) {
    const matchedBlock = doc.blocks.find((b) => b.id === blockId);
    if (matchedBlock) return matchedBlock;
  }

  // Explicit failure: do NOT silently fall back to doc.blocks[0]
  return null;
};

/**
 * Returns array of NoteBlocks spanning selection range from -> to.
 * Uses ProseMirror nodesBetween range traversal to collect intersecting addressable block IDs.
 * Preserves document order.
 */
export const getBlocksInRange = (
  editor: Editor | null,
  noteId: string,
  from: number,
  to: number,
  existingDoc?: NoteDocument
): NoteBlock[] => {
  if (!editor) return [];

  const doc = existingDoc ?? tipTapToNoteDocument(editor, noteId);
  if (doc.blocks.length === 0) return [];

  if (from === to) {
    const block = getBlockAtCursor(editor, noteId, doc);
    return block ? [block] : [];
  }

  const selectedBlockIds = new Set<string>();

  editor.state.doc.nodesBetween(from, to, (node) => {
    if (ADDRESSABLE_BLOCK_TYPES.has(node.type.name)) {
      const id = (node.attrs?.blockId || node.attrs?.["data-block-id"]) as string | undefined;
      if (id) {
        selectedBlockIds.add(id);
      }
    }
  });

  if (selectedBlockIds.size === 0) return [];

  // Filter doc.blocks to preserve document order
  return doc.blocks.filter((b) => selectedBlockIds.has(b.id));
};
