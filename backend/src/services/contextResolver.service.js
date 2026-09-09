import Notes from "../models/notes.model.js";
import { searchMemories } from "./memoryService.js";
import { generateEmbedding } from "./embeddingService.js";
import { stripHtml } from "../utils/stripHtml.js";

/**
 * Server-side Context Resolver (Phase 5)
 * Evaluates incoming user request and gathers all relevant context sources
 * without assembling final prompt strings.
 */
export const resolveAIContext = async ({
  userId,
  message = "",
  noteId = null,
  structuredContext = null,
  reqNoteContext = "",
  hasSelection = false,
  pdfContext = "",
}) => {
  let resolvedNoteContext = "";
  let activeNeighborhood = structuredContext || null;
  let memories = [];
  let retrievedNotes = [];

  // 1. Resolve Current Note / Neighborhood Context
  if (structuredContext?.hasSelection && structuredContext.selection?.text) {
    resolvedNoteContext = `[User specifically highlighted this text]:\n${structuredContext.selection.text}`;
  } else if (structuredContext?.surroundingBlocks?.length > 0) {
    const headingHeader = structuredContext.headingPath?.length
      ? `[Location: ${structuredContext.headingPath.join(" > ")}]\n`
      : "";
    const blocksText = structuredContext.surroundingBlocks
      .map((b) => `- ${b.text}`)
      .join("\n");
    resolvedNoteContext = `[Active Note Neighborhood]:\n${headingHeader}${blocksText}`;
  } else if (reqNoteContext) {
    resolvedNoteContext = hasSelection
      ? `[User highlighted text]:\n${reqNoteContext}`
      : `[Editor Context]:\n${reqNoteContext}`;
  } else if (noteId && noteId !== "new") {
    const note = await Notes.findOne({ _id: noteId, user: userId }).lean();
    if (note?.content) {
      resolvedNoteContext = `Title: ${note.title || "Untitled"}\n\n${stripHtml(note.content).slice(0, 1500)}`;
    }
  }

  // 2. Vector Search Memories & Related Notes
  if (message && message.trim()) {
    try {
      const queryEmbedding = await generateEmbedding(message);
      if (queryEmbedding) {
        const notesPipeline = [
          {
            $vectorSearch: {
              index: "notes_vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 20,
              limit: 3,
              filter: { user: userId, isDeleted: false },
            },
          },
          {
            $project: { title: 1, content: 1, score: { $meta: "vectorSearchScore" } },
          },
          {
            $match: { score: { $gte: 0.6 } },
          },
        ];

        const [memoriesResult, retrievedNotesResult] = await Promise.all([
          searchMemories(userId, message, queryEmbedding),
          Notes.aggregate(notesPipeline).catch(() => []),
        ]);

        memories = memoriesResult || [];
        retrievedNotes = retrievedNotesResult || [];
      }
    } catch (err) {
      console.warn("⚠️ Context Resolver Vector Search Warning:", err.message);
      memories = await searchMemories(userId, message);
    }
  }

  return {
    noteId,
    revisionId: structuredContext?.revisionId || null,
    hasSelection,
    activeNeighborhood,
    resolvedNoteContext,
    memories,
    retrievedNotes,
    pdfContext: pdfContext || null,
  };
};
