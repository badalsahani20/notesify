import React from "react";
import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Link2,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Terminal,
  MoreHorizontal,
  ChevronDown,
  Eraser,
  X,
  Sparkles,
  Lightbulb,
  FileText,
  RotateCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { useAiChat } from "@/hooks/ai/useAiChat";
import { useEditorUIStore } from "@/store/useEditorUIStore";

type Props = {
  editor: Editor;
  onAskAi?: (selectedText: string, startLine: number, endLine: number) => void;
  aiChat?: ReturnType<typeof useAiChat>;
};

// ── Curated marker palette ──────────────────────────────────────
const MARKER_COLORS = [
  { color: "#fef08a", label: "Yellow" },
  { color: "#86efac", label: "Green" },
  { color: "#93c5fd", label: "Blue" },
  { color: "#f9a8d4", label: "Pink" },
  { color: "#fca5a5", label: "Red" },
  { color: "#fdba74", label: "Orange" },
  { color: "#c4b5fd", label: "Purple" },
  { color: "#a5f3fc", label: "Cyan" },
];

const MORE_ITEMS = [
  {
    label: "Heading 1",
    icon: <Heading1 size={13} />,
    run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e: Editor) => e.isActive("heading", { level: 1 }),
  },
  {
    label: "Heading 2",
    icon: <Heading2 size={13} />,
    run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e: Editor) => e.isActive("heading", { level: 2 }),
  },
  {
    label: "Bullet List",
    icon: <List size={13} />,
    run: (e: Editor) => e.chain().focus().toggleBulletList().run(),
    active: (e: Editor) => e.isActive("bulletList"),
  },
  {
    label: "Numbered List",
    icon: <ListOrdered size={13} />,
    run: (e: Editor) => e.chain().focus().toggleOrderedList().run(),
    active: (e: Editor) => e.isActive("orderedList"),
  },
  {
    label: "Quote",
    icon: <Quote size={13} />,
    run: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
    active: (e: Editor) => e.isActive("blockquote"),
  },
  {
    label: "Strikethrough",
    icon: <Strikethrough size={13} />,
    run: (e: Editor) => e.chain().focus().toggleStrike().run(),
    active: (e: Editor) => e.isActive("strike"),
  },
  {
    label: "Inline Code",
    icon: <Code size={13} />,
    run: (e: Editor) => e.chain().focus().toggleCode().run(),
    active: (e: Editor) => e.isActive("code"),
  },
  {
    label: "Code Block",
    icon: <Terminal size={13} />,
    run: (e: Editor) => e.chain().focus().toggleCodeBlock().run(),
    active: (e: Editor) => e.isActive("codeBlock"),
  },
  {
    label: "Clear Format",
    icon: <Eraser size={13} />,
    run: (e: Editor) => e.chain().focus().unsetAllMarks().clearNodes().run(),
    active: () => false,
    isDanger: true,
  },
];

export const EditorBubbleMenu: React.FC<Props> = ({ editor, onAskAi, aiChat }) => {
  const [showMore, setShowMore] = React.useState(false);
  const [showMarker, setShowMarker] = React.useState(false);
  const [showLink, setShowLink] = React.useState(false);
  const [showAi, setShowAi] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");

  const { markerColor, setMarkerColor } = useEditorUIStore();

  const moreRef = React.useRef<HTMLDivElement>(null);
  const markerRef = React.useRef<HTMLDivElement>(null);
  const linkRef = React.useRef<HTMLDivElement>(null);
  const aiRef = React.useRef<HTMLDivElement>(null);
  const linkInputRef = React.useRef<HTMLInputElement>(null);

  // Close flyouts when selection collapses
  React.useEffect(() => {
    if (editor.state.selection.empty) {
      setShowMore(false);
      setShowMarker(false);
      setShowLink(false);
      setShowAi(false);
    }
  }, [editor.state.selection.empty]);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) setShowMore(false);
      if (markerRef.current && !markerRef.current.contains(target)) setShowMarker(false);
      if (linkRef.current && !linkRef.current.contains(target)) setShowLink(false);
      if (aiRef.current && !aiRef.current.contains(target)) setShowAi(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isHighlightActive = editor.isActive("markerHighlight");
  const isLinkActive = editor.isActive("link");

  function closeAll() {
    setShowMore(false);
    setShowMarker(false);
    setShowLink(false);
    setShowAi(false);
  }

  function applyColor(color: string) {
    setMarkerColor(color);
    editor.chain().focus().setMarkerHighlight(color).run();
    setShowMarker(false);
  }

  function handleOpenLink() {
    const currentHref = editor.getAttributes("link").href || "";
    setLinkUrl(currentHref);
    setShowLink((v) => !v);
    setShowMore(false);
    setShowMarker(false);
    setShowAi(false);
  }

  function handleApplyLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const formatted =
        /^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:") || trimmed.startsWith("#")
          ? trimmed
          : `https://${trimmed}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: formatted, target: "_blank" })
        .run();
    }
    setShowLink(false);
  }

  function handleRemoveLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLink(false);
  }

  function handleAskIris() {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    const textBeforeSelection = editor.state.doc.textBetween(0, from, "\n");
    const startLine = textBeforeSelection.split("\n").length;
    const endLine = startLine + selectedText.split("\n").length - 1;
    onAskAi?.(selectedText, startLine, endLine);
    closeAll();
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="standardBubbleMenu"
      shouldShow={({ editor }) => {
        if (showMarker || showMore || showLink || showAi) return true;
        return !editor.isActive("aiGhostText") && !editor.state.selection.empty;
      }}
      options={{
        placement: "bottom",
        offset: { mainAxis: 10 },
        shift: true,
        flip: true,
      }}
      className="bubble-command-bar z-[80]"
    >
      <div className="bubble-row shadow-[0_8px_30px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.08)_inset]">
        {/* Formatting cluster: Bold · Italic · Underline · Link · Marker */}
        <div className="bubble-cluster">
          <FmtButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            icon={<Bold size={13} />}
            label="Bold"
          />
          <FmtButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            icon={<Italic size={13} />}
            label="Italic"
          />
          <FmtButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            icon={<Underline size={13} />}
            label="Underline"
          />

          {/* Link button & Flyout */}
          <div className="relative" ref={linkRef}>
            <FmtButton
              active={isLinkActive}
              onClick={handleOpenLink}
              icon={<Link2 size={13} />}
              label="Add Link (Ctrl+K)"
            />

            {showLink && (
              <div className="bubble-dropdown bubble-dropdown-left w-64 p-2">
                <form onSubmit={handleApplyLink} className="flex items-center gap-1.5">
                  <input
                    ref={linkInputRef}
                    type="text"
                    placeholder="Paste URL or link..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-md px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/60"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-white hover:bg-zinc-200 text-zinc-950 rounded-md text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Check size={12} className="stroke-[2.5]" />
                  </button>
                  {isLinkActive && (
                    <button
                      type="button"
                      onClick={handleRemoveLink}
                      className="p-1 text-zinc-400 hover:text-red-400 rounded-md cursor-pointer transition-colors"
                      title="Remove link"
                    >
                      <X size={12} />
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Marker button with color swatch flyout */}
          <div className="relative" ref={markerRef}>
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Highlight"
                title="Highlight"
                onClick={() => {
                  editor.chain().focus().toggleMarkerHighlight(markerColor).run();
                }}
                className={cn(
                  "bubble-fmt-btn bubble-marker-btn",
                  isHighlightActive && "bubble-fmt-btn-active"
                )}
              >
                <Highlighter size={13} />
                <span className="bubble-marker-dot" style={{ background: markerColor }} />
              </button>

              <button
                type="button"
                aria-label="Color Palette"
                title="Color Options"
                onClick={() => {
                  setShowMarker((v) => !v);
                  setShowMore(false);
                  setShowLink(false);
                  setShowAi(false);
                }}
                className="inline-flex items-center justify-center w-3 h-[26px] rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronDown size={10} className="opacity-70" />
              </button>
            </div>

            {/* Color swatch flyout */}
            {showMarker && (
              <div className="bubble-marker-flyout">
                <div className="bubble-marker-flyout-header">
                  <span>Highlight colour</span>
                  <button
                    type="button"
                    onClick={() => setShowMarker(false)}
                    className="bubble-marker-close"
                  >
                    <X size={11} />
                  </button>
                </div>

                <div className="bubble-marker-swatches">
                  {MARKER_COLORS.map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() => applyColor(color)}
                      className={cn(
                        "bubble-marker-swatch",
                        markerColor === color && "bubble-marker-swatch-active"
                      )}
                      style={{ background: color }}
                    />
                  ))}
                </div>

                {isHighlightActive && (
                  <button
                    type="button"
                    className="bubble-marker-remove"
                    onClick={() => {
                      editor.chain().focus().unsetMark("markerHighlight").run();
                      setShowMarker(false);
                    }}
                  >
                    <X size={11} />
                    Remove highlight
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="bubble-divider" />

        {/* Unified Iris AI Menu Trigger */}
        <div className="relative" ref={aiRef}>
          <button
            type="button"
            onClick={() => {
              setShowAi((v) => !v);
              setShowMore(false);
              setShowMarker(false);
              setShowLink(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md text-xs font-medium text-white transition-all cursor-pointer select-none",
              "bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.14]",
              showAi && "bg-white/[0.12] border-white/[0.2]"
            )}
            title="Iris AI Actions"
          >
            <Sparkles size={12} className="text-blue-400 stroke-[2.2]" />
            <span className="font-semibold text-[11.5px] tracking-tight">Iris</span>
            <ChevronDown size={10} className="text-zinc-400 opacity-70 ml-0.5" />
          </button>

          {/* Iris Actions Dropdown */}
          {showAi && (
            <div className="bubble-dropdown bubble-dropdown-left w-52 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-white/[0.06] mb-1">
                AI Actions
              </div>

              <button
                type="button"
                onClick={handleAskIris}
                className="bubble-dropdown-item group"
              >
                <Sparkles size={13} className="text-blue-400 group-hover:text-blue-300" />
                <span className="flex-1 font-medium text-white">Ask Iris...</span>
                <span className="text-[10px] text-zinc-500 font-mono">Custom</span>
              </button>

              {aiChat && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void aiChat.runAction("explain");
                      closeAll();
                    }}
                    className="bubble-dropdown-item group"
                  >
                    <Lightbulb size={13} className="text-zinc-400 group-hover:text-zinc-200" />
                    <span>Explain Selection</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void aiChat.runAction("summarize");
                      closeAll();
                    }}
                    className="bubble-dropdown-item group"
                  >
                    <FileText size={13} className="text-zinc-400 group-hover:text-zinc-200" />
                    <span>Summarize</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void aiChat.runAction("rewrite");
                      closeAll();
                    }}
                    className="bubble-dropdown-item group"
                  >
                    <RotateCw size={13} className="text-zinc-400 group-hover:text-zinc-200" />
                    <span>Rewrite & Polish</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* More ⋯ */}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => {
              setShowMore((v) => !v);
              setShowMarker(false);
              setShowLink(false);
              setShowAi(false);
            }}
            className={cn("bubble-more", showMore && "bubble-more-open")}
            title="More formatting"
            aria-label="More options"
          >
            <MoreHorizontal size={13} />
          </button>

          {showMore && (
            <div className="bubble-dropdown bubble-dropdown-right">
              {MORE_ITEMS.map((item, idx) => {
                const isActive = item.active(editor);
                const isDivider = idx === MORE_ITEMS.length - 1;
                return (
                  <React.Fragment key={item.label}>
                    {isDivider && <div className="bubble-menu-separator" />}
                    <button
                      type="button"
                      onClick={() => {
                        item.run(editor);
                        closeAll();
                      }}
                      className={cn(
                        "bubble-dropdown-item",
                        isActive && "bubble-dropdown-item-active",
                        (item as any).isDanger && "bubble-dropdown-item-danger"
                      )}
                    >
                      <span className="bubble-dropdown-item-icon">{item.icon}</span>
                      {item.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BubbleMenu>
  );
};

/* ─── Micro-component: formatting icon button ─── */
const FmtButton = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={cn("bubble-fmt-btn", active && "bubble-fmt-btn-active")}
  >
    {icon}
  </button>
);

export default EditorBubbleMenu;
