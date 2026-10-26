import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiGhostText: {
      setAiGhost: () => ReturnType;
      unsetAiGhost: () => ReturnType;
      unsetAllAiGhost: () => ReturnType;
      discardAllAiGhost: () => ReturnType;
    };
  }
}

export const AiGhostExtension = Mark.create({
  name: 'aiGhostText',

  parseHTML() {
    return [
      {
        tag: 'span[data-ai-ghost]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-ai-ghost': '' }), 0];
  },

  addCommands() {
    return {
      setAiGhost: () => ({ commands }) => {
        return commands.setMark(this.name);
      },
      unsetAiGhost: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
      unsetAllAiGhost: () => ({ tr, state }) => {
        const ghostMarkType = state.schema.marks[this.name];
        if (!ghostMarkType) return false;
        tr.removeMark(0, state.doc.content.size, ghostMarkType);
        return true;
      },
      discardAllAiGhost: () => ({ tr, state }) => {
        const ghostMarkType = state.schema.marks[this.name];
        if (!ghostMarkType) return false;

        const ranges: { from: number; to: number }[] = [];
        state.doc.descendants((node, pos) => {
          if (node.isText && node.marks.some((m) => m.type === ghostMarkType)) {
            ranges.push({ from: pos, to: pos + node.nodeSize });
          }
        });

        if (ranges.length === 0) return false;

        // Merge contiguous/overlapping ranges
        const merged: { from: number; to: number }[] = [];
        for (const range of ranges) {
          const last = merged[merged.length - 1];
          if (last && range.from <= last.to) {
            last.to = Math.max(last.to, range.to);
          } else {
            merged.push({ ...range });
          }
        }

        // Delete backwards so character positions remain stable
        for (let i = merged.length - 1; i >= 0; i--) {
          tr.delete(merged[i].from, merged[i].to);
        }

        return true;
      },
    };
  },
});
