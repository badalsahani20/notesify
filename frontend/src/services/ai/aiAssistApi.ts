import api, { requestSessionRefresh } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { AiAction } from "@/components/ai/types";

interface AssistStreamOptions {
  noteId: string | null;
  action: AiAction;
  selectedText?: string;
  noteText: string;
  signal?: AbortSignal;
}

export const postAiAssistStream = async ({
  noteId,
  action,
  selectedText,
  noteText,
  signal,
}: AssistStreamOptions): Promise<Response> => {
  const { accessToken } = useAuthStore.getState();
  const fetchBody = JSON.stringify({
    noteId,
    action,
    selectedText,
    noteText,
    stream: true,
  });

  let response = await fetch(`${import.meta.env.VITE_API_URL}/ai/assist`, {
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
    response = await fetch(`${import.meta.env.VITE_API_URL}/ai/assist`, {
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

export const postAiAssistBlocking = async ({
  noteId,
  action,
  selectedText,
  noteText,
  signal,
}: Omit<AssistStreamOptions, "stream">) => {
  const res = await api.post(
    "/ai/assist",
    { noteId, action, selectedText: selectedText || undefined, noteText },
    { signal }
  );
  return res.data;
};
