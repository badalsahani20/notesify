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

export const askQuestionTool = {
  type: "function",
  function: {
    name: "ask_question",
    description: `Present one or more questions to the user as an interactive dialog.
Use this tool whenever you want to:
- Quiz the user or test their knowledge
- Clarify ambiguous requirements or ask the user for direction
- Collect user preferences, choices, or design decisions
- Ask the user to rank or prioritize alternatives

Supported question types:
- "single_select": the user picks exactly one option.
- "multi_select": the user picks one or more options.
- "rank_priority": the user orders the options from highest to lowest priority.

CRITICAL: Before calling this tool, write a brief conversational message introducing the questions. Do not repeat the questions as markdown text after calling the tool. For quizzes, do not include the correct answer or an explanation in the tool call.`,
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["quiz", "clarification", "preference", "ranking"],
          description: "Use 'quiz' only to test knowledge. Use 'clarification', 'preference', or 'ranking' for non-quiz questions.",
        },
        title: {
          type: "string",
          description: "Short label for this set of questions, 2-4 words",
        },
        questions: {
          type: "array",
          description: "The list of questions to ask the user.",
          minItems: 1,
          maxItems: 15,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for this question (e.g. 'q1')",
              },
              question: {
                type: "string",
                description: "The question or instruction prompt. Keep it to one or two sentences.",
              },
              type: {
                type: "string",
                enum: ["single_select", "multi_select", "rank_priority"],
                description:
                  "Question type: 'single_select' (pick one), 'multi_select' (pick one or more), or 'rank_priority' (order by priority). For rank_priority, options must be the items to rank. Never include 'all', 'none', or 'other' options.",
              },
              options: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of options (typically 2 to 5). Keep each option under 5 words. No parenthetical explanations.",
              },
            },
            required: ["id", "question", "options"],
          },
        },
      },
      required: ["purpose", "questions"],
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
      askQuestionTool,
    ];
  }

  return [
    saveMemoryTool,
    getNoteContentTool,
    createNoteTool,
    updateNoteTool,
    askQuestionTool,
  ];
};
