import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { SelectionRange } from "@/components/ai/types";
import { getSelection } from "@/utils/ai/aiContext";
import { tipTapToNoteDocument, type NoteRevision } from "@/utils/noteDocument";

import { buildNoteContext, type StructuredNoteContext } from "@/utils/ai/noteContextBuilder";

export const useNoteContext = (
  editor: Editor | null,
  _plainNoteText?: string,
  noteId: string | null = null
) => {
  const [selectionRange, setSelectionRange] = useState<SelectionRange>(null);

  const revisionRef = useRef<number>(1);
  
  // Increment revisionId on every doc edit
  useEffect(() => {
    if(!editor) return;
    const handleUpdate = () => {
      revisionRef.current += 1;
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    }
  }, [editor]);
  // Reset revision counter when switching notes
  useEffect(() => {
    revisionRef.current = 1;
  }, [noteId]);

  // Track selection range
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { range } = getSelection(editor);
      setSelectionRange(range);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    handleSelectionUpdate();

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  const buildContext = (): StructuredNoteContext => {
    return buildNoteContext(
      editor,
      noteId || "new",
      revisionRef.current
    );
  };

  const getDocumentRevision = (): NoteRevision | null => {
    if (!noteId) return null;
    const document = tipTapToNoteDocument(editor, noteId, revisionRef.current);
    return {
      timestamp: Date.now(),
      document,
    };
  };

  return {
    selectionRange,
    setSelectionRange,
    buildContext,
    getDocumentRevision,
    revisionId: revisionRef.current,
  };
};
