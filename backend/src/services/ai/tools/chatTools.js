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
      "Present an interactive question, quiz, or ranking dialog to the user when testing knowledge or collecting structured choices/priorities.",
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["quiz", "clarification", "preference", "ranking"],
          description: "Purpose of the question set.",
        },
        title: {
          type: "string",
          description: "Short label for this question set (2-4 words).",
        },
        questions: {
          type: "array",
          description: "List of questions to ask the user.",
          minItems: 1,
          maxItems: 15,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for this question (e.g. 'q1').",
              },
              question: {
                type: "string",
                description: "The question or instruction prompt.",
              },
              type: {
                type: "string",
                enum: ["single_select", "multi_select", "rank_priority"],
                description: "Interaction type (single_select, multi_select, or rank_priority).",
              },
              allowOther: {
                type: "boolean",
                description: "Whether the user may write in a custom option.",
                default: true,
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "List of 2 to 5 selectable options.",
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

export const createWorkflowTool = {
  type: "function",
  function: {
    name: "create_workflow",
    description:
      "Create a structured multi-phase learning workflow when the user explicitly requests a guided learning roadmap or study program.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title for the learning workflow.",
        },
        phases: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          description: "Ordered learning phases.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Stable phase identifier, e.g. 'phase-1'.",
              },
              title: {
                type: "string",
                description: "Short phase title.",
              },
              tasks: {
                type: "array",
                minItems: 1,
                maxItems: 20,
                description: "Concrete learning tasks in this phase.",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Stable task identifier, e.g. 'task-1'.",
                    },
                    title: {
                      type: "string",
                      description: "Short task title.",
                    },
                    concept: {
                      type: "string",
                      description: "Specific concept or learning objective.",
                    },
                    order: {
                      type: "integer",
                      minimum: 1,
                      description: "Task order within the phase.",
                    },
                  },
                  required: ["id", "title", "concept", "order"],
                  additionalProperties: false,
                },
              },
            },
            required: ["id", "title", "tasks"],
            additionalProperties: false,
          },
        },
        sessionId: {
          type: "string",
          description: "Optional chat session ID to associate with the workflow.",
        },
      },
      required: ["title", "phases"],
      additionalProperties: false,
    },
  },
};

export const listWorkflowsTool = {
  type: "function",
  function: {
    name: "list_workflows",
    description:
      "List the user's existing learning workflows to inspect, resume, or continue them.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "ACTIVE", "PAUSED", "FAILED", "COMPLETED"],
          description: "Optional workflow status filter.",
        },
      },
      additionalProperties: false,
    },
  },
};

export const getWorkflowTool = {
  type: "function",
  function: {
    name: "get_workflow",
    description:
      "Retrieve the complete current state of a specific learning workflow by workflowId.",
    parameters: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow's stable ID.",
        },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
};

export const transitionWorkflowTool = {
  type: "function",
  function: {
    name: "transition_workflow",
    description:
      "Apply a deterministic command to advance, pause, resume, or evaluate a learning workflow using expectedVersion from latest state.",
    parameters: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow's stable ID.",
        },
        command: {
          type: "string",
          enum: [
            "START_WORKFLOW",
            "PAUSE_WORKFLOW",
            "RESUME_WORKFLOW",
            "RETRY_WORKFLOW",
            "ACTIVATE_TASK",
            "PRESENT_CHECKPOINT",
            "SUBMIT_ANSWER",
            "EVALUATE_CHECKPOINT",
            "ABANDON_TASK",
          ],
          description: "The workflow command to execute.",
        },
        payload: {
          type: "object",
          description: "Command parameters (e.g. taskId, checkpointId, answer).",
          additionalProperties: true,
        },
        expectedVersion: {
          type: "integer",
          minimum: 0,
          description: "Current workflow version known from latest state.",
        },
      },
      required: ["workflowId", "command", "expectedVersion"],
      additionalProperties: false,
    },
  },
};

export const deleteWorkflowTool = {
  type: "function",
  function: {
    name: "delete_workflow",
    description:
      "Permanently delete a learning workflow when the user explicitly asks to remove it.",
    parameters: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow's stable ID.",
        },
      },
      required: ["workflowId"],
      additionalProperties: false,
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

export const createLearningTasksTool = {
  type: "function",
  function: {
    name: "create_learning_tasks",
    description:
      "Assign 1–3 concrete practice questions or tasks in the user's queue when they request practice, exercises, or after completing a major topic.",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "List of 1–3 focused learning tasks or practice questions to assign.",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Concise actionable title or question.",
              },
              description: {
                type: "string",
                description: "Optional details, test cases, or hints.",
              },
              type: {
                type: "string",
                enum: [
                  "practice_question",
                  "concept_review",
                  "coding_task",
                  "quiz",
                  "todo",
                ],
                default: "practice_question",
              },
              difficulty: {
                type: "string",
                enum: ["easy", "medium", "hard"],
                default: "medium",
              },
              topic: {
                type: "string",
                description: "Topic tag (e.g. 'React', 'DSA').",
              },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
  },
};

export const updateTaskStatusTool = {
  type: "function",
  function: {
    name: "update_task_status",
    description:
      "Update the status of a learning task in the user's queue (e.g. 'completed', 'in_progress', 'skipped') when the user confirms completion.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The taskId, task number, or title.",
        },
        status: {
          type: "string",
          enum: ["in_progress", "completed", "pending", "skipped"],
          description: "The updated status.",
        },
      },
      required: ["taskId", "status"],
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
        createLearningTasksTool,
        updateTaskStatusTool,
      ]
    : [
        saveMemoryTool,
        getNoteContentTool,
        createNoteTool,
        updateNoteTool,
        askQuestionTool,
        createLearningTasksTool,
        updateTaskStatusTool,
      ];

  if (chatMode === "study") {
    return [
      ...baseTools,
      createWorkflowTool,
      listWorkflowsTool,
      getWorkflowTool,
      transitionWorkflowTool,
      deleteWorkflowTool,
    ];
  }

  return baseTools;
};
