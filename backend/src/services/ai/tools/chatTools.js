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

Match each question's type to the overall purpose: purpose="ranking" means every question uses rank_priority. purpose="quiz", "clarification", or "preference" means every question uses single_select or multi_select, never rank_priority.

CRITICAL: Respond to the user normally first, engaging with what they actually said. Then call this tool to ask your questions — do not repeat them as markdown text after calling it.

Use this tool only when the user explicitly requests a quiz, survey, ranking, or multiple-choice interaction, or when several structured choices are genuinely better than a normal conversational question. For one simple clarification, ask naturally in the response instead. Do not use it for greetings or ordinary conversation. For quizzes, do not include the correct answer or an explanation in the tool call.`,
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["quiz", "clarification", "preference", "ranking"],
          description:
            "Use 'quiz' only to test knowledge. Use 'ranking' only when every question is rank_priority. Use 'clarification' or 'preference' for everything else.",
        },
        title: {
          type: "string",
          description:
            "Short label for this set of questions, 2-4 words.",
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
                  "Must match the call's purpose: rank_priority only when purpose='ranking'; single_select or multi_select for quiz, clarification, and preference.",
              },
              allowOther: {
                type: "boolean",
                description: "Whether the user may provide an option outside the listed choices.",
                default: true,
              },
              options: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of options (typically 2 to 5). Keep each option under 5 words. No parenthetical explanations. For rank_priority, list only the items being ranked — never add an 'all', 'none', or 'other' option.",
              },
            },
            required: ["id", "question", "type", "options"],
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
