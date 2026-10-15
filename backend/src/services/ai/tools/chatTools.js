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
    description:
      "Present an interactive question, quiz, topic selection, or preference dialog directly in the Notesify chat UI. ALWAYS call this tool when: (1) Suggesting options, topics, or learning paths (e.g. user says 'teach me something', 'help me learn', 'what should I study?'); (2) Clarifying ambiguous or broad requests with structured selectable choices; (3) Testing the user's knowledge with a quick quiz; (4) Letting the user prioritize or pick their next direction. Do not just list options in raw text when you can give them clickable options through this tool.",
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["quiz", "clarification", "preference", "ranking"],
          description:
            "Purpose of the question set: 'preference' or 'clarification' for topic suggestions and choosing options; 'quiz' for testing knowledge; 'ranking' for prioritizing.",
        },
        title: {
          type: "string",
          description: "Short label for this question set (2-4 words, e.g. 'Choose a Topic', 'Select Track', 'Quick Quiz').",
        },
        questions: {
          type: "array",
          description: "List of questions or choices to present to the user.",
          minItems: 1,
          maxItems: 15,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for this question (e.g. 'q1', 'topic_choice').",
              },
              question: {
                type: "string",
                description: "The prompt or question shown above the options (e.g. 'What would you like to explore today?').",
              },
              type: {
                type: "string",
                enum: ["single_select", "multi_select", "rank_priority"],
                description: "Interaction type (single_select for one choice, multi_select for multiple, rank_priority for ordering).",
              },
              allowOther: {
                type: "boolean",
                description: "Whether the user may write in a custom option.",
                default: true,
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "List of 2 to 5 curated selectable options for the user.",
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
      "Create a new note in Notesify with title and Markdown content when explicitly requested.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the note.",
        },
        content: {
          type: "string",
          description: "The body content in rich Markdown.",
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
      "Retrieve the complete current content of an active note by noteId.",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The unique ID of the active note to retrieve.",
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
      "Update an existing note in Notesify. Use mode='append' to add new material, or mode='replace' to overwrite when requested.",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The unique ID of the existing note to update.",
        },
        title: {
          type: "string",
          description: "New title for the note (if renaming).",
        },
        content: {
          type: "string",
          description: "Content to append, or full replacement content.",
        },
        mode: {
          type: "string",
          enum: ["append", "replace"],
          description: "Default 'append' adds to end; 'replace' overwrites.",
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

  const baseTools = isNoteScoped
    ? [
        saveMemoryTool,
        getNoteContentTool,
        updateNoteTool,
        askQuestionTool,
      ]
    : [
        saveMemoryTool,
        getNoteContentTool,
        createNoteTool,
        updateNoteTool,
        askQuestionTool,
      ];

  if (chatMode === "study") {
    return [
      ...baseTools,
    ];
  }

  return baseTools;
};
