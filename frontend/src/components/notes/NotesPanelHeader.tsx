import { ArrowLeft, ChevronRight, X } from "lucide-react";

type NotesPanelHeaderProps = {
  breadcrumbRoot: string;
  panelTitle: string;
  showChevron: boolean;
  isFocusMode: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  onBack?: () => void;
};

const NotesPanelHeader = ({
  breadcrumbRoot,
  panelTitle,
  showChevron,
  isFocusMode,
  actionLabel,
  onAction,
  onClose,
  onBack,
}: NotesPanelHeaderProps) => {
  return (
    <div className="notes-panel-header flex items-center justify-between pr-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer group py-0.5 min-w-0 max-w-[calc(100%-2.5rem)]"
          title={`Back to ${breadcrumbRoot}`}
        >
          <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-white shrink-0" />
          <span className="truncate font-semibold text-zinc-200 group-hover:text-white">{breadcrumbRoot}</span>
        </button>
      ) : (
        <div className="notes-panel-breadcrumb">
          <span>{breadcrumbRoot}</span>
          {showChevron ? (
            <>
              <ChevronRight size={14} />
              <span className="notes-panel-breadcrumb-active">{panelTitle}</span>
            </>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-2">
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-md border border-[var(--border-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted-text)] transition hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)]"
          >
            {actionLabel}
          </button>
        ) : null}

        {isFocusMode ? (
          <button
            type="button"
            onClick={onClose}
            className="desktop-icon-button bg-transparent border-transparent hover:bg-[var(--surface-ghost)]"
            style={{ width: "1.8rem", height: "1.8rem", color: "var(--muted-text)" }}
            title="Close Note List"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default NotesPanelHeader;
