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

/**
 * Returns available tools for the current chat mode.
 * @param {string} chatMode - "casual" | "study"
 * @returns {Array<object>}
 */
export const getChatTools = (chatMode = "casual") => {
  return [
    saveMemoryTool,
    ...(chatMode === "study" ? [quizTool] : []),
  ];
};
