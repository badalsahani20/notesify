import React, { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import { Columns2, Rows, ChevronDown, ChevronRight, Plus, Minus, Layers } from "lucide-react";
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
      // Split chunk into individual lines
      const chunkLines = chunk.value.replace(/\r\n/g, "\n").split("\n");
      // If trailing line is empty due to split at end of string
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

    // Find indices of all changed lines
    const changedIndices = new Set<number>();
    allLines.forEach((l, idx) => {
      if (l.type !== "unchanged") {
        changedIndices.add(idx);
      }
    });

    // If everything is unchanged or empty
    if (changedIndices.size === 0) {
      return [{ type: "hunk", lines: allLines }] as HunkBlock[];
    }

    // Determine which unchanged lines are within CONTEXT_SIZE distance from a change
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

  // Inline word diff helper for modified lines
  const renderWordDiff = (line: DiffLine) => {
    return (
      <span className="font-mono text-xs whitespace-pre-wrap break-all">
        {line.text || " "}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-white/10 bg-neutral-950/80 overflow-hidden text-neutral-200">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-neutral-900/90 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Layers size={14} className="text-indigo-400" />
            Changes Overview
          </span>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
              <Plus size={10} /> {stats.additions} added
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-0.5">
              <Minus size={10} /> {stats.deletions} removed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hunks.some((h) => h.type === "folded") && (
            <button
              type="button"
              onClick={toggleAllFolds}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              Toggle Unchanged Lines
            </button>
          )}

          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === "unified"
                  ? "bg-white/15 text-white font-medium shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Rows size={12} /> Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === "split"
                  ? "bg-white/15 text-white font-medium shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Columns2 size={12} /> Split
            </button>
          </div>
        </div>
      </div>

      {/* Title Diff (if title changed) */}
      {hasTitleChange && (
        <div className="px-4 py-2 bg-neutral-900/40 border-b border-white/5 text-xs flex flex-col gap-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Note Title Changed
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25 line-through">
              - {serverTitle || "<Empty>"} (Server v{serverVersion ?? "?"})
            </span>
            <span className="text-neutral-500">→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              + {localTitle || "<Empty>"} (Your draft v{localVersion ?? "?"})
            </span>
          </div>
        </div>
      )}

      {/* Main Diff Content */}
      <div className="flex-1 overflow-y-auto max-h-[380px] font-mono text-xs select-text">
        {allLines.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No text differences detected.
          </div>
        ) : viewMode === "unified" ? (
          /* UNIFIED DIFF VIEW */
          <div className="divide-y divide-white/5">
            {hunks.map((block, bIdx) => {
              if (block.type === "folded") {
                const isExpanded = expandedHunks[block.id];
                return (
                  <div key={block.id}>
                    <button
                      type="button"
                      onClick={() => toggleFold(block.id)}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-4 bg-neutral-900/60 hover:bg-neutral-800/80 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors border-y border-white/5"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>
                        {isExpanded
                          ? `Collapse ${block.count} unchanged lines`
                          : `↕ Expand ${block.count} unchanged lines`}
                      </span>
                    </button>
                    {isExpanded &&
                      block.lines.map((line, lIdx) => (
                        <div
                          key={`fold-${bIdx}-${lIdx}`}
                          className="flex items-start px-2 py-0.5 bg-black/20 text-neutral-500 hover:bg-white/5"
                        >
                          <span className="w-10 text-right pr-3 select-none text-neutral-600 shrink-0">
                            {line.oldLineNumber}
                          </span>
                          <span className="w-10 text-right pr-3 select-none text-neutral-600 shrink-0">
                            {line.newLineNumber}
                          </span>
                          <span className="w-5 text-center select-none text-neutral-600 shrink-0"> </span>
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
                            ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500"
                            : isRemoved
                            ? "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500"
                            : "bg-transparent text-neutral-400 hover:bg-white/5"
                        }`}
                      >
                        <span className="w-10 text-right pr-3 select-none text-neutral-600 shrink-0">
                          {line.oldLineNumber ?? ""}
                        </span>
                        <span className="w-10 text-right pr-3 select-none text-neutral-600 shrink-0">
                          {line.newLineNumber ?? ""}
                        </span>
                        <span
                          className={`w-5 text-center select-none font-bold shrink-0 ${
                            isAdded
                              ? "text-emerald-400"
                              : isRemoved
                              ? "text-rose-400"
                              : "text-neutral-600"
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
          <div className="grid grid-cols-2 divide-x divide-white/10 min-w-[600px]">
            {/* Server Column Header */}
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-neutral-900 border-b border-white/10 text-[11px] font-medium text-rose-400 flex items-center justify-between">
              <span>Server Version (v{serverVersion ?? "?"})</span>
              <span className="text-[10px] text-neutral-500">Deleted / Prior text</span>
            </div>
            {/* Local Column Header */}
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-neutral-900 border-b border-white/10 text-[11px] font-medium text-emerald-400 flex items-center justify-between">
              <span>Your Local Draft (v{localVersion ?? "?"})</span>
              <span className="text-[10px] text-neutral-500">Added / New text</span>
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
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-4 bg-neutral-900/60 hover:bg-neutral-800/80 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors border-y border-white/5"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>
                        {isExpanded
                          ? `Collapse ${block.count} unchanged lines`
                          : `↕ Expand ${block.count} unchanged lines`}
                      </span>
                    </button>
                    {isExpanded &&
                      block.lines.map((line, lIdx) => (
                        <div
                          key={`split-fold-${bIdx}-${lIdx}`}
                          className="grid grid-cols-2 divide-x divide-white/10 bg-black/20 text-neutral-500"
                        >
                          <div className="flex items-start px-2 py-0.5">
                            <span className="w-8 text-right pr-2 text-neutral-600 select-none shrink-0">
                              {line.oldLineNumber}
                            </span>
                            <div className="flex-1 min-w-0">{renderWordDiff(line)}</div>
                          </div>
                          <div className="flex items-start px-2 py-0.5">
                            <span className="w-8 text-right pr-2 text-neutral-600 select-none shrink-0">
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
                              ? "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500"
                              : isAdded
                              ? "bg-neutral-950/30 text-transparent select-none"
                              : "bg-transparent text-neutral-400 hover:bg-white/5"
                          }`}
                        >
                          <span className="w-8 text-right pr-2 text-neutral-600 select-none shrink-0">
                            {line.oldLineNumber ?? ""}
                          </span>
                          <span className="w-4 select-none font-bold text-rose-400 shrink-0">
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
                              ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500"
                              : isRemoved
                              ? "bg-neutral-950/30 text-transparent select-none"
                              : "bg-transparent text-neutral-400 hover:bg-white/5"
                          }`}
                        >
                          <span className="w-8 text-right pr-2 text-neutral-600 select-none shrink-0">
                            {line.newLineNumber ?? ""}
                          </span>
                          <span className="w-4 select-none font-bold text-emerald-400 shrink-0">
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
