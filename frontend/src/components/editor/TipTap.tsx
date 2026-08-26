import React, { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Extension } from "@tiptap/core";
import { DOMParser } from "prosemirror-model";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { useLocation, useNavigate } from "react-router-dom";
import EditorBubbleMenu from "./EditorBubbleMenu";
import { ImageUploadExtension } from "../../extensions/imageUploadExtension";
import { MarkerHighlightExtension } from "../../extensions/markerHighlightExtension";
import { AiGhostExtension } from "../../extensions/aiGhostExtension";
import { AiInlineMenu } from "./AiInlineMenu";
import { TipTapCodeBlock } from "./TipTapCodeBlock";
import Link from "@tiptap/extension-link";


import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { DOCUMENT_PATTERNS, markdownToHtml } from "@/utils/markdownToHtml";
import { usePanelStore } from "@/store/usePanelStore";
import Placeholder from "@tiptap/extension-placeholder";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/lib/utils";
import { formatMarkDownNodes } from "@/utils/FormatMarkdownNodes";
import { useEditorUIStore } from "@/store/useEditorUIStore";

const PLACEHOLDERS = [
  "Need a starting point? Generate study notes with AI.",
  "Turn a topic into structured notes instantly.",
  "Paste a topic, lecture, or idea to begin.",
  "Stuck on the blank page? Let AI create a study draft.",
  "Start writing manually or generate notes with AI."
];

const CODE_MARKERS = [
  /[{};]\s*\n/,
  /\b(function|const|let|var|class|import|export|async|await|def|print)\b\s*[\s(]/,
  /=>\s*[{(]/,
  /^\s*(if|for|while|switch)\s*\(/m,
];

const looksLikeCodeSnippet = (text: string) => {
  if (!text.includes("\n")) return false;

  // 1. Detect standard programming languages
  const matchCount = CODE_MARKERS.filter((p) => p.test(text)).length;
  if (matchCount >= 2) return true; // Strong code confidence overrides document patterns

  // 2. Reject if it looks like a markdown document
  if (DOCUMENT_PATTERNS.some((p) => p.test(text))) return false; // Likely a document with a stray code word

  // 3. Detect Mermaid definitions
  const isMermaid = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(text);
  if (isMermaid) return true;

  // 4. Detect ASCII Art / Diagrams (box drawing characters, structural arrows with indentation)
  const hasBoxDrawing = /[─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬╭╮╯╰]/.test(text);
  const hasDiagramArrows = /──►|◄──|-->|<--|==>|<==/.test(text);
  const hasVerticalAlignment = /^\s{2,}[│▼▲|]/m.test(text) || /\s{4,}/.test(text);
  
  if ((hasBoxDrawing || hasDiagramArrows) && hasVerticalAlignment) {
    return true;
  }

  return matchCount >= 1;
};

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize.replace(/['"]+/g, ""),
          renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const Indent = Extension.create({
  name: "indent",
  addOptions() { return { types: ["heading", "paragraph"], indentSize: 24 }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => parseInt(element.style.marginLeft) / this.options.indentSize || 0,
          renderHTML: (attributes) => attributes.indent ? { style: `margin-left: ${attributes.indent * this.options.indentSize}px` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }: any) => {
        const { selection } = state;
        tr = tr.setSelection(selection);
        state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: any) => {
          if (this.options.types.includes(node.type.name)) {
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: (node.attrs.indent || 0) + 1 });
          }
        });
        if (dispatch) dispatch(tr);
        return true;
      },
      outdent: () => ({ tr, state, dispatch }: any) => {
        const { selection } = state;
        tr = tr.setSelection(selection);
        state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: any) => {
          if (this.options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0;
            if (currentIndent > 0) tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: currentIndent - 1 });
          }
        });
        if (dispatch) dispatch(tr);
        return true;
      },
    } as any;
  },
});

const lowlight = createLowlight(common);

const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TipTapCodeBlock);
  },
}).configure({ lowlight, defaultLanguage: "javascript" });

import { useAiChat } from "@/hooks/ai/useAiChat";

type TipTapProps = {
  noteId?: string;
  content: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  aiChat?: ReturnType<typeof useAiChat>;
  editable?: boolean;
};

const TipTap = ({ noteId, content, onChange, onEditorReady, aiChat, editable = true }: TipTapProps) => {
  const navigate = useNavigate();
  const location = useLocation();



  const { editorFont, editorFontSize, spellCheck, editorWidth, lineSpacing } = useSettingsStore();

  const fontSizeMap = {
    sm: "15px",
    md: "17px",
    lg: "19px",
    xl: "22px",
  };

  const editorWidthMap = {
    comfortable: "max-w-[46rem]",
    wide: "max-w-[64rem]",
    full: "max-w-full",
  };

  const resolvedFontFamily =
    editorFont === "Inter" ? "'Inter', sans-serif" :
      editorFont === "Georgia" ? "'Georgia', serif" :
        editorFont === "Lora" ? "'Lora', serif" :
          editorFont === "JetBrains Mono" ? "'JetBrains Mono', monospace" :
            "system-ui, sans-serif";

  const placeholderText = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * PLACEHOLDERS.length);
    return PLACEHOLDERS[randomIndex];
  }, []);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disabling native codeBlock to use our CustomCodeBlock
        link: false, // Disable built-in link extension to avoid duplication and custom extension override
      }),
      CustomCodeBlock,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Color, FontSize, Indent, TaskList,
      TaskItem.configure({ nested: true }),
      BubbleMenu,
      ImageUploadExtension.configure({ inline: true, allowBase64: true }),
      MarkerHighlightExtension,
      AiGhostExtension,
      FontFamily.configure({ types: ["textStyle"] }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({
        placeholder: placeholderText,
        emptyNodeClass: "is-empty",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        linkOnPaste: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => { onChange?.(editor.getHTML()); },
    editorProps: {
      transformPastedHTML(html) {
        // Fix for pasting mixed rich text and code blocks (like from AI chat).
        // Prosemirror's DOMParser splits codeBlocks if it encounters <br> or <p> inside <pre>.
        // We replace them with \n so the codeBlock remains intact.
        return html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, inner) => {
          let newInner = inner
            .replace(/[\r\n]*<br\s*\/?>[\r\n]*/gi, "\n")
            .replace(/<(p|div)[^>]*>/gi, "")
            .replace(/[\r\n]*<\/(p|div)>[\r\n]*/gi, "\n");
          return match.replace(inner, newInner);
        });
      },
      handlePaste(view, event) {
        const plainText = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";

        // ── Guard: pasting code-block content OUTSIDE a code block ──────────
        // When the user selects text inside a code block and pastes elsewhere,
        // TipTap's clipboard slice retains the codeBlock wrapper. Strip it.
        //
        // Copy BUTTON uses navigator.clipboard.writeText() → no HTML in clipboard
        // → clipboardHasCodeBlock = false → falls through → looksLikeCodeSnippet
        // may re-wrap as a code block (correct behaviour).
        //
        // Manual selection copy → browser puts <pre><code> in clipboard HTML
        // → clipboardHasCodeBlock = true → stripped and inserted as paragraphs.
        // ── Removed harmful code-block guard ──
        // Previously, manual selection copies of code blocks were stripped and forced into paragraphs, destroying ASCII art.

        // 1. Prioritize native IDE code blocks
        let isVsCodeMarkdown = false;
        try {
          const vsData = event.clipboardData?.getData("vscode-editor-data");
          if (vsData) {
            const parsed = JSON.parse(vsData);
            if (parsed.mode === "markdown") {
              isVsCodeMarkdown = true;
            }
          }
        } catch (e) {
          // ignore
        }

        const isFencedMarkdown = /^\s*`{3,}/m.test(plainText);
        const isIdeCopy = html && /vscode-editor-data|font-family:.*?(?:Consolas|monospace|Courier|JetBrains)/i.test(html) && !isVsCodeMarkdown;
        const isCode = plainText && !isFencedMarkdown && (isIdeCopy || looksLikeCodeSnippet(plainText));

        if (isCode) {
          // Wrap in code block if there's no rich HTML indicating it's a styled document
          if (!html || (/<(?:pre|code|div|span)\b/i.test(html) && !/<(?:h[1-6]|ul|ol|table)\b/i.test(html))) {
            event.preventDefault();
            const { schema, tr } = view.state;
            const codeNode = schema.nodes.codeBlock?.create({}, schema.text(plainText.replace(/\r\n/g, "\n")));
            if (codeNode) {
              view.dispatch(tr.replaceSelectionWith(codeNode).scrollIntoView());
              return true;
            }
          }
        }

        // 2. Is there valid strong rich HTML?
        // If the OS/browser gave us real formatted HTML components, let TipTap handle it natively instead of guessing with Markdown.
        // We include data-type="table" because TipTap sometimes uses divs with data attributes.
        const hasRichHtml = html && /<(?:h[1-6]|ul|ol|li|table|tr|td|th|blockquote|strong|em|b|i|u|a\b|div[^>]*data-)/i.test(html);
        if (hasRichHtml) {
          return false;
        }

        // 3. Fallback: Parse as Markdown if it matches document structure
        // This gracefully catches mobile Plain Text Table copies or raw Markdown pastes
        if (plainText && DOCUMENT_PATTERNS.some((p) => p.test(plainText)) || plainText.includes("\t")) {
          // Even if it doesn't match DOCUMENT_PATTERNS perfectly, tab-separation strongly hints at a table
          event.preventDefault();
          const convertedHtml = markdownToHtml(plainText);
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = convertedHtml;
          const { state } = view;
          const parser = DOMParser.fromSchema(state.schema);

          try {
            const parsedSlice = parser.parseSlice(tempDiv);
            const tr = state.tr.replaceSelection(parsedSlice);
            view.dispatch(tr.scrollIntoView());
            return true;
          } catch (e) {
            console.warn("Markdown parse failed, falling back to basic paste", e);
            return false;
          }
        }

        return false;
      },

    },
  });

  const handleEditorKeyDown = (event: ReactKeyboardEvent) => {
    if (!editor || !editable) return;

    const mod = event.ctrlKey || event.metaKey;

    // Ctrl/⌘ + Alt + F → auto-format markdown
    if (mod && event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      formatMarkDownNodes(editor);
      return;
    }

    // Ctrl/⌘ + / → open keyboard shortcuts guide
    if (mod && event.key === "/") {
      event.preventDefault();
      useEditorUIStore.getState().setShortcutsOpen(true);
      return;
    }

    // Ctrl/⌘ + Shift + C → toggle code block
    if (mod && event.shiftKey && event.key.toLowerCase() === "c" && !event.altKey) {
      // Skip if user is just copying a selection (browser handles that natively)
      if (editor.state.selection.empty) {
        event.preventDefault();
        editor.chain().focus().toggleCodeBlock().run();
      }
      return;
    }

    // Ctrl/⌘ + K → insert / edit link
    if (mod && !event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (editor.isActive("link")) {
        editor.chain().focus().unsetLink().run();
      } else {
        const url = window.prompt("URL");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }
      return;
    }

    // Ctrl/⌘ + Shift + H → toggle highlight
    if (mod && event.shiftKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      const { markerColor } = useEditorUIStore.getState();
      editor.chain().focus().toggleMarkerHighlight(markerColor).run();
      return;
    }

    // Ctrl/⌘ + \ → clear all formatting
    if (mod && event.key === "\\") {
      event.preventDefault();
      editor.chain().focus().unsetAllMarks().clearNodes().run();
      return;
    }

    if (event.key === "Escape") {
      const next = new URLSearchParams(location.search);
      if (next.has("focus")) {
        next.delete("focus");
        navigate(`${location.pathname}${next.toString() ? `?${next.toString()}` : ""}`, { replace: true });
      }
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
      if (event.shiftKey) editor.chain().focus().liftListItem("listItem").run();
      else editor.chain().focus().sinkListItem("listItem").run();
      return;
    }
    editor.chain().focus().insertContent("    ").run();
  };

  useEffect(() => {
    console.log("[NoteLifecycle] EDITOR MOUNT", noteId || "new");
    return () => {
      console.log("[NoteLifecycle] EDITOR UNMOUNT", noteId || "new");
    };
  }, []);

  useEffect(() => {
    if (!onEditorReady) return;
    onEditorReady(editor ?? null);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  // Keep track of the active note ID to detect switches
  const lastNoteIdRef = useRef<string | undefined>(undefined);

  // Reactively sync content ONLY when first loading or switching notes
  useEffect(() => {
    if (!editor || !noteId) return;

    if (noteId !== lastNoteIdRef.current) {
      const isSwitching = lastNoteIdRef.current !== undefined && lastNoteIdRef.current !== "new";
      const isInitialMount = lastNoteIdRef.current === undefined;

      lastNoteIdRef.current = noteId;

      if (isInitialMount || isSwitching) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [noteId, editor]);

  if (!editor) return <div>Loading editor...</div>;

  return (
    <div
      className={cn("editor-shell relative mx-auto w-full", editorWidthMap[editorWidth])}
      style={{
        ["--editor-font-size" as string]: fontSizeMap[editorFontSize],
        ["--editor-font-family" as string]: resolvedFontFamily,
        ["--editor-line-height" as string]: lineSpacing === "relaxed" ? "2.4" : "2.02",
      }}
    >
      {editable && aiChat && (
        <EditorBubbleMenu
          editor={editor}
          onAskAi={(selectedText, startLine, endLine) => {
            const lineRange = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
            aiChat.setChatInput(`explain this part (${lineRange}):\n"${selectedText}"`);
            usePanelStore.getState().setAiPanelOpen(true);

            let attempts = 0;
            const focusTextarea = () => {
              const chatInputEl = document.querySelector(".gc-textarea") as HTMLTextAreaElement;
              if (chatInputEl) {
                chatInputEl.focus();
                chatInputEl.setSelectionRange(chatInputEl.value.length, chatInputEl.value.length);
              } else if (attempts < 20) {
                attempts++;
                setTimeout(focusTextarea, 100);
              }
            };
            setTimeout(focusTextarea, 100);
          }}
        />
      )}
      {editable && <AiInlineMenu editor={editor} />}

      <div className="overflow-x-auto">
        <EditorContent className="editor-content-shell" editor={editor} spellCheck={spellCheck && editable} onKeyDown={handleEditorKeyDown} />
      </div>


    </div>
  );
};

export default React.memo(TipTap, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.editable === nextProps.editable &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.onEditorReady === nextProps.onEditorReady &&
    prevProps.aiChat?.loadingAction === nextProps.aiChat?.loadingAction
  );
});
