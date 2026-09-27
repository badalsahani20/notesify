import type { ChatArtifact, ChatMessage, PendingInteraction } from "@/store/useGlobalChatStore";
import type { InteractiveQuestion, ToolCallRecord } from "@/components/ai/types";
import { executeClientTool } from "@/services/ai/clientToolExecutor";
import type { ToolCallEvent } from "@/utils/consumeAiChatStream";

type UpdateAssistantMessage = (updater: (message: ChatMessage) => ChatMessage) => void;

type ChatToolHandlerOptions = {
  accessToken: string | null;
  apiBaseUrl: string;
  effectiveSessionId: string | null;
  getTargetSessionId: () => string | null;
  setPendingInteraction: (interaction: PendingInteraction) => void;
  setActiveArtifact: (artifact: ChatArtifact) => void;
  updateAssistantMessage: UpdateAssistantMessage;
};

const buildToolCallRecord = (event: ToolCallEvent): ToolCallRecord => ({
  id: event.id,
  args: event.args,
  execution: event.execution,
  purpose: event.purpose,
  tool: event.tool,
  status: event.status ?? "pending",
  data: event.data,
  error: event.error,
  quizData: event.quizData,
  questions: event.questions ?? event.quizData,
  title: event.title,
  query: event.query,
  url: event.url,
  citations: event.citations,
});

const updateExistingToolCall = (existing: ToolCallRecord[], event: ToolCallEvent): ToolCallRecord[] | null => {
  const existingIndex = event.id
    ? existing.findIndex((toolCall) => toolCall.id === event.id)
    : existing.findIndex(
        (toolCall) =>
          toolCall.tool === event.tool &&
          toolCall.status !== "success" &&
          toolCall.status !== "error",
      );
  const correlatedIndex = existingIndex === -1 && event.id
    ? existing.findIndex(
        (toolCall) =>
          !toolCall.id &&
          toolCall.tool === event.tool &&
          toolCall.status !== "success" &&
          toolCall.status !== "error",
      )
    : existingIndex;

  if (correlatedIndex === -1) return null;

  const updated = [...existing];
  updated[correlatedIndex] = {
    ...updated[correlatedIndex],
    id: event.id ?? updated[correlatedIndex].id,
    args: event.args ?? updated[correlatedIndex].args,
    query: event.query ?? updated[correlatedIndex].query,
    url: event.url ?? updated[correlatedIndex].url,
    execution: event.execution ?? updated[correlatedIndex].execution,
    purpose: event.purpose ?? updated[correlatedIndex].purpose,
    status: event.status ?? updated[correlatedIndex].status,
    data: event.data ?? updated[correlatedIndex].data,
    error: event.error ?? updated[correlatedIndex].error,
  };
  return updated;
};

export const createChatToolHandler = ({
  accessToken,
  apiBaseUrl,
  effectiveSessionId,
  getTargetSessionId,
  setPendingInteraction,
  setActiveArtifact,
  updateAssistantMessage,
}: ChatToolHandlerOptions) => (event: ToolCallEvent): void => {
  const {
    id,
    interactionId,
    checkpointId,
    args,
    execution,
    purpose,
    tool,
    quizData,
    questions,
    title,
    citations,
  } = event;

  if (tool === "ask_question" && interactionId && checkpointId) {
    const questionList = (questions ?? quizData) as InteractiveQuestion[] | undefined;
    const firstQuestion = questionList?.[0];
    console.info("[IrisInteraction] pending question received", {
      interactionId,
      checkpointId,
      questionCount: questionList?.length ?? 0,
      sessionId: getTargetSessionId() || effectiveSessionId,
    });
    setPendingInteraction({
      interactionId,
      checkpointId,
      type: "ask_question",
      purpose,
      title,
      question: firstQuestion?.question ?? "",
      options: firstQuestion?.options ?? [],
      questions: questionList,
      status: "pending",
    });
  }

  if (execution === "local" && args) {
    void executeClientTool(tool, args).then((result) => {
      const targetSessionId = getTargetSessionId() || effectiveSessionId;
      if (targetSessionId) {
        void fetch(`${apiBaseUrl}/ai/chat/tool-result`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            sessionId: targetSessionId,
            toolCallId: id,
            tool,
            status: result.success ? "success" : "error",
            data: result.data ? { _id: result.data._id, title: result.data.title } : undefined,
            error: result.error,
          }),
        }).catch(() => {});
      }

      if (result.data && (tool === "create_note" || tool === "update_note")) {
        setActiveArtifact({
          type: "note",
          id: result.data._id,
          title: result.data.title,
          content: result.data.content,
        });
      }

      updateAssistantMessage((message) => {
        const existing = message.toolCalls ?? [];
        const index = existing.findIndex((toolCall) => (id ? toolCall.id === id : toolCall.tool === tool));
        if (index === -1) return message;

        const updated = [...existing];
        updated[index] = {
          ...updated[index],
          data: result.data ?? updated[index].data,
          status: result.success ? "success" : "error",
          error: result.error ?? updated[index].error,
        };
        return { ...message, toolCalls: updated };
      });
    });
  }

  updateAssistantMessage((message) => {
    const existing = message.toolCalls ?? [];
    if (tool === "web_citations" && citations) {
      return {
        ...message,
        toolCalls: [
          ...existing.filter((toolCall) => toolCall.tool !== "web_citations"),
          { tool, citations },
        ],
      };
    }

    const updated = updateExistingToolCall(existing, event);
    return {
      ...message,
      toolCalls: updated ?? [...existing, buildToolCallRecord(event)],
    };
  });
};
