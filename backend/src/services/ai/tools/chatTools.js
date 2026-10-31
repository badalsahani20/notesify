import { isLocalSearchConfigured } from "../search/searchAdapter.js";
import { isNativeFetchEnabled } from "../search/webFetch.js";

export const saveMemoryTool = {
  type: "function",
  function: {
    name: "save_memory",
    description:
      "Save lasting user facts, preferences, goals, or projects. Never invent details. The result reports whether the memory was newly created or already known.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["PROFILE", "PREFERENCE", "GOAL", "PROJECT", "SKILL", "OTHER"],
        },
        content: {
          type: "string",
          description: "Concise fact about the user.",
        },
      },
      required: ["category", "content"],
    },
  },
};

export const recallMemoryTool = {
  type: "function",
  function: {
    name: "recall_memory",
    description:
      "Retrieve relevant long-term user memories when personal context would improve the answer.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Memory search query.",
        },
      },
      required: ["query"],
    },
  },
};

export const askQuestionTool = {
  type: "function",
  function: {
    name: "ask_question",
    description:
      "Present interactive choices for quizzes, clarification, preferences, or prioritization. Avoid unnecessary questions.",
    parameters: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["quiz", "clarification", "preference", "ranking"],
        },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              type: {
                type: "string",
                enum: ["single_select", "multi_select", "rank_priority"],
              },
              allowOther: {
                type: "boolean",
                default: true,
              },
              options: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 5,
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
      "Create a new Markdown note only when explicitly requested.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: {
          type: "string",
          description: "Markdown note content.",
        },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
  },
};


export const deleteNoteTool = {
  type: "function",
  function: {
    name: "delete_note",
    description:
      "Move a note to trash when explicitly requested by the user. Requires noteId.",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "ID of the note to move to trash.",
        },
        title: {
          type: "string",
          description: "Title of the note being deleted (optional, for confirmation).",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
};

export const getNoteContentTool = {
  type: "function",
  function: {
    name: "get_note_content",
    description:
      "Fetch complete note content when provided editor context is insufficient.",
    parameters: {
      type: "object",
      properties: {
        noteId: { type: "string" },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
};

/*
export const updateNoteTool = {
  type: "function",
  function: {
    name: "update_note",
    description:
      "Edit an existing note. Supply 'blockId' (e.g. 'b_xxx') to surgically replace a specific block from editor context with 100% precision, or use 'targetContent' as fallback. Use mode: 'append' to add to the bottom, or 'full_replace' only with explicit authorization.",
    parameters: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "ID of the note to update." },
        title: {
          type: "string",
          description: "Optional new title.",
        },
        blockId: {
          type: "string",
          description: "Persistent block ID to replace from editor context (e.g. 'b_k7d2m9'). Provides exact block targeting.",
        },
        targetContent: {
          type: "string",
          description: "Content or text snippet to replace if blockId is not known.",
        },
        replacementContent: {
          type: "string",
          description: "New content to replace the target block or content with.",
        },
        content: {
          type: "string",
          description: "Content to append or replace.",
        },
        mode: {
          type: "string",
          enum: ["replace_target", "append", "prepend", "full_replace", "replace"],
          description: "Defaults to 'replace_target' if blockId or targetContent is provided, otherwise 'append'.",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
};
*/

export const searchNotesTool = {
  type: "function",
  function: {
    name: "search_notes",
    description: "Search across the user's notes by keyword or topic. Returns matching note titles, IDs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords or topic to find relevant notes."
        }
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export const searchWebTool = {
  type: "function",
  function: {
    name: "search_web",
    description:
      "Search the live web for current information. Use it when the answer depends on recent events, prices, releases, or facts that are not in the user's notes.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query. Be specific about the topic and time window.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export const crawlUrlTool = {
  type: "function",
  function: {
    name: "crawl_url",
    description:
      "Fetch one public web page and return its readable text. Use it after search_web when a specific result needs to be read in full. Only public http(s) URLs are allowed.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute http(s) URL to read.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
};

export const CHAT_TOOLS = [
  saveMemoryTool,
  recallMemoryTool,
  searchNotesTool,
  getNoteContentTool,
  createNoteTool,
  deleteNoteTool,
  // updateNoteTool, // Temporarily commented out to avoid simultaneous edit conflict issues
  askQuestionTool,
];

/**
 * Web tools are added by capability, not by model:
 *   - search_web needs a configured search provider
 *   - crawl_url is native and needs no key
 * Otherwise the equivalent work stays delegated to OpenRouter.
 *
 * Keep this list stable across a conversation: the tool array is part of the
 * cached prompt prefix, so adding or removing a tool invalidates the cache.
 */
export const getChatTools = () => {
  const tools = [...CHAT_TOOLS];
  if (isLocalSearchConfigured()) tools.push(searchWebTool);
  if (isNativeFetchEnabled()) tools.push(crawlUrlTool);
  return tools;
};
