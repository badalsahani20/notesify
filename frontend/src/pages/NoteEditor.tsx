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
import { GenerateNotesDialog } from "@/components/editor/GenerateNotesDialog";
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
  const [isGenerateNotesOpen, setIsGenerateNotesOpen] = useState(false);

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleEditorScroll = useCallback(() => {
    if (!editorScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = editorScrollRef.current;
    
    setShowScrollTop(scrollTop > 300);
    setShowScrollBottom(scrollHeight > clientHeight && (scrollHeight - scrollTop - clientHeight > 300));
  }, []);

  useEffect(() => {
    handleEditorScroll();
  }, [note?.content, handleEditorScroll]);

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
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={editorKey}
        initial={isNew ? {} : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
          onAskAiHover={() => {}}
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
          onOpenGenerateNotes={() => setIsGenerateNotesOpen(true)}
        />

        <div 
          ref={editorScrollRef}
          onScroll={handleEditorScroll}
          className="editor-workspace custom-scrollbar flex-1 overflow-y-auto px-8 pb-8 pt-4"
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
        />

        {editorInstance && (!isMobile || !isAiPanelOpen) && (
          <EditorToolbar
            editor={editorInstance}
            isMobile={isMobile}
            yOffset={isMobile ? keyboardOffset : 0}
            aiChat={aiChat}
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

      <GenerateNotesDialog
        isOpen={isGenerateNotesOpen}
        onClose={() => setIsGenerateNotesOpen(false)}
        onGenerate={(promptContext) => void aiChat.runAction("noteCreation", promptContext)}
      />

      <KeyboardShortcutsModal />
    </div>
  );
};

export default NoteEditor;
