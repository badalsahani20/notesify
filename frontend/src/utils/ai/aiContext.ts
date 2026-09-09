import type { Editor } from "@tiptap/react";
import type { SelectionRange } from "@/components/ai/types";

export const getSelection = (editor: Editor | null) => {
  if (!editor) return { text: "", range: null as SelectionRange };
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, " ").trim();
  return { text, range: from !== to ? { from, to } : null };
};

