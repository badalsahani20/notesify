import type { ChatArtifact, ChatMessage } from "@/store/useGlobalChatStore";
import { queryClient } from "@/lib/queryClient";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useNoteStore } from "@/store/useNoteStore";

export type CurrentNoteContext = {
  id: string;
  title?: string;
};

export type ClientToolResult = {
  toolCallId?: string;
  tool: string;
  status: string;
  data?: { _id: string; title: string };
  error?: string;
};

export type GlobalChatRequest = {
  response: Response;
  accessToken: string | null;
  apiBaseUrl: string;
  currentNoteContext?: CurrentNoteContext;
};

export const resolveCurrentNoteContext = async (
  activeArtifact: ChatArtifact | null,
): Promise<CurrentNoteContext | undefined> => {
  if (activeArtifact?.id) {
    return { id: activeArtifact.id, title: activeArtifact.title };
  }

  // The active workspace note is a fallback when the chat has no selected artifact.
  try {
    const { activeNoteId } = useNoteStore.getState();
    if (!activeNoteId) return undefined;

    const note = queryClient.getQueryData<{ _id: string; title: string }>(["note", activeNoteId]);
    return note ? { id: note._id, title: note.title } : undefined;
  } catch {
    return undefined;
  }
};

export const collectClientToolResults = (messages: ChatMessage[]): ClientToolResult[] => {
  const previousAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.toolCalls?.length);

  return (previousAssistantMessage?.toolCalls ?? [])
    .filter((toolCall) => Boolean(toolCall.status))
    .map((toolCall) => ({
      toolCallId: toolCall.id,
      tool: toolCall.tool,
      status: toolCall.status as string,
      data: toolCall.data
        ? { _id: toolCall.data._id, title: toolCall.data.title }
        : undefined,
      error: toolCall.error,
    }));
};

export const startGlobalChatRequest = async ({
  text,
  sessionId,
  imageForApi,
  chatAttachmentId,
  activeArtifact,
  messages,
  useReasoning,
  enableWeb,
  chatMode,
  signal,
}: {
  text: string;
  sessionId: string | null;
  imageForApi?: string;
  chatAttachmentId?: string;
  activeArtifact: ChatArtifact | null;
  messages: ChatMessage[];
  useReasoning: boolean;
  enableWeb: boolean;
  chatMode: "study" | "casual";
  signal: AbortSignal;
}): Promise<GlobalChatRequest> => {
  const { accessToken } = useAuthStore.getState();
  const currentNoteContext = await resolveCurrentNoteContext(activeArtifact);
  const clientToolResults = collectClientToolResults(messages);

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: text,
      sessionId,
      imageBase64: imageForApi || undefined,
      chatAttachmentId: chatAttachmentId || undefined,
      stream: true,
      useReasoning,
      enableWeb,
      chatMode,
      currentNote: currentNoteContext,
      clientToolResults,
    }),
    signal,
  });

  if (!response.ok) throw new Error("Failed to connect to AI");
  if (!response.body) throw new Error("No response body");

  return {
    response,
    accessToken,
    apiBaseUrl: API_BASE_URL,
    currentNoteContext,
  };
};
