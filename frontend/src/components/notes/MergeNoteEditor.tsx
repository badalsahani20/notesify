import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockIdExtension } from "@/extensions/blockIdExtension";
import { MarkerHighlightExtension } from "@/extensions/markerHighlightExtension";
import { TipTapCodeBlock } from "@/components/editor/TipTapCodeBlock";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Undo2,
  Redo2,
  Laptop,
  Cloud,
  GitMerge,
} from "lucide-react";

const lowlight = createLowlight(common);

const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TipTapCodeBlock);
  },
}).configure({ lowlight, defaultLanguage: "javascript" });

interface MergeNoteEditorProps {
  content: string;
  onChange: (html: string) => void;
  localContent?: string;
  serverContent?: string;
}

export const MergeNoteEditor: React.FC<MergeNoteEditorProps> = ({
  content,
  onChange,
  localContent = "",
  serverContent = "",
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      BlockIdExtension,
      CustomCodeBlock,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      MarkerHighlightExtension,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync editor if initial content changes when modal reopens
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleUseLocal = () => {
    if (!editor) return;
    editor.commands.setContent(localContent);
    onChange(localContent);
  };

  const handleUseServer = () => {
    if (!editor) return;
    editor.commands.setContent(serverContent);
    onChange(serverContent);
  };

  const handleCombineBoth = () => {
    if (!editor) return;
    const combined =
      localContent && serverContent
        ? `${localContent}<hr /><p><strong>— Server Version Below —</strong></p>${serverContent}`
        : localContent || serverContent || "";
    editor.commands.setContent(combined);
    onChange(combined);
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full rounded-lg border border-[var(--divider)] bg-[var(--surface-muted)]/20 overflow-hidden min-h-0">
      {/* Action Bar & Mini Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 border-b border-[var(--divider)] bg-[var(--surface-muted)]/60 shrink-0">
        {/* Preset Resolution Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleUseLocal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--window-bg)] hover:bg-[var(--surface-ghost)] border border-[var(--divider)] text-[var(--text-strong)] transition-all cursor-pointer shadow-2xs hover:border-emerald-500/40"
            title="Replace merge content with your local draft"
          >
            <Laptop size={12} className="text-emerald-500 shrink-0" />
            <span>Use Local</span>
          </button>
          <button
            type="button"
            onClick={handleUseServer}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--window-bg)] hover:bg-[var(--surface-ghost)] border border-[var(--divider)] text-[var(--text-strong)] transition-all cursor-pointer shadow-2xs hover:border-rose-500/40"
            title="Replace merge content with the server version"
          >
            <Cloud size={12} className="text-rose-500 shrink-0" />
            <span>Use Server</span>
          </button>
          <button
            type="button"
            onClick={handleCombineBoth}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--window-bg)] hover:bg-[var(--surface-ghost)] border border-[var(--divider)] text-[var(--text-strong)] transition-all cursor-pointer shadow-2xs hover:border-[var(--accent-strong)]/40"
            title="Combine local draft and server version separated by a divider"
          >
            <GitMerge size={12} className="text-[var(--accent-strong)] shrink-0" />
            <span>Combine Both</span>
          </button>
        </div>

        {/* Rich Text Format Buttons */}
        <div className="flex items-center gap-0.5 border-l border-[var(--divider)] pl-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("bold") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("italic") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("heading", { level: 1 }) ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Heading 1"
          >
            <Heading1 size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("heading", { level: 2 }) ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Heading 2"
          >
            <Heading2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("bulletList") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Bullet List"
          >
            <List size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("orderedList") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Numbered List"
          >
            <ListOrdered size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("taskList") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Task List"
          >
            <ListTodo size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors ${
              editor.isActive("blockquote") ? "text-[var(--accent-strong)] bg-[var(--surface-ghost)]" : "text-[var(--muted-text)]"
            }`}
            title="Blockquote"
          >
            <Quote size={13} />
          </button>
          <div className="w-px h-3.5 bg-[var(--divider)] mx-0.5" />
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors text-[var(--muted-text)] disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1 rounded hover:bg-[var(--surface-ghost)] transition-colors text-[var(--muted-text)] disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo"
          >
            <Redo2 size={13} />
          </button>
        </div>
      </div>

      {/* Visual ProseMirror Editor Surface */}
      <div className="editor-content-shell flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-[var(--window-bg)] min-h-0 text-[13px] leading-relaxed">
        <EditorContent
          editor={editor}
          className="min-h-full outline-none prose dark:prose-invert max-w-none focus:outline-none"
        />
      </div>
    </div>
  );
};
