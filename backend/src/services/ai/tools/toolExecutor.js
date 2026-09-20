import { getNoteContentForUser } from "../../notes.service.js";

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
    return { error: `Unknown server tool: ${toolName}` };
  }
}

export const toolExecutor = new ToolExecutor();
