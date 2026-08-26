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

  const isCreatingRef = useRef(false);
  const pendingContentRef = useRef<string | null>(null);

  // Reset refs ONLY when navigating to a fresh new note session
  useEffect(() => {
    if (isNew && !createdNoteIdRef.current) {
      isCreatingRef.current = false;
      pendingContentRef.current = null;
    }
  }, [isNew, createdNoteIdRef]);

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((id: string, content: string) => {
        const latestNote = noteRef.current;
        const currentVersion = (latestNote && latestNote._id === id) ? latestNote.version : 1;
        if (id && id !== "new") {
          console.log("[NoteLifecycle] UPDATE", id);
          updateNoteAsync({
            noteId: id,
            updates: { content },
            version: currentVersion,
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
    if (isCreatingRef.current || createdNoteIdRef.current) return null;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const newNote = await createNoteAsync({
        title: initialTitle || "Untitled Note",
        content: initialContent,
        folderId: folderId
      });
      if (newNote?._id) {
        console.log("[NoteLifecycle] CREATE", newNote._id);
        createdNoteIdRef.current = newNote._id;
        setLazyCreatedNoteId(newNote._id);
        const path = folderId ? `/folders/${folderId}/note/${newNote._id}` : `/note/${newNote._id}`;
        console.log("[NoteLifecycle] NAVIGATE", newNote._id);
        navigate(`${path}${location.search}`, { replace: true });

        // Flush any typing buffered while CREATE was in flight
        if (pendingContentRef.current !== null) {
          const bufferedHtml = pendingContentRef.current;
          pendingContentRef.current = null;
          debouncedUpdate(newNote._id, bufferedHtml);
        }

        return newNote;
      }
    } catch (err) {
      console.error("Lazy creation failed:", err);
      isCreatingRef.current = false;
    } finally {
      setIsCreating(false);
    }
    return null;
  }, [createNoteAsync, folderId, location.search, navigate, createdNoteIdRef, debouncedUpdate]);

  const handleContentChange = useCallback((html: string) => {
    // 1. If note was already created during this session (even if route params haven't re-rendered yet)
    if (createdNoteIdRef.current) {
      debouncedUpdate(createdNoteIdRef.current, html);
      return;
    }

    // 2. If CREATE is in flight, buffer the latest HTML string (zero keystroke loss)
    if (isCreatingRef.current) {
      pendingContentRef.current = html;
      return;
    }

    // 3. First keypress on a new note
    if (isNew) {
      handleCreateOnEdit(draftTitle, html);
    } else if (note && note._id !== "new") {
      debouncedUpdate(note._id, html);
    }
  }, [isNew, note, draftTitle, handleCreateOnEdit, debouncedUpdate, createdNoteIdRef]);

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
