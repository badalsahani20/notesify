import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import debounce from "lodash.debounce";
import type { Editor } from "@tiptap/react";
import { useUpdateNoteMutation, useCreateNoteMutation } from "@/hooks/notes/useNotesMutations";
import { setLazyCreatedNoteId } from "@/hooks/notes/useNotesLayout";
import { useNavigate, useLocation } from "react-router-dom";

type UseNoteSyncProps = {
  note: any;
  isNew: boolean;
  folderId: string | undefined;
  editorInstance: Editor | null;
  createdNoteIdRef: React.MutableRefObject<string | null>;
};

export const useNoteSync = ({
  note,
  isNew,
  folderId,
  editorInstance,
  createdNoteIdRef,
}: UseNoteSyncProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutateAsync: updateNoteAsync, isPending: isSavingNote } = useUpdateNoteMutation();
  const { mutateAsync: createNoteAsync } = useCreateNoteMutation();

  const [isCreating, setIsCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const prevTitleRef = useRef("");

  // Reset draft title when navigating to a new (unsaved) note
  // Without this, the previous note's title leaks into the new note title input
  useEffect(() => {
    if (isNew) {
      setDraftTitle("");
      prevTitleRef.current = "";
    }
  }, [isNew]);

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((id: string, content: string) => {
        const latestNote = noteRef.current;
        if (latestNote && latestNote._id === id && id !== "new") {
          updateNoteAsync({
            noteId: id,
            updates: { content },
            version: latestNote.version,
          }).catch(() => {});
        }
      }, 1000),
    [updateNoteAsync]
  );

  useEffect(() => {
    return () => {
      debouncedUpdate.flush();
    };
  }, [debouncedUpdate]);

  useEffect(() => {
    if (isNew || !note) return;

    const newTitle = note.title ?? "";
    const oldTitle = prevTitleRef.current;
    prevTitleRef.current = newTitle;

    // Detect if the title transitioned from a default "Untitled" title to an AI-generated one
    const isTransitionFromDefault =
      ["", "Untitled", "Untitled Note"].includes(oldTitle) &&
      !["", "Untitled", "Untitled Note"].includes(newTitle);

    if (isTransitionFromDefault) {
      let currentIndex = 0;
      setDraftTitle(""); // Start typing from empty
      const timer = setInterval(() => {
        currentIndex++;
        setDraftTitle(newTitle.slice(0, currentIndex));
        if (currentIndex >= newTitle.length) {
          clearInterval(timer);
        }
      }, 45); // ms per character
      return () => clearInterval(timer);
    } else {
      setDraftTitle(newTitle);
    }
  }, [isNew, note?._id, note?.title]);

  const handleCreateOnEdit = useCallback(async (initialTitle: string, initialContent: string) => {
    if (isCreating) return null;
    setIsCreating(true);
    try {
      const newNote = await createNoteAsync({
        title: initialTitle || "Untitled Note",
        content: initialContent,
        folderId: folderId
      });
      if (newNote?._id) {
        createdNoteIdRef.current = newNote._id;
        setLazyCreatedNoteId(newNote._id);
        const path = folderId ? `/folders/${folderId}/note/${newNote._id}` : `/note/${newNote._id}`;
        navigate(`${path}${location.search}`, { replace: true });
        return newNote;
      }
    } catch (err) {
      console.error("Lazy creation failed:", err);
    } finally {
      setIsCreating(false);
    }
    return null;
  }, [createNoteAsync, folderId, isCreating, location.search, navigate, createdNoteIdRef]);

  const handleContentChange = useCallback((html: string) => {
    if (isNew) {
      handleCreateOnEdit(draftTitle, html);
    } else if (note) {
      debouncedUpdate(note._id, html);
    }
  }, [isNew, note, draftTitle, handleCreateOnEdit, debouncedUpdate]);

  const commitTitle = useCallback(() => {
    if (!note) return;
    if (isNew) {
      if (draftTitle.trim()) {
        const content = editorInstance?.getHTML() || "";
        handleCreateOnEdit(draftTitle, content);
      }
      return;
    }
    const currentNote = noteRef.current || note;
    if (draftTitle !== currentNote.title) {
      updateNoteAsync({
        noteId: currentNote._id,
        updates: { title: draftTitle },
        version: currentNote.version
      }).catch(() => { });
    }
  }, [note, isNew, draftTitle, editorInstance, handleCreateOnEdit, updateNoteAsync]);

  return {
    isSavingNote,
    isCreating,
    draftTitle,
    setDraftTitle,
    handleContentChange,
    commitTitle,
  };
};
