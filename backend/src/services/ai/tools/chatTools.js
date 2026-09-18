/**
 * Chat Tool Definitions
 * Defines schema for autonomous tools available to the LLM during chat sessions.
 */

export const saveMemoryTool = {
  type: "function",
  function: {
    name: "save_memory",
    description:
      "Save an important personal fact, preference, goal, or detail explicitly shared by the user about themselves into long-term memory.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["PROFILE", "PREFERENCE", "GOAL", "PROJECT", "SKILL", "OTHER"],
          description: "Category of the memory",
        },
        content: {
          type: "string",
          description: "The concise factual detail to remember about the user",
        },
      },
      required: ["category", "content"],
    },
  },
};

export const quizTool = {
  type: "function",
  function: {
    name: "generate_quiz",
    description: `Generate a multiple-choice quiz based on the user's request and context.
CRITICAL: Before calling this tool, you MUST generate a conversational message (e.g. 'Here is a quick quiz to test your knowledge:'). After calling the tool, DO NOT output any more text. DO NOT include the correct answer or explanation in the tool call.

MCQ GENERATION RULES:
- Ask exactly one concept per question.
- Question: 20-60 words (hard limit: 75).
- Options: exactly 4.
- Option length: 2-10 words (hard limit: 12).
- Distractors should be plausible but clearly incorrect.
- Prefer direct or scenario-based questions.
- Avoid unnecessary context and filler.
- The entire card should be readable in under 15 seconds.`,
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "A unique identifier for this question (e.g. q1)",
              },
              question: { type: "string", description: "The quiz question" },
              options: {
                type: "array",
                items: { type: "string" },
                description: "4 possible answers",
              },
            },
            required: ["id", "question", "options"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

export const createNoteTool = {
  type: "function",
  function: {
    name: "create_note",
    description:
      "Create a new note in Notesify. Call this when the user wants a new note created and is not asking to modify an existing note (e.g. 'Create a note about Docker', 'Turn this explanation into a note').",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the note",
        },
        content: {
          type: "string",
          description: "The body content in rich Markdown (headings, bullet lists, code blocks).",
        },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
  },
};

export const getNoteContentTool = {
  type: "function",
  function: {
    name: "get_note_content",
    description:
      "Retrieve the complete current title, version, and content of the active note when the local editor context or selection is not sufficient. Pass the noteId from [ACTIVE NOTE].",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The unique ID of the active note to retrieve (from [ACTIVE NOTE]). Required.",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
};

export const updateNoteTool = {
  type: "function",
  function: {
    name: "update_note",
    description:
      "Modify an existing note in Notesify. Use mode='append' to add new material. Use mode='replace' only when the user explicitly requests a complete rewrite or overwrite.",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The unique ID of the existing note to update (e.g. from [ACTIVE NOTE]). Required.",
        },
        title: {
          type: "string",
          description: "New title for the note (if renaming)",
        },
        content: {
          type: "string",
          description:
            "mode='append': provide ONLY the new section(s) to add at the end. mode='replace': provide the complete replacement content.",
        },
        mode: {
          type: "string",
          enum: ["append", "replace"],
          description:
            "Default 'append' adds content to the end without modifying existing text. Use 'replace' only when user explicitly asks to replace or rewrite the whole note.",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
};

/**
 * Returns available tools for the current chat mode.
 * @param {string} chatMode - "casual" | "study"
 * @param {object} [options]
 * @param {boolean} [options.isNoteScoped=false] - If true (note editor drawer), only get_note_content and update_note are available (no create_note).
 * @returns {Array<object>}
 */
export const getChatTools = (chatMode = "casual", options = {}) => {
  const { isNoteScoped = false } = options;

  if (isNoteScoped) {
    return [
      saveMemoryTool,
      getNoteContentTool,
      updateNoteTool,
      ...(chatMode === "study" ? [quizTool] : []),
    ];
  }

  return [
    saveMemoryTool,
    getNoteContentTool,
    createNoteTool,
    updateNoteTool,
    ...(chatMode === "study" ? [quizTool] : []),
  ];
};
