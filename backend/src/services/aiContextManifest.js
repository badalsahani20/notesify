/**
 * AI Context Manifest Factory (Phase 6)
 * Normalizes all context candidates into a unified manifest structure before prompting.
 */
export const createAIContextManifest = ({
  noteId = null,
  revisionId = null,
  title = "Untitled",
  headingPath = [],
  blockId = null,
  selection = null,
  currentBlocks = [],
  surroundingBlocks = [],
  relevantBlocks = [],
  relatedNotes = [],
  memories = [],
  attachments = [],
  conversation = {},
}) => {
  return {
    note: {
      id: noteId,
      revisionId: revisionId || 1,
      title,
    },
    location: {
      blockId: blockId || undefined,
      headingPath: headingPath || [],
    },
    selection: selection || undefined,
    currentBlocks: currentBlocks || [],
    surroundingBlocks: surroundingBlocks || [],
    relevantBlocks: relevantBlocks || [],
    relatedNotes: relatedNotes || [],
    memories: memories || [],
    attachments: attachments || [],
    conversation: conversation || {},
  };
};
