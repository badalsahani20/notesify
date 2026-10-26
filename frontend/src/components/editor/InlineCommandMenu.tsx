import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles,
  PenLine,
  FileText,
  HelpCircle,
  CornerDownLeft,
  X,
} from "lucide-react";

export type InlineCommandItem = {
  id: string;
  label: string;
  description: string;
  category: "ai";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: (editor: Editor, customPrompt?: string) => void;
  needsPrompt?: boolean;
};

interface InlineCommandMenuProps {
  editor: Editor;
  isOpen: boolean;
  coords: { top: number; left: number; bottom?: number } | null;
  onClose: () => void;
  onSelectAiPrompt: (prompt: string, actionType: "generate" | "continue" | "summarize" | "explain") => void;
  initialMode?: "menu" | "prompt";
}

export const InlineCommandMenu: React.FC<InlineCommandMenuProps> = ({
  editor,
  isOpen,
  coords,
  onClose,
  onSelectAiPrompt,
  initialMode = "menu",
}) => {
  const [mode, setMode] = useState<"menu" | "prompt">(initialMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuHeight, setMenuHeight] = useState(300);

  useEffect(() => {
    setMode(initialMode);
    setSearchQuery("");
    setCustomPrompt("");
    setSelectedIndex(0);
  }, [initialMode, isOpen]);

  // Focus input when prompt mode activates
  useEffect(() => {
    if (isOpen && mode === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, mode]);

  const commands: InlineCommandItem[] = [
    {
      id: "ai-generate",
      label: "Draft with Iris AI",
      description: "Generate notes, explanations, or outlines from a topic",
      category: "ai",
      icon: Sparkles,
      needsPrompt: true,
      action: () => setMode("prompt"),
    },
    {
      id: "ai-continue",
      label: "Continue Writing",
      description: "Let Iris complete your thought from context",
      category: "ai",
      icon: PenLine,
      action: () => {
        onClose();
        onSelectAiPrompt("", "continue");
      },
    },
    {
      id: "ai-summarize-note",
      label: "Summarize Note",
      description: "Generate a structured summary of the entire note in inspector",
      category: "ai",
      icon: FileText,
      action: () => {
        onClose();
        onSelectAiPrompt("", "summarize");
      },
    },
    {
      id: "ai-explain-note",
      label: "Explain Note",
      description: "Break down key concepts from this note in the inspector",
      category: "ai",
      icon: HelpCircle,
      action: () => {
        onClose();
        onSelectAiPrompt("", "explain");
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const idMatch = cmd.id.toLowerCase().includes(query);
    const labelMatch = cmd.label.toLowerCase().includes(query);
    const descMatch = cmd.description.toLowerCase().includes(query);
    const aliasMatch =
      (query.startsWith("sum") && cmd.id.includes("summarize")) ||
      (query.startsWith("exp") && cmd.id.includes("explain")) ||
      (query.startsWith("cont") && cmd.id.includes("continue")) ||
      (query.startsWith("draft") && cmd.id.includes("generate"));
    return idMatch || labelMatch || descMatch || aliasMatch;
  });

  const handleSelectCommand = useCallback(
    (cmd: InlineCommandItem) => {
      // Remove any trailing "/" typed by the user before executing
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 20), from, " ");
      const slashIndex = textBefore.lastIndexOf("/");
      if (slashIndex !== -1) {
        const deleteCount = textBefore.length - slashIndex;
        editor.chain().deleteRange({ from: from - deleteCount, to: from }).run();
      }

      cmd.action(editor);
    },
    [editor]
  );

  const handlePromptSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customPrompt.trim()) return;

    // Remove any trailing "/" or trigger text
    const { state } = editor;
    const { from } = state.selection;
    const textBefore = state.doc.textBetween(Math.max(0, from - 20), from, " ");
    const slashIndex = textBefore.lastIndexOf("/");
    if (slashIndex !== -1) {
      const deleteCount = textBefore.length - slashIndex;
      editor.chain().deleteRange({ from: from - deleteCount, to: from }).run();
    }

    onClose();
    onSelectAiPrompt(customPrompt.trim(), "generate");
  };

  // Keyboard navigation within the menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      editor.commands.focus();
      return;
    }

    if (mode === "menu") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelectCommand(filteredCommands[selectedIndex]);
        }
      }
    } else if (mode === "prompt") {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handlePromptSubmit();
      }
    }
  };

  // Dismiss when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.height > 40) {
        setMenuHeight(rect.height);
      }
    }
  }, [mode, filteredCommands.length, searchQuery, isOpen]);

  if (!isOpen || !coords) return null;

  const cursorTop = coords.top;
  const cursorBottom = coords.bottom ?? (coords.top + 24);
  const cursorLeft = coords.left;

  const spaceBelow = window.innerHeight - cursorBottom - 16;
  const spaceAbove = cursorTop - 16;
  const shouldFlipAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

  let calculatedTop: number;
  let maxListHeight = 260;

  if (shouldFlipAbove) {
    calculatedTop = Math.max(16, cursorTop - menuHeight - 8);
    if (cursorTop - 16 < menuHeight) {
      maxListHeight = Math.max(120, Math.floor(cursorTop - 16 - 70));
    }
  } else {
    calculatedTop = cursorBottom + 8;
    if (spaceBelow < menuHeight) {
      maxListHeight = Math.max(120, Math.floor(spaceBelow - 70));
    }
  }

  const calculatedLeft = Math.max(16, Math.min(cursorLeft, window.innerWidth - 340));

  return (
    <div
      ref={menuRef}
      data-inline-command-menu="true"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{
        position: "fixed",
        top: `${calculatedTop}px`,
        left: `${calculatedLeft}px`,
      }}
      className="z-[9999] w-[320px] rounded-xl border border-[var(--divider)] bg-[var(--panel-bg-strong)] text-[var(--text-main)] shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-md overflow-hidden text-xs outline-none animate-in fade-in zoom-in-95 duration-120"
    >
      {mode === "prompt" ? (
        <form onSubmit={handlePromptSubmit} className="p-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--divider)] mb-2">
            <span className="text-[11px] font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <Sparkles size={12} className="text-[var(--accent-strong)]" />
              Ask Iris AI
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--muted-text)] hover:text-[var(--text-strong)] p-0.5 rounded transition-colors duration-150"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="What would you like Iris to write?..."
              className="w-full bg-[var(--surface-ghost)] border border-[var(--divider)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-strong)] placeholder:text-[var(--muted-text)] focus:outline-none focus:border-[var(--accent-strong)] pr-8 transition-colors duration-150"
            />
            <button
              type="submit"
              disabled={!customPrompt.trim()}
              className="absolute right-1.5 top-1.5 p-1 rounded-md bg-[var(--accent-strong)] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity duration-150"
              aria-label="Submit prompt"
            >
              <CornerDownLeft size={12} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--muted-text)] px-0.5">
            <span>Press Enter to generate</span>
            <span>Esc to cancel</span>
          </div>
        </form>
      ) : (
        <div>
          {/* Search Header */}
          <div className="p-2 border-b border-[var(--divider)]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command or filter..."
              className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-[var(--text-strong)] placeholder:text-[var(--muted-text)] focus:outline-none"
              autoFocus
            />
          </div>

          {/* Commands List */}
          <div
            style={{ maxHeight: `${maxListHeight}px` }}
            className="overflow-y-auto p-1 custom-scrollbar"
          >
            {filteredCommands.length === 0 ? (
              <div className="p-3 text-center text-[var(--muted-text)]">
                No matching command
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                const isAi = cmd.category === "ai";

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleSelectCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors duration-120 ${
                      isSelected
                        ? "bg-[var(--surface-ghost)] text-[var(--text-strong)]"
                        : "text-[var(--text-main)] hover:bg-[var(--surface-ghost)]"
                    }`}
                  >
                    <div
                      className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
                        isAi
                          ? "bg-[rgba(99,102,241,0.12)] text-[var(--accent-strong)]"
                          : "bg-white/5 text-[var(--muted-text)]"
                      }`}
                    >
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate flex items-center justify-between">
                        <span>{cmd.label}</span>
                        {isAi && (
                          <span className="text-[9px] uppercase tracking-wider text-[var(--accent-strong)] font-semibold opacity-80">
                            AI
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--muted-text)] truncate">
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
