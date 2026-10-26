import React, { useMemo, useState, useEffect } from "react";
import { diffLines, diffWordsWithSpace, type Change } from "diff";
import { Columns2, Rows, ChevronDown, ChevronRight, Layers, Cloud, Laptop } from "lucide-react";
import { htmlToMultilineText } from "@/utils/stripHtml";
import { Button } from "@/components/ui/button";

interface NoteDiffViewerProps {
  serverTitle?: string;
  localTitle?: string;
  serverContent: string;
  localContent: string;
  serverVersion?: number;
  localVersion?: number;
  initialViewMode?: "unified" | "split";
  hideModeToggle?: boolean;
  onSelectServer?: () => void;
  onSelectLocal?: () => void;
  isResolving?: boolean;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordChanges?: Change[];
}

type HunkBlock =
  | { type: "hunk"; lines: DiffLine[] }
  | { type: "folded"; lines: DiffLine[]; count: number; id: string };

interface SplitRow {
  id: string;
  type: "modified" | "unchanged" | "added" | "removed";
  left?: DiffLine;
  right?: DiffLine;
}

type SplitHunkBlock =
  | { type: "hunk"; rows: SplitRow[] }
  | { type: "folded"; rows: SplitRow[]; count: number; id: string };

const CONTEXT_SIZE = 3; // Keep 3 unchanged lines above and below each change

export const NoteDiffViewer: React.FC<NoteDiffViewerProps> = ({
  serverTitle = "Untitled",
  localTitle = "Untitled",
  serverContent,
  localContent,
  serverVersion,
  localVersion,
  initialViewMode = "unified",
  hideModeToggle = false,
  onSelectServer,
  onSelectLocal,
  isResolving = false,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">(initialViewMode);
  const [expandedHunks, setExpandedHunks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Convert HTML to multiline text preserving paragraphs for accurate line-by-line diffing
  const oldText = useMemo(() => htmlToMultilineText(serverContent || ""), [serverContent]);
  const newText = useMemo(() => htmlToMultilineText(localContent || ""), [localContent]);

  const hasTitleChange = serverTitle.trim() !== localTitle.trim();

  // Compute raw diff chunks
  const rawDiff = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  // 1. Unified Diff Lines Computation
  const { allLines, stats } = useMemo(() => {
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

    // Pair consecutive blocks of removed and added lines for intra-line word-level highlighting
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      if (lines[lineIdx].type === "removed") {
        const remStart = lineIdx;
        while (lineIdx < lines.length && lines[lineIdx].type === "removed") {
          lineIdx++;
        }
        const remEnd = lineIdx;
        const addStart = lineIdx;
        while (lineIdx < lines.length && lines[lineIdx].type === "added") {
          lineIdx++;
        }
        const addEnd = lineIdx;

        const remCount = remEnd - remStart;
        const addCount = addEnd - addStart;
        const pairCount = Math.min(remCount, addCount);

        for (let k = 0; k < pairCount; k++) {
          const remLine = lines[remStart + k];
          const addLine = lines[addStart + k];
          const wordDiff = diffWordsWithSpace(remLine.text, addLine.text);
          remLine.wordChanges = wordDiff.filter((w) => !w.added);
          addLine.wordChanges = wordDiff.filter((w) => !w.removed);
        }
      } else {
        lineIdx++;
      }
    }

    return { allLines: lines, stats: { additions, deletions } };
  }, [rawDiff]);

  // 2. Unified Hunks
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

  // 3. Side-by-Side (Split) Rows with Row-Level Alignment
  const splitRows = useMemo(() => {
    const rows: SplitRow[] = [];
    let oldNum = 1;
    let newNum = 1;
    let i = 0;
    let rowId = 0;

    while (i < rawDiff.length) {
      const chunk = rawDiff[i];
      const nextChunk = rawDiff[i + 1];

      // Pair a removed chunk and an added chunk occurring adjacent to each other (a modification on the same row!)
      const isModificationPair =
        (chunk.removed && nextChunk?.added) || (chunk.added && nextChunk?.removed);

      if (isModificationPair) {
        const remChunk = chunk.removed ? chunk : nextChunk;
        const addChunk = chunk.added ? chunk : nextChunk;

        const removedLines = remChunk.value.replace(/\r\n/g, "\n").split("\n");
        if (removedLines[removedLines.length - 1] === "" && removedLines.length > 1) removedLines.pop();

        const addedLines = addChunk.value.replace(/\r\n/g, "\n").split("\n");
        if (addedLines[addedLines.length - 1] === "" && addedLines.length > 1) addedLines.pop();

        const maxLen = Math.max(removedLines.length, addedLines.length);
        for (let k = 0; k < maxLen; k++) {
          const remText = removedLines[k];
          const addText = addedLines[k];

          if (remText !== undefined && addText !== undefined) {
            const wordDiff = diffWordsWithSpace(remText, addText);
            const leftLine: DiffLine = {
              type: "removed",
              text: remText,
              oldLineNumber: oldNum++,
              wordChanges: wordDiff.filter((w) => !w.added),
            };
            const rightLine: DiffLine = {
              type: "added",
              text: addText,
              newLineNumber: newNum++,
              wordChanges: wordDiff.filter((w) => !w.removed),
            };
            rows.push({ id: `sr-${rowId++}`, type: "modified", left: leftLine, right: rightLine });
          } else if (remText !== undefined) {
            const leftLine: DiffLine = {
              type: "removed",
              text: remText,
              oldLineNumber: oldNum++,
            };
            rows.push({ id: `sr-${rowId++}`, type: "removed", left: leftLine });
          } else if (addText !== undefined) {
            const rightLine: DiffLine = {
              type: "added",
              text: addText,
              newLineNumber: newNum++,
            };
            rows.push({ id: `sr-${rowId++}`, type: "added", right: rightLine });
          }
        }
        i += 2;
      } else if (chunk.removed) {
        const removedLines = chunk.value.replace(/\r\n/g, "\n").split("\n");
        if (removedLines[removedLines.length - 1] === "" && removedLines.length > 1) removedLines.pop();
        for (const line of removedLines) {
          rows.push({
            id: `sr-${rowId++}`,
            type: "removed",
            left: { type: "removed", text: line, oldLineNumber: oldNum++ },
          });
        }
        i++;
      } else if (chunk.added) {
        const addedLines = chunk.value.replace(/\r\n/g, "\n").split("\n");
        if (addedLines[addedLines.length - 1] === "" && addedLines.length > 1) addedLines.pop();
        for (const line of addedLines) {
          rows.push({
            id: `sr-${rowId++}`,
            type: "added",
            right: { type: "added", text: line, newLineNumber: newNum++ },
          });
        }
        i++;
      } else {
        // Unchanged
        const unchangedLines = chunk.value.replace(/\r\n/g, "\n").split("\n");
        if (unchangedLines[unchangedLines.length - 1] === "" && unchangedLines.length > 1) unchangedLines.pop();
        for (const line of unchangedLines) {
          const lNum = oldNum++;
          const rNum = newNum++;
          rows.push({
            id: `sr-${rowId++}`,
            type: "unchanged",
            left: { type: "unchanged", text: line, oldLineNumber: lNum },
            right: { type: "unchanged", text: line, newLineNumber: rNum },
          });
        }
        i++;
      }
    }

    return rows;
  }, [rawDiff]);

  // 4. Side-by-Side Hunks with Context Folding
  const splitHunks = useMemo(() => {
    if (splitRows.length === 0) return [];

    const changedIndices = new Set<number>();
    splitRows.forEach((r, idx) => {
      if (r.type !== "unchanged") {
        changedIndices.add(idx);
      }
    });

    if (changedIndices.size === 0) {
      return [{ type: "hunk", rows: splitRows }] as SplitHunkBlock[];
    }

    const visibleIndices = new Set<number>();
    changedIndices.forEach((changeIdx) => {
      const start = Math.max(0, changeIdx - CONTEXT_SIZE);
      const end = Math.min(splitRows.length - 1, changeIdx + CONTEXT_SIZE);
      for (let i = start; i <= end; i++) {
        visibleIndices.add(i);
      }
    });

    const blocks: SplitHunkBlock[] = [];
    let currentHunk: SplitRow[] = [];
    let currentFolded: SplitRow[] = [];
    let foldCounter = 0;

    splitRows.forEach((row, idx) => {
      if (visibleIndices.has(idx)) {
        if (currentFolded.length > 0) {
          blocks.push({
            type: "folded",
            rows: currentFolded,
            count: currentFolded.length,
            id: `split-fold-${foldCounter++}`,
          });
          currentFolded = [];
        }
        currentHunk.push(row);
      } else {
        if (currentHunk.length > 0) {
          blocks.push({ type: "hunk", rows: currentHunk });
          currentHunk = [];
        }
        currentFolded.push(row);
      }
    });

    if (currentHunk.length > 0) {
      blocks.push({ type: "hunk", rows: currentHunk });
    }
    if (currentFolded.length > 0) {
      blocks.push({
        type: "folded",
        rows: currentFolded,
        count: currentFolded.length,
        id: `split-fold-${foldCounter++}`,
      });
    }

    return blocks;
  }, [splitRows]);

  const toggleFold = (foldId: string) => {
    setExpandedHunks((prev) => ({ ...prev, [foldId]: !prev[foldId] }));
  };

  const toggleAllFolds = () => {
    const activeFoldIds =
      viewMode === "unified"
        ? hunks
            .filter((h): h is Extract<HunkBlock, { type: "folded" }> => h.type === "folded")
            .map((h) => h.id)
        : splitHunks
            .filter((h): h is Extract<SplitHunkBlock, { type: "folded" }> => h.type === "folded")
            .map((h) => h.id);

    const areAllExpanded = activeFoldIds.every((id) => expandedHunks[id]);
    const nextState: Record<string, boolean> = {};
    activeFoldIds.forEach((id) => {
      nextState[id] = !areAllExpanded;
    });
    setExpandedHunks(nextState);
  };

  const renderWordDiff = (line: DiffLine) => {
    if (line.wordChanges && line.wordChanges.length > 0) {
      return (
        <span className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
          {line.wordChanges.map((part, pIdx) => {
            if (part.added) {
              return (
                <span
                  key={pIdx}
                  className="bg-emerald-200 text-emerald-950 dark:bg-emerald-500/35 dark:text-emerald-100 font-semibold px-1 py-0.5 rounded-sm ring-1 ring-emerald-500/40 inline-block"
                >
                  {part.value}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span
                  key={pIdx}
                  className="bg-rose-200 text-rose-950 dark:bg-rose-500/35 dark:text-rose-100 font-semibold px-1 py-0.5 rounded-sm ring-1 ring-rose-500/40 inline-block"
                >
                  {part.value}
                </span>
              );
            }
            return <span key={pIdx}>{part.value}</span>;
          })}
        </span>
      );
    }

    return (
      <span className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {line.text || " "}
      </span>
    );
  };

  const hasFolds =
    viewMode === "unified"
      ? hunks.some((h) => h.type === "folded")
      : splitHunks.some((h) => h.type === "folded");

  return (
    <div className="flex flex-col h-full rounded-lg border border-[var(--divider)] bg-[var(--window-bg)] overflow-hidden text-[var(--text-strong)] text-xs">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-[var(--surface-muted)]/70 border-b border-[var(--divider)] select-none shrink-0">
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

        <div className="flex items-center gap-3">
          {hasFolds && (
            <button
              type="button"
              onClick={toggleAllFolds}
              className="px-2 py-1 rounded text-[11px] font-medium text-[var(--muted-text)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-ghost)] transition-colors cursor-pointer"
            >
              Toggle unchanged
            </button>
          )}

          {!hideModeToggle ? (
            <div className="flex items-center p-0.5 rounded-md bg-[var(--surface-ghost)] border border-[var(--divider)] text-xs">
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                className={`px-2 py-0.5 rounded-sm flex items-center gap-1.5 text-[11px] transition-all cursor-pointer ${
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
                className={`px-2 py-0.5 rounded-sm flex items-center gap-1.5 text-[11px] transition-all cursor-pointer ${
                  viewMode === "split"
                    ? "bg-[var(--window-bg)] text-[var(--text-strong)] font-medium shadow-2xs"
                    : "text-[var(--muted-text)] hover:text-[var(--text-strong)]"
                }`}
              >
                <Columns2 size={11} /> Side-by-Side
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted-text)] select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/30 border border-rose-500/70 inline-block" />
                <span>Server (Old)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/30 border border-emerald-500/70 inline-block" />
                <span>Local (New)</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Title Diff Banner (if title changed) */}
      {hasTitleChange && (
        <div className="px-3.5 py-2 bg-[var(--surface-muted)]/30 border-b border-[var(--divider)] text-xs flex items-center gap-2 flex-wrap shrink-0">
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
      <div className="flex-1 overflow-y-auto min-h-0 font-mono text-xs select-text custom-scrollbar">
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
                      className="w-full flex items-center justify-center gap-2 py-1 px-4 bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors border-y border-[var(--divider)]/60 select-none font-sans cursor-pointer"
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
          /* SPLIT (SIDE-BY-SIDE) VIEW WITH ALIGNED ROWS & HIGHLIGHTS */
          <div className="min-w-[620px] flex flex-col">
            {/* Split Column Headers with Action Buttons */}
            <div className="sticky top-0 z-10 grid grid-cols-2 divide-x divide-[var(--divider)] border-b border-[var(--divider)] bg-[var(--surface-muted)]/95 backdrop-blur-xs select-none">
              {/* Server Column Header */}
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                    <Cloud size={12} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 text-xs">
                        Server Version
                      </span>
                      <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium">
                        v{serverVersion ?? "?"}
                      </span>
                    </div>
                    {serverTitle && (
                      <p className="text-[11px] text-[var(--muted-text)] truncate font-sans max-w-[200px]" title={serverTitle}>
                        {serverTitle}
                      </p>
                    )}
                  </div>
                </div>
                {onSelectServer && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSelectServer}
                    disabled={isResolving}
                    className="h-6.5 px-2.5 text-[11px] text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0 ml-2 font-medium"
                  >
                    Keep Server
                  </Button>
                )}
              </div>

              {/* Local Column Header */}
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Laptop size={12} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                        Your Local Draft
                      </span>
                      <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                        v{localVersion ?? "?"}
                      </span>
                    </div>
                    {localTitle && (
                      <p className="text-[11px] text-[var(--muted-text)] truncate font-sans max-w-[200px]" title={localTitle}>
                        {localTitle}
                      </p>
                    )}
                  </div>
                </div>
                {onSelectLocal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSelectLocal}
                    disabled={isResolving}
                    className="h-6.5 px-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer shrink-0 ml-2 font-medium"
                  >
                    Keep Local
                  </Button>
                )}
              </div>
            </div>

            {/* Split Aligned Rows */}
            <div className="divide-y divide-[var(--divider)]/30">
              {splitHunks.map((block, bIdx) => {
                if (block.type === "folded") {
                  const isExpanded = expandedHunks[block.id];
                  return (
                    <div key={block.id}>
                      <button
                        type="button"
                        onClick={() => toggleFold(block.id)}
                        className="w-full flex items-center justify-center gap-2 py-1 px-4 bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[11px] text-[var(--muted-text)] hover:text-[var(--text-strong)] transition-colors border-y border-[var(--divider)]/60 select-none font-sans cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>
                          {isExpanded
                            ? `Collapse ${block.count} unchanged lines`
                            : `Expand ${block.count} unchanged lines`}
                        </span>
                      </button>
                      {isExpanded &&
                        block.rows.map((row) => (
                          <div
                            key={row.id}
                            className="grid grid-cols-2 divide-x divide-[var(--divider)] text-[var(--muted-text)] opacity-70 hover:opacity-100 hover:bg-[var(--surface-ghost)]/30"
                          >
                            <div className="flex items-start px-2 py-0.5">
                              <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                                {row.left?.oldLineNumber ?? ""}
                              </span>
                              <div className="flex-1 min-w-0">
                                {row.left ? renderWordDiff(row.left) : " "}
                              </div>
                            </div>
                            <div className="flex items-start px-2 py-0.5">
                              <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                                {row.right?.newLineNumber ?? ""}
                              </span>
                              <div className="flex-1 min-w-0">
                                {row.right ? renderWordDiff(row.right) : " "}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                }

                return (
                  <div key={`split-hunk-${bIdx}`}>
                    {block.rows.map((row) => {
                      const isLeftHighlighted =
                        row.left && (row.type === "modified" || row.type === "removed");
                      const isRightHighlighted =
                        row.right && (row.type === "modified" || row.type === "added");

                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-2 divide-x divide-[var(--divider)]"
                        >
                          {/* Left Column (Server) */}
                          <div
                            className={`flex items-start px-2 py-1 min-h-[24px] transition-colors ${
                              row.left
                                ? isLeftHighlighted
                                  ? "bg-rose-500/[0.08] dark:bg-rose-500/[0.14] text-rose-950 dark:text-rose-100 border-l-2 border-rose-500"
                                  : "bg-transparent text-[var(--text-strong)]/85 hover:bg-[var(--surface-ghost)]/30"
                                : "bg-[var(--surface-muted)]/20 text-transparent select-none bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--divider)_6px,var(--divider)_7px)] opacity-35"
                            }`}
                          >
                            <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                              {row.left?.oldLineNumber ?? ""}
                            </span>
                            <span className="w-4 select-none font-bold text-rose-600 dark:text-rose-400 shrink-0">
                              {isLeftHighlighted ? "-" : " "}
                            </span>
                            <div className="flex-1 min-w-0">
                              {row.left ? renderWordDiff(row.left) : " "}
                            </div>
                          </div>

                          {/* Right Column (Local Draft) */}
                          <div
                            className={`flex items-start px-2 py-1 min-h-[24px] transition-colors ${
                              row.right
                                ? isRightHighlighted
                                  ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] text-emerald-950 dark:text-emerald-100 border-l-2 border-emerald-500"
                                  : "bg-transparent text-[var(--text-strong)]/85 hover:bg-[var(--surface-ghost)]/30"
                                : "bg-[var(--surface-muted)]/20 text-transparent select-none bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--divider)_6px,var(--divider)_7px)] opacity-35"
                            }`}
                          >
                            <span className="w-8 text-right pr-2 text-[var(--muted-text)]/60 select-none shrink-0 [font-variant-numeric:tabular-nums]">
                              {row.right?.newLineNumber ?? ""}
                            </span>
                            <span className="w-4 select-none font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {isRightHighlighted ? "+" : " "}
                            </span>
                            <div className="flex-1 min-w-0">
                              {row.right ? renderWordDiff(row.right) : " "}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
