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
        onToolCall: ({ id, tool, args, execution, quizData, query, url, citations }) => {
          if ((execution === "client" || execution === "local") && args) {
            import("@/services/ai/clientToolExecutor").then(({ executeClientTool }) => {
              executeClientTool(tool, args);
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
                : existingCalls.findIndex((tc) => tc.tool === tool);

              if (existingIdx !== -1) {
                const updated = [...existingCalls];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  query: query ?? updated[existingIdx].query,
                  url: url ?? updated[existingIdx].url,
                  args: args ?? updated[existingIdx].args,
                };
                return { ...m, toolCalls: updated };
              }
              return {
                ...m,
                toolCalls: [...existingCalls, { id, tool, args, quizData, query, url, citations }],
              };
            })
          );
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
