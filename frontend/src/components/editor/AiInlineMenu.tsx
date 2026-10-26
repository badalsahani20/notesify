import { type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Check, X } from "lucide-react";

type Props = { 
  editor: Editor;
  isReviewOpen?: boolean;
};

export const AiInlineMenu = ({ editor, isReviewOpen = false }: Props) => {
  if (!editor) return null;

  return (
    <BubbleMenu 
      editor={editor} 
      pluginKey="aiGhostMenu"
      options={{ placement: "bottom", offset: { mainAxis: 8 } }} 
      shouldShow={({ editor }) => !isReviewOpen && editor.isActive("aiGhostText")}
    >
      <div className="z-[9999] flex items-center gap-2 rounded-xl bg-[var(--panel-bg-strong)] border border-[var(--divider)] shadow-2xl p-1.5 px-2 animate-in fade-in zoom-in-95 duration-200">
        <span className="text-xs font-semibold text-[var(--muted-text)] px-1 uppercase tracking-wider mr-1">AI Suggestion</span>
        <button
          onClick={() => {
            editor.chain().focus().unsetAllAiGhost().run();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(34,197,94,0.12)] text-[rgb(22,163,74)] hover:bg-[rgba(34,197,94,0.2)] text-sm font-semibold transition-colors dark:text-[rgb(74,222,128)]"
        >
          <Check size={15} /> Accept
        </button>
        <button
          onClick={() => {
            editor.chain().focus().discardAllAiGhost().run();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] text-[rgb(220,38,38)] hover:bg-[rgba(239,68,68,0.18)] text-sm font-semibold transition-colors dark:text-[rgb(248,113,113)]"
        >
          <X size={15} /> Reject
        </button>
      </div>
    </BubbleMenu>
  );
};
