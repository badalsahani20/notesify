/**
 * Shared types used across the AI panel components.
 * Keeping them in one place means if a type ever changes,
 * we update it here and all components stay in sync.
 */

export type AiAction = "grammar" | "summarize" | "explain" | "rewrite" | "continue" | "noteCreation";

export const actionMeta: Record<Exclude<AiAction, "noteCreation">, { label: string; prompt: string }> = {
  grammar: { label: "Improve", prompt: "Clean up grammar, punctuation, and small wording issues in this note." },
  summarize: { label: "Summarize", prompt: "Summarize the key ideas from this note into a concise explanation." },
  explain: { label: "Explain", prompt: "Explain this note in simpler language with clear takeaways." },
  rewrite: { label: "Rewrite", prompt: "Rewrite this note for clarity and better flow while keeping meaning intact." },
  continue: { label: "Continue Writing", prompt: "Continue the content in a consistent tone and style." },
};

export type AssistResult = {
  action: AiAction;
  suggestion: string;
  errors: Array<{ start: number; end: number; original: string; suggestion: string | null }>;
  sourceType: "selection" | "note";
  isStreaming?: boolean;
};

export type SelectionRange = { from: number; to: number } | null;

export interface VizSegment {
  id?: string;
  kind: "viz";
  type: "mermaid" | "chart" | "math";
  title: string;
  data: string;
  isStreaming?: boolean;
}

export interface textSegment {
  id?: string;
  kind: "text";
  content: string;
}

export interface AskSegment {
  id?: string;
  kind: "ask";
  question: string;
  options: string[];  // may be empty — free-text answer is still allowed
}

export type IrisSegment = textSegment | VizSegment | AskSegment;

export interface WebCitation {
  url: string;
  title: string;
  content?: string;
}

export type ToolCallRecord = {
  id?: string;
  tool: string;
  quizData?: any[];
  query?: string;
  url?: string;
  citations?: WebCitation[];
  category?: string;
  content?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  segments?: IrisSegment[];
  skipAnimation?: boolean;
  isThinking?: boolean;
  thinkingTime?: number;
  thought?: string;
  toolCalls?: ToolCallRecord[];
};

export type ChatHistoryMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
