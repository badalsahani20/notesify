import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconPlus, IconSearch, IconFolder, IconFileText, IconClock } from "@tabler/icons-react";
import { useNotesQuery } from "@/hooks/notes/useNotesQuery";
import { useFolderStore } from "@/store/useFolderStore";
import { usePanelStore } from "@/store/usePanelStore";
import type { Note } from "@/store/useNoteStore";
import { getRelativeUpdatedLabel } from "@/utils/getRelativeUpdatedLabel";
import { getFolderIcon } from "@/utils/getFolderIcons";
import { getFolderColor } from "@/utils/folderColors";
import { NoteEditorSkeleton } from "@/components/ui/noteEditorSkeleton";

const EmptyEditorState = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useNotesQuery();
  const { folders } = useFolderStore();
  const { setSearchOpen } = usePanelStore();

  const [stableNow, setStableNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setStableNow(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentFolder = useMemo(
    () => (folderId ? folders.find((f) => f._id === folderId) : null),
    [folders, folderId]
  );

  const folderNotes = useMemo(
    () => (folderId ? notes.filter((n) => !n.isDeleted && !n.isArchived && n.folder === folderId) : []),
    [notes, folderId]
  );

  const isFolderRoute = Boolean(folderId);
  const isEmptyFolder = isFolderRoute && currentFolder && folderNotes.length === 0;

  // Effective access time for recent notes sorting
  const getEffectiveTime = (n: Note) => new Date(n.lastAccessedAt || n.updatedAt).getTime();

  const candidateNotes = useMemo(() => {
    if (isFolderRoute) return folderNotes;
    return notes.filter((n) => !n.isDeleted && !n.isArchived);
  }, [isFolderRoute, folderNotes, notes]);

  const recentNotes = useMemo(
    () =>
      [...candidateNotes]
        .sort((a, b) => getEffectiveTime(b) - getEffectiveTime(a))
        .slice(0, 4),
    [candidateNotes]
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f._id, f.name));
    return map;
  }, [folders]);

  const handleCreateNote = () => {
    navigate(folderId ? `/folders/${folderId}/note/new` : `/note/new`);
  };

  const handleSelectNote = (note: Note) => {
    if (note.folder) {
      navigate(`/folders/${note.folder}/note/${note._id}`);
    } else {
      navigate(`/note/${note._id}`);
    }
  };

  if (isLoading) {
    return <NoteEditorSkeleton />;
  }

  const FolderIconComponent = currentFolder ? getFolderIcon(currentFolder.name) : IconFolder;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto custom-scrollbar bg-[var(--window-bg)]">
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-12 text-center max-w-3xl mx-auto w-full my-auto">
        {/* Badge / Indicator */}
        <div className="mb-4 flex items-center justify-center">
          {isEmptyFolder ? (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 shadow-lg"
              style={{
                backgroundColor: `${getFolderColor(currentFolder?.color)}22`,
                color: getFolderColor(currentFolder?.color),
              }}
            >
              <FolderIconComponent size={24} stroke={2} />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface-ghost)] text-xs font-semibold text-[var(--text-strong)] shadow-sm">
              <div className="iris-orb shrink-0" style={{ width: "12px", height: "12px", borderWidth: "1px", boxShadow: "none" }} />
              <span>Workspace</span>
            </div>
          )}
        </div>

        {/* Hero Title & Subtitle */}
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-strong)]">
          {isEmptyFolder ? currentFolder?.name || "Folder" : "What are you working on?"}
        </h2>
        <p className="mt-2 text-sm md:text-base text-[var(--muted-text)] max-w-md">
          {isEmptyFolder
            ? "This folder doesn't have any notes yet."
            : "Pick up where you left off, or start something new."}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full max-w-sm">
          <button
            type="button"
            onClick={handleCreateNote}
            className="ignite-button bg-[#2563eb] border-[#2563eb]/20 flex-1 justify-center min-w-[140px]"
          >
            <IconPlus size={18} stroke={2} />
            <span>New Note</span>
          </button>

          {!isEmptyFolder && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] hover:border-[var(--accent-strong)]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-xs font-medium cursor-pointer shadow-sm hover:shadow-md min-w-[140px] flex-1"
            >
              <IconSearch size={18} stroke={2} className="text-[var(--muted-text)]" />
              <span>Search notes</span>
              <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted-text)] bg-[var(--surface-ghost)] border border-[var(--divider)] rounded">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* Recent Notes Section */}
        {!isEmptyFolder && recentNotes.length > 0 && (
          <div className="mt-12 w-full text-left">
            <div className="flex items-center gap-2 mb-3 px-1 text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider">
              <IconClock size={15} stroke={2} />
              <span>{isFolderRoute ? "Recent notes in folder" : "Recently opened"}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {recentNotes.map((note) => {
                const folderName = note.folder ? folderMap.get(note.folder) : null;
                return (
                  <button
                    key={note._id}
                    type="button"
                    onClick={() => handleSelectNote(note)}
                    className="group flex flex-col justify-between p-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-muted)] hover:bg-[var(--active-surface)] hover:border-[var(--accent-strong)]/40 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-all duration-200 ease-out text-left shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconFileText size={18} stroke={2} className="text-[var(--accent-strong)] shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200" />
                        <h4 className="font-semibold text-sm text-[var(--text-strong)] truncate leading-tight group-hover:text-[var(--accent-strong)] transition-colors">
                          {note.title || "Untitled Note"}
                        </h4>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-text)] w-full">
                      <span>{getRelativeUpdatedLabel(note.updatedAt, stableNow)}</span>
                      {folderName && !isFolderRoute && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--surface-ghost)] border border-[var(--divider)] text-[var(--muted-text)] group-hover:border-[var(--accent-strong)]/20 truncate max-w-[120px] transition-colors">
                          {folderName}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyEditorState;
