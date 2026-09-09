import { requestSessionRefresh } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { ChatHistoryMessage } from "@/components/ai/types";
import type { StructuredNoteContext } from "@/utils/ai/noteContextBuilder";

interface ChatStreamPayload {
  message: string;
  history: ChatHistoryMessage[];
  noteId: string | null;
  structuredContext?: StructuredNoteContext | null;
  hasSelection: boolean;
  contextChanged: boolean;
  imageBase64: string | null;
  pdfContext: string | null;
  useReasoning: boolean;
  enableWeb: boolean;
  chatMode: "study" | "casual";
  signal?: AbortSignal;
}

export const postAiChatStream = async (payload: ChatStreamPayload): Promise<Response> => {
  const { accessToken } = useAuthStore.getState();
  const { signal, pdfContext, ...restPayload } = payload;

  const fetchBody = JSON.stringify({
    ...restPayload,
    pdfContext: pdfContext,
    stream: true,
  });

  let response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: fetchBody,
    signal,
  });

  if (response.status === 401) {
    const newToken = await requestSessionRefresh();
    response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      body: fetchBody,
      signal,
    });
  }

  return response;
};
