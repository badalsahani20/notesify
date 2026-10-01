import { API_BASE_URL, requestSessionRefresh } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { ChatAttachmentBundle } from "@/components/ai/types";

export const uploadChatAttachment = async (
  files: File[],
  signal?: AbortSignal,
): Promise<ChatAttachmentBundle> => {
  if (files.length === 0) throw new Error("Select at least one PDF");

  const formData = new FormData();
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    formData.append("files", file, relativePath || file.name);
  }

  const folderName = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath
    ?.split(/[\\/]/)[0];
  if (folderName) formData.append("folderName", folderName);

  const send = (token: string | null) =>
    fetch(`${API_BASE_URL}/ai/chat/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
      signal,
    });

  let response = await send(useAuthStore.getState().accessToken);
  if (response.status === 401) {
    response = await send(await requestSessionRefresh());
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Unable to upload the PDF folder");
  }

  return payload.data.bundle as ChatAttachmentBundle;
};
