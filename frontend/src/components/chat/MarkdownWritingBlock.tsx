import { useState, useRef, useEffect } from "react";
import { CheckCheck, Copy, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { irisSanitizeSchema } from "@/utils/markdownSanitizeSchema";

type MarkdownWritingBlockProps = {
  content: string;
};

const MarkdownWritingBlock = ({ content }: MarkdownWritingBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with incoming streaming prop only if user isn't actively editing
  useEffect(() => {
    if (!isEditing) {
      setLocalContent(content);
    }
  }, [content, isEditing]);

  // Auto-resize and focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 120)}px`;
      textareaRef.current.focus();
    }
  }, [isEditing, localContent]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(localContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleStartEdit = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return; // Preserve text selection for copying
    }
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  return (
    <div className={`gc-writing-block my-4 ${isEditing ? "gc-writing-is-editing" : ""}`}>
      <div className="gc-writing-header">
        <div className="gc-writing-header-left">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 select-none">
            <FileText size={13} className="text-neutral-400" />
            <span>Draft</span>
            {isEditing && (
              <span className="text-[10px] text-amber-400/90 font-normal ml-1">
                (editing · Esc or click outside to finish)
              </span>
            )}
          </div>
        </div>
        <div className="gc-writing-header-right">
          <button
            type="button"
            className="gc-writing-action-btn"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy text"}
          >
            {copied ? (
              <CheckCheck size={16} className="text-emerald-500" />
            ) : (
              <Copy size={16} />
            )}
          </button>
        </div>
      </div>
      <div className="gc-writing-content">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="gc-writing-textarea"
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="Write or edit content here..."
          />
        ) : (
          <div
            className="gc-writing-rendered cursor-text whitespace-normal prose prose-invert prose-slate max-w-none text-slate-100 leading-relaxed font-sans [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:tracking-tight [&>h1]:mb-3 [&>h1]:mt-1 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:tracking-tight [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-white/90 [&>h3]:mt-3 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2 [&>li]:my-1 [&>p]:my-2 [&>p]:leading-relaxed [&>code]:bg-slate-800 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-slate-200 [&>code]:font-mono [&>code]:text-xs [&>pre]:bg-slate-950/80 [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-slate-800 [&>pre]:my-2 [&>table]:w-full [&>table]:my-3 [&>hr]:border-slate-800 [&>hr]:my-3"
            onClick={handleStartEdit}
            title="Click anywhere to edit"
          >
            {localContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, irisSanitizeSchema]]}
              >
                {localContent}
              </ReactMarkdown>
            ) : (
              <span className="text-neutral-500 italic">Empty draft. Click to write...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownWritingBlock;
