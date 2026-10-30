import { getNoteContentForUser, searchNote } from "../../notes.service.js";
import { saveMemoryWithStatus, searchMemories } from "../../memoryService.js";
import { stripHtml } from "../../../utils/stripHtml.js";

export class ToolExecutor {
  async execute({
    toolName,
    args,
    userId,
    fallbackNoteId = null,
  }) {
    if (toolName === "get_note_content") {
      const noteId = args?.noteId || fallbackNoteId;
      if (!noteId) {
        return { error: "Missing noteId for get_note_content." };
      }
      try {
        const note = await getNoteContentForUser(noteId, userId);
        if (!note) {
          return { error: `Note "${noteId}" not found or unauthorized.` };
        }
        return note;
      } catch (err) {
        return { error: `Failed to fetch note: ${err.message}` };
      }
    }
    if (toolName === "save_memory") {
      if (!userId) {
        return { error: "Missing userId for save_memory." };
      }
      if (!args?.content || typeof args.content !== "string" || !args.content.trim()) {
        return { error: "Missing content for save_memory." };
      }

      try {
        const result = await saveMemoryWithStatus(userId, {
          category: args.category,
          content: args.content.trim(),
        });

        if (!result?.memory) {
          return { error: "Failed to save memory." };
        }

        // Never return the stored document directly: a deduplicated hit carries
        // the 768-float embedding from the aggregate, which must not reach the model.
        return {
          saved: true,
          created: result.created,
          category: result.memory.category,
          content: result.memory.content,
        };
      } catch (err) {
        return { error: `Failed to save memory: ${err.message}` };
      }
    }

    if (toolName === "recall_memory") {
      if (!args?.query) {
        return { error: "Missing query for recall_memory." };
      }
      try {
        const memories = await searchMemories(userId, args.query);
        if (!memories || memories.length === 0) {
          return { message: `No specific memories found matching "${args.query}".` };
        }
        return {
          memories: memories.map((m) => ({
            category: m.category,
            content: m.content,
          })),
        };
      } catch (err) {
        return { error: `Failed to fetch memories: ${err.message}` };
      }
    }

    if (toolName === "search_notes") {
      if(!args?.query || !args.query.trim()) {
        return { error: "Missing search query." };
      }

      try {
        const rawNotes = await searchNote(userId, args.query.trim());
        if(!rawNotes || rawNotes.length === 0) {
          return { count: 0, message: `No notes found matching "${args.query}".` };
        }

        const notes = rawNotes.slice(0, 5).map((note) => {
          const plainText = stripHtml(note.content || "");
          const snippet = plainText.length > 200 ? `${plainText.slice(0, 200)}...` : plainText;

          return {
            noteId: note._id.toString(),
            title: note.title || "Untitled",
            snippet,
            updatedAt: note.updatedAt,
          };
        });

        return { count: notes.length, notes };
      } catch (error) {
        return { error: `Failed to search notes: ${error.message}` };
      }
    }

    return { error: `Unknown server tool: ${toolName}` };
  }
}

export const toolExecutor = new ToolExecutor();
