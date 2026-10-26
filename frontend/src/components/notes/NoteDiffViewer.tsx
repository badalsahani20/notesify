import React, { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import { Columns2, Rows, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { stripHtml } from "@/utils/stripHtml";

interface NoteDiffViewerProps {
  serverTitle?: string;
  localTitle?: string;
  serverContent: string;
  localContent: string;
  serverVersion?: number;
  localVersion?: number;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

type HunkBlock =
  | { type: "hunk"; lines: DiffLine[] }
  | { type: "folded"; lines: DiffLine[]; count: number; id: string };

const CONTEXT_SIZE = 3; // Keep 3 unchanged lines above and below each change

export const NoteDiffViewer: React.FC<NoteDiffViewerProps> = ({
  serverTitle = "Untitled",
  localTitle = "Untitled",
  serverContent,
  localContent,
  serverVersion,
  localVersion,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [expandedHunks, setExpandedHunks] = useState<Record<string, boolean>>({});

  // Strip HTML for clean line-by-line diffing
  const oldText = useMemo(() => stripHtml(serverContent || ""), [serverContent]);
  const newText = useMemo(() => stripHtml(localContent || ""), [localContent]);

  const hasTitleChange = serverTitle.trim() !== localTitle.trim();

  // Compute line-by-line diff
  const { allLines, stats } = useMemo(() => {
    const rawDiff: Change[] = diffLines(oldText, newText);
    const lines: DiffLine[] = [];
    let oldNum = 1;
    let newNum = 1;
    let additions = 0;
    let deletions = 0;

    for (const chunk of rawDiff) {
      const chunkLines = chunk.value.replace(/\r\n/g, "\n").split("\n");
      if (chunkLines[chunkLines.length - 1] === "" && chunkLines.length > 1) {
        chunkLines.pop();
      }

      for (const line of chunkLines) {
        if (chunk.added) {
          additions++;
          lines.push({
            type: "added",
            text: line,
            newLineNumber: newNum++,
          });
        } else if (chunk.removed) {
          deletions++;
          lines.push({
            type: "removed",
            text: line,
            oldLineNumber: oldNum++,
          });
        } else {
          lines.push({
            type: "unchanged",
            text: line,
            oldLineNumber: oldNum++,
            newLineNumber: newNum++,
          });
        }
      }
    }

    return { allLines: lines, stats: { additions, deletions } };
  }, [oldText, newText]);

  // Group lines into hunks with context folding
  const hunks = useMemo(() => {
    if (allLines.length === 0) return [];

    const changedIndices = new Set<number>();
    allLines.forEach((l, idx) => {
      if (l.type !== "unchanged") {
        changedIndices.add(idx);
      }
    });

    if (changedIndices.size === 0) {
      return [{ type: "hunk", lines: allLines }] as HunkBlock[];
    }

    const visibleIndices = new Set<number>();
    changedIndices.forEach((changeIdx) => {
      const start = Math.max(0, changeIdx - CONTEXT_SIZE);
      const end = Math.min(allLines.length - 1, changeIdx + CONTEXT_SIZE);
      for (let i = start; i <= end; i++) {
        visibleIndices.add(i);
      }
    });

    const blocks: HunkBlock[] = [];
    let currentHunk: DiffLine[] = [];
    let currentFolded: DiffLine[] = [];
    let foldCounter = 0;

    allLines.forEach((line, idx) => {
      if (visibleIndices.has(idx)) {
        if (currentFolded.length > 0) {
          blocks.push({
            type: "folded",
            lines: currentFolded,
            count: currentFolded.length,
            id: `fold-${foldCounter++}`,
          });
          currentFolded = [];
        }
        currentHunk.push(line);
      } else {
        if (currentHunk.length > 0) {
          blocks.push({ type: "hunk", lines: currentHunk });
          currentHunk = [];
        }
        currentFolded.push(line);
      }
    });

    if (currentHunk.length > 0) {
      blocks.push({ type: "hunk", lines: currentHunk });
    }
    if (currentFolded.length > 0) {
      blocks.push({
        type: "folded",
        lines: currentFolded,
        count: currentFolded.length,
        id: `fold-${foldCounter++}`,
      });
    }

    return blocks;
  }, [allLines]);

  const toggleFold = (foldId: string) => {
    setExpandedHunks((prev) => ({ ...prev, [foldId]: !prev[foldId] }));
  };

  const toggleAllFolds = () => {
    const allFoldIds = hunks
      .filter((h): h is Extract<HunkBlock, { type: "folded" }> => h.type === "folded")
      .map((h) => h.id);
    const areAllExpanded = allFoldIds.every((id) => expandedHunks[id]);
    const nextState: Record<string, boolean> = {};
    allFoldIds.forEach((id) => {
      nextState[id] = !areAllExpanded;
    });
    setExpandedHunks(nextState);
  };

  const renderWordDiff = (line: DiffLine) => {
    return (
      <span className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {line.text || " "}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-[var(--divider)] bg-[var(--window-bg)] overflow-hidden text-[var(--text-strong)] text-xs">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-[var(--surface-muted)]/70 border-b border-[var(--divider)] select-none">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[var(--text-strong)] flex items-center gap-1.5 text-xs">
            <Layers size={13} className="text-[var(--accent-strong)]" />
            Comparison
          </span>
          <div className="flex items-center gap-2 text-[11px] font-mono [font-variant-numeric:tabular-nums]">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{stats.additions}
            </span>
            <span className="text-[var(--divider)]">/</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              -{stats.deletions}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hunks.some((h) => h.type === "folded") && (
            <button
              type="button"
              onClick={toggleAllFolds}
              className="px-2 py-1 rounded text-[11px] font-medium text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors"
            >
              Toggle unchanged
            </button>
          )}

          <div className="flex items-center p-0.5 rounded-md bg-[var(--surface-ghost)] border border-[var(--divider)] text-xs">
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              className={`px-2 py-0.5 rounded-sm flex items-center gap-1.5 text-[11px] transition-all ${
                viewMode === "unified"
                  ? "bg-[var(--window-bg)] text-[var(--text-strong)] font-medium shadow-2xs"
                  : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              }`}
            >
              <Rows size={11} /> Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-2 py-0.5 rounded-sm flex items-center gap-1.5 text-[11px] transition-all ${
                viewMode === "split"
                  ? "bg-[var(--window-bg)] text-[var(--text-strong)] font-medium shadow-2xs"
                  : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
              }`}
            >
              <Columns2 size={11} /> Split
            </button>
          </div>
        </div>
      </div>

      {/* Title Diff (if title changed) */}
      {hasTitleChange && (
        <div className="px-3.5 py-2 bg-[var(--surface-muted)]/30 border-b border-[var(--divider)] text-xs flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-[var(--muted-text)] uppercase tracking-wider">
            Title
          </span>
          <span className="font-mono text-rose-600 dark:text-rose-400 line-through opacity-80">
            {serverTitle || "<Empty>"}
          </span>
          <span className="text-[var(--muted-text)] text-[11px]">→</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
            {localTitle || "<Empty>"}
          </span>
        </div>
      )}

      {/* Main Diff Content */}
      <div className="flex-1 overflow-y-auto min-h-0 font-mono text-xs select-text">
        {allLines.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted-text)] font-sans">
            No textual differences found between versions.
          </div>
        ) : viewMode === "unified" ? (
          /* UNIFIED DIFF VIEW */
          <div className="divide-y divide-[var(--divider)]/40">
            {hunks.map((block, bIdx) => {
              if (block.type === "folded") {
                const isExpanded = expandedHunks[block.id];
                return (
                  <div key={block.id}>
                    <button
                      type="button"
                      onClick={() => toggleFold(block.id)}
                      className="w-full flex items-center justify-center gap-2 py-1 px-4 bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors border-y border-[var(--divider)]/60 select-none font-sans"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>
                        {isExpanded
                          ? `Collapse ${block.count} unchanged lines`
                          : `Expand ${block.count} unchanged lines`}
                      </span>
                    </button>
                    {isExpanded &&
                      block.lines.map((line, lIdx) => (
                        <div
                          key={`fold-${bIdx}-${lIdx}`}
                          className="flex items-start px-2 py-0.5 text-[var(--muted-text)] opacity-70 hover:opacity-100 hover:bg-[var(--surface-ghost)]/40"
                        >
                          <span className="w-8 text-right pr-2.5 select-none text-[var(--muted-text)]/60 shrink-0 [font-variant-numeric:tabular-nums]">
                            {line.oldLineNumber}
                          </span>
                          <span className="w-8 text-right pr-2.5 select-none text-[var(--muted-text)]/60 shrink-0 [font-variant-numeric:tabular-nums]">
                            {line.newLineNumber}
                          </span>
                          <span className="w-4 text-center select-none text-transparent shrink-0">·</span>
                          <div className="flex-1 min-w-0">{renderWordDiff(line)}</div>
                        </div>
                      ))}
                  </div>
                );
              }

              return (
                <div key={`hunk-${bIdx}`}>
                  {block.lines.map((line, lIdx) => {
                    const isAdded = line.type === "added";
                    const isRemoved = line.type === "removed";

                    return (
                      <div
                        key={`line-${bIdx}-${lIdx}`}
                        className={`flex items-start px-2 py-0.5 transition-colors ${
                          isAdded
                            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-l-2 border-emerald-500"
                            : isRemoved
                            ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-l-2 border-rose-500"
                            : "bg-transparent text-[var(--text-strong)]/85 hover:bg-[var(--surface-ghost)]/30"
                        }`}
                      >
                        <span className="w-8 text-right pr-2.5 select-none text-[var(--muted-text)]/60 shrink-0 [font-variant-numeric:tabular-nums]">
                          {line.oldLineNumber ?? ""}
                        </span>
                        <span className="w-8 text-right pr-2.5 select-none text-[var(--muted-text)]/60 shrink-0 [font-variant-numeric:tabular-nums]">
                          {line.newLineNumber ?? ""}
                        </span>
                        <span
                          className={`w-4 text-center select-none font-bold shrink-0 ${
                            isAdded
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isRemoved
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-transparent"
                          }`}
                        >
                          {isAdded ? "+" : isRemoved ? "-" : " "}
                        </span>
                        <div className="flex-1 min-w-0">{renderWordDiff(line)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          /* SPLIT (SIDE-BY-SIDE) VIEW */
          <div className="grid grid-cols-2 divide-x divide-[var(--divider)] min-w-[600px]">
            {/* Server Column Header */}
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--surface-muted)]/90 backdrop-blur-xs border-b border-[var(--divider)] text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between select-none">
              <span>Server version (v{serverVersion ?? "?"})</span>
              <span className="text-[10px] text-[var(--muted-text)] font-sans">Remote copy</span>
            </div>
            {/* Local Column Header */}
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--surface-muted)]/90 backdrop-blur-xs border-b border-[var(--divider)] text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between select-none">
              <span>Your local draft (v{localVersion ?? "?"})</span>
              <span className="text-[10px] text-[var(--muted-text)] font-sans">Current unsaved</span>
            </div>

            {/* Split Content Rows */}
            {hunks.map((block, bIdx) => {
              if (block.type === "folded") {
                const isExpanded = expandedHunks[block.id];
                return (
                  <div key={block.id} className="col-span-2">
                    <button
                      type="button"
                      onClick={() => toggleFold(block.id)}
                      className="w-full flex items-center justify-center gap-2 py-1 px-4 bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors border-y border-[var(--divider)]/60 select-none font-sans"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>
                        {isExpanded
                          ? `Collapse ${block.count} unchanged lines`
                          : `Expand ${block.count} unchanged lines`}
                      </span>
                    </button>
                    {isExpanded &&
                      block.lines.map((line, lIdx) => (
                        <div
                          key={`split-fold-${bIdx}-${lIdx}`}
                          className="grid grid-cols-2 divide-x divide-[var(--divider)] text-[var(--muted-text)] opacity-70 hover:opacity-100"
                        >
                          <div className="flex items-start px-2 py-0.5">
                            <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                              {line.oldLineNumber}
                            </span>
                            <div className="flex-1 min-w-0">{renderWordDiff(line)}</div>
                          </div>
                          <div className="flex items-start px-2 py-0.5">
                            <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                              {line.newLineNumber}
                            </span>
                            <div className="flex-1 min-w-0">{renderWordDiff(line)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              }

              return (
                <React.Fragment key={`split-hunk-${bIdx}`}>
                  {block.lines.map((line, lIdx) => {
                    const isAdded = line.type === "added";
                    const isRemoved = line.type === "removed";

                    return (
                      <React.Fragment key={`split-line-${bIdx}-${lIdx}`}>
                        {/* Left Pane (Server) */}
                        <div
                          className={`flex items-start px-2 py-0.5 min-h-[22px] ${
                            isRemoved
                              ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-l-2 border-rose-500"
                              : isAdded
                              ? "bg-[var(--surface-muted)]/20 text-transparent select-none"
                              : "bg-transparent text-[var(--text-strong)]/85 hover:bg-[var(--surface-ghost)]/30"
                          }`}
                        >
                          <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                            {line.oldLineNumber ?? ""}
                          </span>
                          <span className="w-4 select-none font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            {isRemoved ? "-" : " "}
                          </span>
                          <div className="flex-1 min-w-0">
                            {!isAdded ? renderWordDiff(line) : " "}
                          </div>
                        </div>

                        {/* Right Pane (Local Draft) */}
                        <div
                          className={`flex items-start px-2 py-0.5 min-h-[22px] ${
                            isAdded
                              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-l-2 border-emerald-500"
                              : isRemoved
                              ? "bg-[var(--surface-muted)]/20 text-transparent select-none"
                              : "bg-transparent text-[var(--text-strong)]/85 hover:bg-[var(--surface-ghost)]/30"
                          }`}
                        >
                          <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                            {line.newLineNumber ?? ""}
                          </span>
                          <span className="w-4 select-none font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {isAdded ? "+" : " "}
                          </span>
                          <div className="flex-1 min-w-0">
                            {!isRemoved ? renderWordDiff(line) : " "}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
