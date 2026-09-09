import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  tipTapToNoteDocument,
  ensureBlockIds,
  ADDRESSABLE_BLOCK_TYPES,
} from "./noteDocument";

describe("noteDocument invariants", () => {
  it("tipTapToNoteDocument is a pure read and does NOT mutate source JSON", () => {
    const source: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "b_1" },
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    const snapshot = JSON.stringify(source);
    const doc = tipTapToNoteDocument(source, "note_1", 2);

    expect(JSON.stringify(source)).toBe(snapshot);
    expect(doc.noteId).toBe("note_1");
    expect(doc.revisionId).toBe(2);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0]).toEqual({
      id: "b_1",
      type: "paragraph",
      text: "Hello world",
      parentId: undefined,
      order: 0,
      headingLevel: undefined,
    });
  });

  it("tipTapToNoteDocument skips unnormalized blocks missing blockId without inventing IDs", () => {
    const source: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          // missing blockId
          content: [{ type: "text", text: "Unnormalized paragraph" }],
        },
        {
          type: "paragraph",
          attrs: { blockId: "b_valid" },
          content: [{ type: "text", text: "Normalized paragraph" }],
        },
      ],
    };

    const doc = tipTapToNoteDocument(source, "note_1");
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].id).toBe("b_valid");
    expect(doc.blocks[0].text).toBe("Normalized paragraph");
    expect(doc.blocks[0].order).toBe(0);
  });

  it("does not treat container nodes (bulletList, orderedList) as NoteBlocks", () => {
    const source: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              attrs: { blockId: "b_item_1" },
              content: [
                {
                  type: "paragraph",
                  attrs: { blockId: "b_p_1" },
                  content: [{ type: "text", text: "Bullet 1" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const doc = tipTapToNoteDocument(source, "note_1");
    // bulletList container must not be in doc.blocks
    const containerBlock = doc.blocks.find((b) => b.type === "other" && b.id === "");
    expect(containerBlock).toBeUndefined();

    // Verify addressable blocks have valid IDs
    for (const block of doc.blocks) {
      expect(block.id).toBeTruthy();
    }
  });

  it("ensureBlockIds normalizes snapshots without mutating input and preserves existing IDs", () => {
    const raw: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "b_existing" },
          content: [{ type: "text", text: "Already has ID" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Needs ID" }],
        },
      ],
    };

    const copy = JSON.parse(JSON.stringify(raw));
    const normalized = ensureBlockIds(raw);

    // Original must not be mutated
    expect(raw).toEqual(copy);
    expect(raw.content?.[1].attrs?.blockId).toBeUndefined();

    // Normalized must have blockId on both
    expect(normalized.content?.[0].attrs?.blockId).toBe("b_existing");
    expect(normalized.content?.[1].attrs?.blockId).toMatch(/^b_[a-z0-9]+$/);
  });

  it("ADDRESSABLE_BLOCK_TYPES includes all intended AI block types", () => {
    expect(ADDRESSABLE_BLOCK_TYPES.has("paragraph")).toBe(true);
    expect(ADDRESSABLE_BLOCK_TYPES.has("heading")).toBe(true);
    expect(ADDRESSABLE_BLOCK_TYPES.has("codeBlock")).toBe(true);
    expect(ADDRESSABLE_BLOCK_TYPES.has("blockquote")).toBe(true);
    expect(ADDRESSABLE_BLOCK_TYPES.has("listItem")).toBe(true);
    expect(ADDRESSABLE_BLOCK_TYPES.has("taskItem")).toBe(true);

    // Containers are excluded
    expect(ADDRESSABLE_BLOCK_TYPES.has("bulletList")).toBe(false);
    expect(ADDRESSABLE_BLOCK_TYPES.has("orderedList")).toBe(false);
    expect(ADDRESSABLE_BLOCK_TYPES.has("table")).toBe(false);
  });
});
