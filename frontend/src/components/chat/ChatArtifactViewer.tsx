import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  FileCode,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactDescription,
  ArtifactActions,
  ArtifactAction,
  ArtifactClose,
  ArtifactContent,
} from "@/components/ai/artifact";
import { markdownToHtml } from "@/utils/markdownToHtml";
import type { ChatArtifact } from "@/components/ai/types";

interface ChatArtifactViewerProps {
  artifact: ChatArtifact;
  onClose: () => void;
}

export const ChatArtifactViewer: React.FC<ChatArtifactViewerProps> = ({
  artifact,
  onClose,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const noteContent = artifact.type === "note" ? artifact.content : undefined;

  const renderedHtml = useMemo(() => {
    if (!noteContent?.trim()) return "<p>Empty note</p>";
    const raw = noteContent.trim();
    const isHtml = /<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|hr)[^>]*>/i.test(raw);
    return isHtml ? raw : markdownToHtml(raw);
  }, [noteContent]);

  // If the generated note already starts with a title/heading, avoid duplicating it
  const hasHeadingInContent = useMemo(() => {
    return /^<h[1-2]/i.test(renderedHtml.trim());
  }, [renderedHtml]);

  const handleCopy = () => {
    const textToCopy =
      artifact.type === "note"
        ? (artifact.content || "")
            .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        : artifact.rawText || artifact.url || "";

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInEditor = () => {
    if (artifact.type === "note" && artifact.id) {
      navigate(`/note/${artifact.id}`);
    }
  };

  const title =
    artifact.title || (artifact.type === "note" ? "Untitled Note" : "Document");

  return (
    <Artifact>
      {/* Composable Artifact Header */}
      <ArtifactHeader>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
            {artifact.type === "note" ? (
              <FileText size={16} />
            ) : (
              <FileCode size={16} />
            )}
          </div>
          <div className="min-w-0">
            <ArtifactDescription>
              <Sparkles size={10} />
              <span>{artifact.type === "note" ? "Generated Note" : "PDF Document"}</span>
            </ArtifactDescription>
            <ArtifactTitle>{title}</ArtifactTitle>
          </div>
        </div>

        {/* Composable Artifact Actions */}
        <ArtifactActions>
          {artifact.type === "note" && artifact.id && (
            <ArtifactAction
              variant="outline"
              onClick={handleOpenInEditor}
              title="Open in full TipTap editor"
            >
              <span>Full Editor</span>
              <ExternalLink size={13} />
            </ArtifactAction>
          )}

          <ArtifactAction
            variant="outline"
            onClick={handleCopy}
            title="Copy note content"
          >
            {copied ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
          </ArtifactAction>

          <ArtifactClose onClick={onClose} />
        </ArtifactActions>
      </ArtifactHeader>

      {/* Composable Scrollable Artifact Content */}
      <ArtifactContent>
        {artifact.type === "note" ? (
          <div className="max-w-2xl mx-auto pb-16">
            {!hasHeadingInContent && (
              <h1 className="text-2xl font-bold text-white tracking-tight mb-4 pb-2 border-b border-slate-800">
                {title}
              </h1>
            )}
            <div
              className="prose prose-invert prose-slate max-w-none text-slate-200 leading-relaxed font-sans [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:tracking-tight [&>h1]:mb-4 [&>h1]:mt-0 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:tracking-tight [&>h2]:mt-6 [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-white/90 [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>li]:my-1 [&>p]:my-2 [&>p]:leading-relaxed [&>code]:bg-slate-800 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-slate-200 [&>code]:font-mono [&>code]:text-xs [&>pre]:bg-slate-950/80 [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-slate-800 [&>pre]:my-3 [&>hr]:border-slate-800 [&>hr]:my-4"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        ) : (
          /* PDF Viewer Branch */
          <div className="h-full w-full flex flex-col items-center justify-center">
            {artifact.url ? (
              <iframe
                src={artifact.url}
                title={title}
                className="w-full h-full rounded-xl border border-white/10 bg-neutral-900"
              />
            ) : artifact.rawText ? (
              <div className="w-full h-full p-4 rounded-xl border border-white/10 bg-neutral-900/50 font-mono text-xs text-neutral-300 whitespace-pre-wrap overflow-y-auto">
                {artifact.rawText}
              </div>
            ) : (
              <div className="text-center text-neutral-400">
                <FileCode size={36} className="mx-auto mb-2 opacity-50" />
                <p>PDF Document</p>
              </div>
            )}
          </div>
        )}
      </ArtifactContent>
    </Artifact>
  );
};

export default ChatArtifactViewer;
