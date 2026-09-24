import { useState } from "react";
import type { Message } from "@/components/ai/types";
import { consumeAiChatStream } from "@/utils/consumeAiChatStream";
import { parseIrisResponse } from "@/utils/parseIrisResponse";

interface UseAiChatStreamingOptions {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  messagesRef: React.MutableRefObject<Message[]>;
  setPdfContext: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useAiChatStreaming = ({
  setMessages,
  messagesRef,
  setPdfContext,
}: UseAiChatStreamingOptions) => {
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamedMessageText, setStreamedMessageText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const processStream = async (responseBody: ReadableStream<Uint8Array>, aiMsgId: string) => {
    setStreamingMessageId(aiMsgId);
    setStreamedMessageText("");
    setIsStreaming(true);

    const { fullText, fullThought, thinkingTime: finalThinkingTime } =
      await consumeAiChatStream(responseBody, {
        throttleMs: 40,
        onToolCall: ({ id, tool, args, execution, purpose, status, data, error, quizData, questions, title, query, url, citations }) => {
          if ((execution === "client" || execution === "local") && args) {
            import("@/services/ai/clientToolExecutor").then(({ executeClientTool }) => {
              executeClientTool(tool, args).then((result) => {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== aiMsgId) return m;
                    const existingCalls = m.toolCalls ?? [];
                    const existingIdx = existingCalls.findIndex((tc) => (id ? tc.id === id : tc.tool === tool));
                    if (existingIdx === -1) return m;
                    const updated = [...existingCalls];
                    updated[existingIdx] = {
                      ...updated[existingIdx],
                      data: result.data ?? updated[existingIdx].data,
                      status: result.success ? "success" : "error",
                      error: result.error ?? updated[existingIdx].error,
                    };
                    return { ...m, toolCalls: updated };
                  })
                );
              });
            });
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== aiMsgId) return m;
              const existingCalls = m.toolCalls ?? [];
              if (tool === "web_citations" && citations) {
                const filtered = existingCalls.filter((tc) => tc.tool !== "web_citations");
                return {
                  ...m,
                  toolCalls: [...filtered, { tool, citations }],
                };
              }
              // Match by id if present to allow multiple distinct calls of the same tool (e.g. search_web)
              const existingIdx = id
                ? existingCalls.findIndex((tc) => tc.id === id)
                : existingCalls.findIndex((tc) => tc.tool === tool && tc.status !== "success" && tc.status !== "error");

              // The initial note-fetched marker has no provider ID. Correlate
              // its later identified event with the active row instead of
              // creating a duplicate timeline entry.
              const correlatedIdx = existingIdx === -1 && id
                ? existingCalls.findIndex((tc) => !tc.id && tc.tool === tool && tc.status !== "success" && tc.status !== "error")
                : existingIdx;

              if (correlatedIdx !== -1) {
                const updated = [...existingCalls];
                  updated[correlatedIdx] = {
                    ...updated[correlatedIdx],
                    id: id ?? updated[correlatedIdx].id,
                    query: query ?? updated[correlatedIdx].query,
                    url: url ?? updated[correlatedIdx].url,
                    args: args ?? updated[existingIdx].args,
                    execution: execution ?? updated[correlatedIdx].execution,
                    purpose: purpose ?? updated[correlatedIdx].purpose,
                    status: status ?? updated[correlatedIdx].status,
                    data: data ?? updated[correlatedIdx].data,
                    error: error ?? updated[correlatedIdx].error,
                  };
                return { ...m, toolCalls: updated };
              }
              return {
                ...m,
                toolCalls: [...existingCalls, {
                  id,
                  tool,
                  args,
                  execution,
                  purpose,
                  status: status ?? "pending",
                  data,
                  error,
                  quizData,
                  questions: questions ?? quizData,
                  title,
                  query,
                  url,
                  citations,
                }],
              };
            })
          );

          // Keep the persistence ref in sync with the rendered state. The
          // contextual chat persists from messagesRef immediately after the
          // stream completes, before React state effects are guaranteed to run.
          messagesRef.current = messagesRef.current.map((m) => {
            if (m.id !== aiMsgId) return m;
            const existingCalls = m.toolCalls ?? [];
            if (tool === "web_citations" && citations) {
              const filtered = existingCalls.filter((tc) => tc.tool !== "web_citations");
              return { ...m, toolCalls: [...filtered, { tool, citations }] };
            }
            const existingIdx = id
              ? existingCalls.findIndex((tc) => tc.id === id)
              : existingCalls.findIndex((tc) => tc.tool === tool && tc.status !== "success" && tc.status !== "error");
            const correlatedIdx = existingIdx === -1 && id
              ? existingCalls.findIndex((tc) => !tc.id && tc.tool === tool && tc.status !== "success" && tc.status !== "error")
              : existingIdx;
            if (correlatedIdx !== -1) {
              const updated = [...existingCalls];
              updated[correlatedIdx] = {
                ...updated[correlatedIdx],
                id: id ?? updated[correlatedIdx].id,
                args: args ?? updated[correlatedIdx].args,
                query: query ?? updated[correlatedIdx].query,
                url: url ?? updated[correlatedIdx].url,
                execution: execution ?? updated[correlatedIdx].execution,
                purpose: purpose ?? updated[correlatedIdx].purpose,
                status: status ?? updated[correlatedIdx].status,
                data: data ?? updated[correlatedIdx].data,
                error: error ?? updated[correlatedIdx].error,
              };
              return { ...m, toolCalls: updated };
            }
            return {
              ...m,
              toolCalls: [...existingCalls, {
                id, tool, args, execution, purpose,
                status: status ?? "pending",
                data, error, quizData,
                questions: questions ?? quizData,
                title, query, url, citations,
              }],
            };
          });
        },
        onMetadata: ({ pdfContext }) => {
          if (pdfContext) setPdfContext(pdfContext);
        },
        onUpdate: ({ fullText, fullThought, isThinking, thinkingTime }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, isThinking, thought: fullThought, thinkingTime }
                : m
            )
          );
          setStreamedMessageText(fullText);
        },
      });

    const segments = parseIrisResponse(fullText);

    setStreamingMessageId(null);
    setStreamedMessageText("");
    setIsStreaming(false);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === aiMsgId
          ? {
              ...m,
              text: fullText,
              thought: fullThought,
              segments,
              isThinking: false,
              thinkingTime: finalThinkingTime,
            }
          : m
      )
    );
    messagesRef.current = messagesRef.current.map((m) =>
      m.id === aiMsgId
        ? {
            ...m,
            text: fullText,
            thought: fullThought,
            segments,
            isThinking: false,
            thinkingTime: finalThinkingTime,
          }
        : m
    );

    return fullText;
  };

  return {
    streamingMessageId,
    streamedMessageText,
    isStreaming,
    processStream,
  };
};
