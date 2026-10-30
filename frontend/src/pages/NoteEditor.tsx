import { useCallback, useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Editor } from "@tiptap/react";
import { useFolderStore } from "@/store/useFolderStore";
import { useNoteQuery } from "@/hooks/notes/useNotesQuery";
import { usePanelStore } from "@/store/usePanelStore";
import { useToggleArchiveMutation, useTogglePinMutation } from "@/hooks/notes/useNotesMutations";
import TipTap from "@/components/editor/TipTap";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useQueryClient } from "@tanstack/react-query";
import ContextualAiPanel from "@/components/chat/ContextualAiPanel";
import StudyPanel from "@/components/study/StudyPanel";

import EmptyEditorState from "@/components/editor/EmptyEditorState";
import EditorHeader from "@/components/editor/EditorHeader";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import { useAiChat } from "@/hooks/ai/useAiChat";
import EditorToolbar from "@/tools/EditorToolbar";
import AiResultDialog from "@/components/ai/AiResultDialog";
import { NoteEditorSkeleton } from "@/components/ui/noteEditorSkeleton";
import { KeyboardShortcutsModal } from "@/components/editor/KeyboardShortcutsModal";
import { useKeyboardOffset } from "@/hooks/ui/useKeyboardOffset";
import { useNoteSync } from "@/hooks/notes/useNoteSync";
import { FloatingScrollButtons } from "@/components/editor/FloatingScrollButtons";
import { MobileAiActions } from "@/components/editor/MobileAiActions";
import { NoteConflictBanner } from "@/components/notes/NoteConflictBanner";


const NoteEditor = () => {
  const { noteId, folderId } = useParams();
  const isNew = noteId === "new";
  const location = useLocation();
  const navigate = useNavigate();
  const { mutateAsync: togglePinning } = useTogglePinMutation();
  const { mutateAsync: toggleArchiveMut } = useToggleArchiveMutation();
  const { folders, hasFetched: hasFetchedFolders } = useFolderStore();
  const queryClient = useQueryClient();

  const { data: fetchedNote, isLoading: isNoteLoading } = useNoteQuery(isNew ? "" : (noteId || ""));

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const createdNoteIdRef = useRef<string | null>(null);

  const activeNoteId = (isNew && createdNoteIdRef.current) ? createdNoteIdRef.current : noteId;
  const cachedNote = activeNoteId ? queryClient.getQueryData<any>(["note", activeNoteId]) : undefined;
  const note = (isNew && !createdNoteIdRef.current)
    ? { _id: "new", title: "Untitled Note", content: "", folder: folderId, pinned: false, isArchived: false, version: 1, updatedAt: new Date().toISOString() } as any
    : (fetchedNote || cachedNote);

  const folder = folders.find((item) => item._id === (note?.folder || folderId));
  const folderLabel = folder?.name ?? (note?.folder && note?._id !== "new" ? "Loading folder..." : "All Notes");
  const { isAiPanelOpen, setAiPanelOpen } = usePanelStore();
  const [isStudyPanelOpen, setStudyPanelOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");

  const { focusModeDefault } = useSettingsStore();

  const lastInitializedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!noteId || isNew) return;

    if (noteId !== lastInitializedNoteIdRef.current) {
      lastInitializedNoteIdRef.current = noteId;

      if (focusModeDefault) {
        const searchParams = new URLSearchParams(location.search);
        if (!searchParams.has("focus")) {
          searchParams.set("focus", "2");
          navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
        }
      }
    }
  }, [focusModeDefault, noteId, isNew, location.search, location.pathname, navigate]);

  const keyboardOffset = useKeyboardOffset();

  const editorScrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = editorScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const nextTop = scrollTop > 300;
    const nextBottom =
      scrollHeight > clientHeight && scrollHeight - scrollTop - clientHeight > 300;

    // Only schedule a render when the visibility actually flips. Setting the
    // same boolean on every scroll event still pushes work through React on
    // every frame, which shows up as scroll lag on Android WebView.
    setShowScrollTop((prev) => (prev === nextTop ? prev : nextTop));
    setShowScrollBottom((prev) => (prev === nextBottom ? prev : nextBottom));
  }, []);

  // Coalesce scroll events to one update per animation frame.
  const handleEditorScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateScrollButtons();
    });
  }, [updateScrollButtons]);

  useEffect(() => () => {
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [note?.content, updateScrollButtons]);

  // Reset scroll to top when switching between notes
  useEffect(() => {
    if (!noteId) return;
    editorScrollRef.current?.scrollTo({ top: 0 });
  }, [noteId]);

  useEffect(() => {
    // Panel preload removed
  }, [isAiPanelOpen]);

  const aiChat = useAiChat(noteId || "", note?.content || "", editorInstance);

  const {
    isSavingNote,
    isCreating,
    draftTitle,
    setDraftTitle,
    handleContentChange,
    commitTitle,
  } = useNoteSync({
    note,
    isNew,
    folderId,
    editorInstance,
    createdNoteIdRef,
  });

  const handleToggleArchive = useCallback(async (id: string) => {
    if (!note || isNew) return;
    const updatedNote = await toggleArchiveMut({ noteId: id, version: note.version });
    if (!updatedNote) return;

    if (updatedNote.isArchived) {
      navigate(`/archive/note/${id}${location.search}`, { replace: true });
      return;
    }

    if (updatedNote.folder) {
      navigate(`/folders/${updatedNote.folder}/note/${id}${location.search}`, { replace: true });
      return;
    }

    navigate(`/note/${id}${location.search}`, { replace: true });
  }, [note, isNew, toggleArchiveMut, navigate, location.search]);

  const handleTogglePin = useCallback((id: string) => {
    if (isNew || !note) return;
    void togglePinning({ noteId: id, version: note.version });
  }, [isNew, note, togglePinning]);

  const handleCloseNote = useCallback(() => {
    if (folderId) {
      navigate(`/folders/${folderId}${location.search}`);
      return;
    }
    if (location.pathname.startsWith("/folders")) {
      navigate(`/folders${location.search}`);
      return;
    }
    if (location.pathname.startsWith("/favorites")) {
      navigate(`/favorites${location.search}`);
      return;
    }
    if (location.pathname.startsWith("/archive")) {
      navigate(`/archive${location.search}`);
      return;
    }
    if (location.pathname.startsWith("/trash")) {
      navigate(`/trash${location.search}`);
      return;
    }
    navigate(`/${location.search}`);
  }, [folderId, location.pathname, location.search, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/⌘ + J → toggle Contextual Iris AI Panel
      if (mod && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        const panelStore = usePanelStore.getState();
        const willOpen = !panelStore.isAiPanelOpen;

        if (willOpen && editorInstance && aiChat) {
          const { from, to } = editorInstance.state.selection;
          if (!editorInstance.state.selection.empty && to > from) {
            const selectedText = editorInstance.state.doc.textBetween(from, to, " ");
            if (selectedText.trim()) {
              aiChat.setChatInput(`explain this part:\n"${selectedText.trim()}"`);
            }
          }
        }

        panelStore.setAiPanelOpen(willOpen);

        if (willOpen) {
          let attempts = 0;
          const focusTextarea = () => {
            const chatInputEl = document.querySelector(".gc-textarea") as HTMLTextAreaElement;
            if (chatInputEl) {
              chatInputEl.focus();
              chatInputEl.setSelectionRange(chatInputEl.value.length, chatInputEl.value.length);
            } else if (attempts < 20) {
              attempts++;
              setTimeout(focusTextarea, 80);
            }
          };
          setTimeout(focusTextarea, 80);
        } else {
          editorInstance?.commands.focus();
        }
        return;
      }

      if (e.key === "Escape") {
        if (e.defaultPrevented) return;

        // 1. Guard against open dialogs, popovers, inline review bar, inline slash menu, or result dialog
        if (
          document.querySelector(
            "[data-radix-popper-content-wrapper], [data-slot='dialog-content'], [data-inline-review-bar], [data-inline-command-menu], [data-ai-result-dialog]"
          )
        ) {
          return;
        }

        // 2. If Iris Panel is open, close only Iris panel
        if (usePanelStore.getState().isAiPanelOpen) {
          usePanelStore.getState().setAiPanelOpen(false);
          editorInstance?.commands.focus();
          return;
        }

        // 3. Lowest priority: Close the active note
        handleCloseNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseNote, editorInstance, aiChat]);

  const isTransitioning = isCreating || (noteId && noteId === createdNoteIdRef.current);
  if ((isNoteLoading && !isTransitioning) || (!note && !hasFetchedFolders && !isNew)) {
    return <NoteEditorSkeleton />;
  }

  if (!note && !isNew) {
    return <EmptyEditorState />;
  }

  const editorKey = (isNew || noteId === "new" || (createdNoteIdRef.current && (noteId === createdNoteIdRef.current || note?._id === createdNoteIdRef.current)))
    ? "stable-new-note-editor"
    : `editor-${noteId}`;

  const editorPane = (
    <AnimatePresence initial={false}>
      <motion.section
        key={editorKey}
        initial={isNew ? {} : { opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-w-0 flex-1 flex-col h-full min-h-0"
      >
        <EditorHeader
          note={note}
          folder={folder}
          folderLabel={folderLabel}
          editor={editorInstance}
          draftTitle={draftTitle}
          onDraftTitleChange={setDraftTitle}
          onCommitTitle={commitTitle}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onAskAi={() => setAiPanelOpen(!isAiPanelOpen)}
          onAskAiHover={() => { }}
          isAiOpen={isAiPanelOpen}
          onStudy={() => {
            const nextOpen = !isStudyPanelOpen;
            setStudyPanelOpen(nextOpen);

            const params = new URLSearchParams(location.search);
            if (nextOpen) {
              params.set("focus", "2");
            } else {
              params.delete("focus");
            }
            navigate(`${location.pathname}?${params.toString()}`, { replace: true });
          }}
          isStudyOpen={isStudyPanelOpen}
          isMobile={isMobile}

          isSaving={isSavingNote}
          loadingAction={aiChat.loadingAction}
          onRunAction={aiChat.runAction}
          onClose={handleCloseNote}
        />

        {note?._id && note._id !== "new" && (
          <NoteConflictBanner noteId={note._id} />
        )}

        <div
          ref={editorScrollRef}
          onScroll={handleEditorScroll}
          className="editor-workspace custom-scrollbar gpu-scroll flex-1 overflow-y-auto px-8 pb-8 pt-4"
          style={
            isMobile && keyboardOffset > 0
              ? { paddingBottom: `calc(${keyboardOffset}px + 4.5rem)` }
              : undefined
          }
        >
          <TipTap
            noteId={note?._id}
            content={isNew ? "" : note.content}
            onChange={handleContentChange}
            onEditorReady={setEditorInstance}
            aiChat={aiChat}
          />
        </div>

        <FloatingScrollButtons
          showScrollTop={showScrollTop}
          showScrollBottom={showScrollBottom}
          onScrollTop={() => editorScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          onScrollBottom={() => editorScrollRef.current?.scrollTo({ top: editorScrollRef.current.scrollHeight, behavior: "smooth" })}
          yOffset={isMobile ? keyboardOffset : 0}
        />

        {editorInstance && (!isMobile || !isAiPanelOpen) && (
          <EditorToolbar
            editor={editorInstance}
            isMobile={isMobile}
            yOffset={isMobile ? keyboardOffset : 0}
          />
        )}
      </motion.section>
    </AnimatePresence>
  );

  return (
    <div className="flex h-full min-h-0 w-full relative">
      {isMobile ? (
        <>
          {editorPane}
          {isAiPanelOpen && (
            <div className="assistant-mobile-overlay">
              <ContextualAiPanel
                aiChat={aiChat}
                noteTitle={draftTitle || note?.title}
                isNewNote={isNew}
                onClose={() => setAiPanelOpen(false)}
                mobileMode
              />
            </div>
          )}
        </>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
          {/* Study panel — left side */}
          {isStudyPanelOpen && (
            <>
              <ResizablePanel
                defaultSize="25%"
                minSize="20%"
                maxSize="40%"
                className="h-full"
              >
                <StudyPanel
                  noteId={noteId || ""}
                  chatHistory={aiChat.chatHistory ?? []}
                  onClose={() => setStudyPanelOpen(false)}
                />
              </ResizablePanel>
              <ResizableHandle className="assistant-resize-handle" />
            </>
          )}

          {/* Stable Central Editor */}
          <ResizablePanel minSize="0" className="min-w-0 h-full">
            {editorPane}
          </ResizablePanel>

          {/* AI Assistant panel — right side */}
          {isAiPanelOpen && (
            <>
              <ResizableHandle className="assistant-resize-handle" />
              <ResizablePanel
                defaultSize="35%"
                minSize="25%"
                maxSize="55%"
                className="assistant-panel-shell h-full"
              >
                <ContextualAiPanel
                  aiChat={aiChat}
                  noteTitle={draftTitle || note?.title}
                  isNewNote={isNew}
                  onClose={() => setAiPanelOpen(false)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}

      {isMobile && !isAiPanelOpen ? (
        <MobileAiActions aiChat={aiChat} onOpenAiPanel={() => setAiPanelOpen(true)} />
      ) : null}

      <AiResultDialog
        result={aiChat.result}
        onApply={aiChat.applySuggestionToSelection}
        onClose={() => aiChat.setResult(null)}
      />

      <KeyboardShortcutsModal />
    </div>
  );
};

export default NoteEditor;
