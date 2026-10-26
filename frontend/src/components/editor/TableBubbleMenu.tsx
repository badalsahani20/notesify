import { type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Trash2, Plus, Minus, Table as TableIcon } from "lucide-react";

type Props = { editor: Editor };

export const TableBubbleMenu = ({ editor }: Props) => {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      options={{ placement: "top", offset: { mainAxis: 8 } }}
      shouldShow={({ editor }) => editor.isActive("table")}
    >
      <div className="z-[9990] flex items-center gap-1 rounded-xl bg-[var(--panel-bg-strong)] border border-[var(--divider)] shadow-2xl p-1 px-1.5 text-xs text-[var(--text-main)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted-text)] px-1.5">
          <TableIcon size={12} className="text-[var(--accent-strong)]" /> Table
        </span>
        <div className="h-3.5 w-px bg-[var(--divider)] mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--accent-subtle)] text-[var(--text-main)] transition-colors"
          title="Add Row Below"
        >
          <Plus size={12} /> Row
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteRow().run()}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--accent-subtle)] text-[var(--text-main)] transition-colors"
          title="Delete Row"
        >
          <Minus size={12} /> Row
        </button>
        <div className="h-3.5 w-px bg-[var(--divider)] mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--accent-subtle)] text-[var(--text-main)] transition-colors"
          title="Add Column Right"
        >
          <Plus size={12} /> Col
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--accent-subtle)] text-[var(--text-main)] transition-colors"
          title="Delete Column"
        >
          <Minus size={12} /> Col
        </button>
        <div className="h-3.5 w-px bg-[var(--divider)] mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[rgba(239,68,68,0.12)] text-[rgb(239,68,68)] hover:bg-[rgba(239,68,68,0.22)] font-medium transition-colors"
          title="Delete Entire Table"
        >
          <Trash2 size={12} /> Delete Table
        </button>
      </div>
    </BubbleMenu>
  );
};
