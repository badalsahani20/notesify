import { getNoteContentForUser, searchNote, findNotesById, removeNote, createNewNote } from "../../notes.service.js";
import { saveMemoryWithStatus, searchMemories } from "../../memoryService.js";
import { stripHtml } from "../../../utils/stripHtml.js";
import { sanitizeNoteHtml } from "../../../utils/sanitizeNoteHtml.js";
import { ensureBlockHtml } from "../../../utils/noteContentHtml.js";
import { redis } from "../../../../config/redis.js";
import { searchWeb } from "../search/searchAdapter.js";
import { fetchPage } from "../search/webFetch.js";

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
    if (toolName === "create_note") {
      const title = typeof args?.title === "string" ? args.title.trim() : "";
      const rawContent = typeof args?.content === "string" ? args.content : "";
      if (!rawContent.trim()) {
        return { error: "Missing content for create_note." };
      }

      try {
        // Same content pipeline as the HTTP create route: markdown in from the
        // model, TipTap-compatible sanitized HTML in the database.
        const content = sanitizeNoteHtml(ensureBlockHtml(rawContent));
        const note = await createNewNote(userId, {
          title: title || "Untitled Note",
          content,
          version: 1,
        });

        // Invalidate list caches so the next pull returns the new note.
        await Promise.all([
          redis.del(`notes:${userId}`),
          redis.del(`notes:archive:${userId}`),
        ]).catch(() => {});

        // `note` carries the full document for the client to reconcile into its
        // local Dexie store; the model-visible tool response is slimmed to the
        // id/title (irisAgent strips `note`) so the conversation doesn't pay
        // tokens for content the model itself just generated.
        return {
          created: true,
          noteId: String(note._id),
          title: note.title || "Untitled Note",
          version: note.version,
          updatedAt: note.updatedAt,
          note: {
            _id: String(note._id),
            title: note.title || "Untitled Note",
            content: note.content || "",
            folder: note.folder ? String(note.folder) : null,
            color: note.color || "#ffffff",
            pinned: Boolean(note.pinned),
            isArchived: Boolean(note.isArchived),
            isDeleted: false,
            version: note.version,
            updatedAt: note.updatedAt,
            lastAccessedAt: note.lastAccessedAt || null,
          },
        };
      } catch (err) {
        return { error: `Failed to create note: ${err.message}` };
      }
    }

    if (toolName === "delete_note") {
      const noteId = args?.noteId || fallbackNoteId;
      if (!noteId) {
        return { error: "Missing noteId for delete_note." };
      }
      try {
        const existing = await findNotesById(noteId, userId);
        if (!existing) {
          return { error: `Note "${noteId}" not found or unauthorized.` };
        }
        const result = await removeNote(noteId, userId, existing.version);
        if (!result || result.conflict) {
          return { error: "Failed to delete note due to version conflict or deletion failure." };
        }

        // Invalidate list caches so notes lists refresh properly
        await Promise.all([
          redis.del(`notes:${userId}`),
          redis.del(`notes:archive:${userId}`),
        ]).catch(() => {});

        return {
          deleted: true,
          noteId,
          title: existing.title || "Untitled",
          message: `Note "${existing.title || "Untitled"}" moved to trash.`,
        };
      } catch (err) {
        return { error: `Failed to delete note: ${err.message}` };
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

    if (toolName === "search_web") {
      const query = typeof args?.query === "string" ? args.query.trim() : "";
      if (!query) {
        return { error: "Missing query for search_web." };
      }

      try {
        const results = await searchWeb(query);
        if (results.length === 0) {
          return {
            query,
            count: 0,
            message: `No web results were available for "${query}".`,
          };
        }

        return {
          query,
          count: results.length,
          results,
          // Kept for history sanitization and citation rendering.
          citations: results.map(({ title, url }) => ({ title, url })),
        };
      } catch (error) {
        return { error: `Web search failed: ${error.message}` };
      }
    }

    if (toolName === "crawl_url") {
      const url = typeof args?.url === "string" ? args.url.trim() : "";
      if (!url) {
        return { error: "Missing url for crawl_url." };
      }

      try {
        return await fetchPage(url);
      } catch (error) {
        return { error: `Web fetch failed: ${error.message}` };
      }
    }

    return { error: `Unknown server tool: ${toolName}` };
  }
}

export const toolExecutor = new ToolExecutor();
