import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Copy, Check } from "lucide-react";

interface SelectionToolbarProps {
  /** Optional container ref to constrain selection checking */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Callback when user clicks 'Ask Iris' - populates compose input with quoted text and focuses, never sends automatically */
  onAskIris?: (text: string) => void;
}

interface ToolbarPosition {
  x: number;
  y: number;
  isTop: boolean;
}

export const SelectionToolbar = ({
  containerRef,
  onAskIris,
}: SelectionToolbarProps) => {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [copied, setCopied] = useState(false);
  const isMouseDownRef = useRef(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedText("");
    setPosition(null);
  }, []);

  const updateToolbar = useCallback(() => {
    if (isMouseDownRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      clearSelection();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      clearSelection();
      return;
    }

    // Ensure range exists
    if (selection.rangeCount === 0) {
      clearSelection();
      return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
    const focusEl = focusNode instanceof Element ? focusNode : focusNode?.parentElement;

    if (!anchorEl || !focusEl) {
      clearSelection();
      return;
    }

    // Do not show inside inputs or textareas
    if (anchorEl.closest("input, textarea") || focusEl.closest("input, textarea")) {
      clearSelection();
      return;
    }

    // Ensure selection is within a single chat message
    const anchorMsg = anchorEl.closest('[data-slot="message"]');
    const focusMsg = focusEl.closest('[data-slot="message"]');

    if (!anchorMsg || !focusMsg || anchorMsg !== focusMsg) {
      clearSelection();
      return;
    }

    // If containerRef provided, check that anchorMsg is inside container
    if (containerRef?.current && !containerRef.current.contains(anchorMsg)) {
      clearSelection();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      clearSelection();
      return;
    }

    // Calculate clamped horizontal position
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.max(120, Math.min(window.innerWidth - 120, centerX));

    // Calculate vertical position:
    // Prefer positioning below the selection (rect.bottom + 8) so it does not collide
    // with browser-native popups (like Edge Mini Menu which docks above).
    // Flip above if too close to viewport bottom.
    const spaceBelow = window.innerHeight - rect.bottom;
    const isBelow = spaceBelow >= 52;
    const y = isBelow ? rect.bottom + 8 : rect.top - 8;
    const isTop = !isBelow;

    setSelectedText(text);
    setPosition({ x: clampedX, y, isTop });
  }, [clearSelection, containerRef]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // If clicking inside the toolbar, don't clear
      const target = e.target as HTMLElement | null;
      if (target?.closest(".gc-selection-toolbar")) {
        return;
      }
      isMouseDownRef.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      isMouseDownRef.current = false;
      const target = e.target as HTMLElement | null;
      const msgEl = target?.closest('[data-slot="message"]');
      if (msgEl) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
          // Suppress browser default floating mini menus (e.g. Edge/Chromium quick search popup)
          e.preventDefault();
        }
      }
      // Slight delay to allow selection range to settle
      setTimeout(updateToolbar, 20);
    };

    const handleSelectionChange = () => {
      if (!isMouseDownRef.current) {
        updateToolbar();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.getSelection()?.removeAllRanges();
        clearSelection();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("keydown", handleKeyDown);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [updateToolbar, clearSelection]);

  const handleAskIrisClick = () => {
    if (!selectedText) return;
    onAskIris?.(selectedText);
    window.getSelection()?.removeAllRanges();
    clearSelection();
  };

  const handleCopyClick = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to copy selected text:", err);
    }
  };

  if (!position || !selectedText) {
    return null;
  }

  return createPortal(
    <div
      role="toolbar"
      aria-label="Text selection tools"
      className="gc-selection-toolbar fixed z-[9999] pointer-events-auto transition-all"
      style={{
        top: position.y,
        left: position.x,
        transform: position.isTop ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
      onMouseDown={(e) => {
        // Prevent selection collapse on click
        e.preventDefault();
      }}
    >
      <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[#18181b]/95 backdrop-blur-md px-1 py-1 shadow-2xl shadow-black/60 select-none animate-in fade-in zoom-in-95 duration-150">
        {onAskIris && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium cursor-pointer"
            onClick={handleAskIrisClick}
            title="Ask Iris about this selection"
          >
            <span>Ask Iris</span>
          </button>
        )}

        {onAskIris && (
          <div className="w-px h-3.5 bg-white/10 mx-0.5" />
        )}

        <button
          type="button"
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium cursor-pointer"
          onClick={handleCopyClick}
          title={copied ? "Copied to clipboard" : "Copy selected text"}
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
};
