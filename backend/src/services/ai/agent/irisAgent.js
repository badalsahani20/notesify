import { chatWithAi } from "../chatService.js";

const DEFAULT_MAX_TOOL_ROUNDS = 3;

export class IrisAgent {
  constructor({ maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS } = {}) {
    this.maxToolRounds = maxToolRounds;
  }

  async run({
    message,
    history = [],
    summary = "",
    noteContext = "",
    noteFetched = false,
    systemPrompt = "",
    pdfContext = "",
    imageBase64 = null,
    stream = false,
    useReasoning = false,
    enableWeb = false,
    chatMode = "casual",
    tools = null,
    isNoteScoped = false,
    userId,
    activeNoteId = null,
    res,

    streamAiResponse,
    executeServerTool,
  }) {
    let finalReply = "";
    const toolCalls = [];
    const extraMessages = [];
    let pdfContextToEmit = pdfContext || "";
    let currentRound = 0;

    while (currentRound < this.maxToolRounds) {
      currentRound++;

      console.log(
        `🤖 [AgenticLoop] Round ${currentRound}/${this.maxToolRounds}`,
      );

      let roundResult;

      try {
        roundResult = await chatWithAi({
          message,
          history,
          summary,
          noteContext,
          webContext: "",
          systemPrompt,
          pdfContext,
          imageBase64,
          stream,
          useReasoning,
          enableWeb,
          chatMode,
          tools,
          isNoteScoped,
          extraMessages,
        });
      } catch (aiError) {
        console.error(
          `❌ [AgenticLoop] AI model failed on round ${currentRound}:`,
          aiError.message,
        );

        if (currentRound === 1 && stream) {
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message: "AI service unavailable",
            })}\n\n`,
          );
        }

        break;
      }

      if (!stream) {
        finalReply = roundResult.reply;
        break;
      }

      try {
        const responseObj = await streamAiResponse(
          roundResult.stream,
          res,
          currentRound === 1 ? noteFetched : false,
          userId,
        );

        if (responseObj.finalReply) {
          finalReply = finalReply
            ? `${finalReply}\n\n${responseObj.finalReply}`
            : responseObj.finalReply;
        }

        if (responseObj.toolCalls?.length > 0) {
          toolCalls.push(...responseObj.toolCalls);
        }

        if (roundResult.pdfContext) {
          pdfContextToEmit = roundResult.pdfContext;
        }

        const serverToolsToRun = responseObj.serverToolCalls || [];

        if (
          serverToolsToRun.length > 0 &&
          currentRound < this.maxToolRounds
        ) {
          for (const st of serverToolsToRun) {
            const toolExecResult = await executeServerTool(
              st.tool,
              st.args,
              userId,
              activeNoteId,
            );

            // Keep the existing SSE payload exactly as-is.
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: st.id,
                tool: st.tool,
                status: toolExecResult.error ? "error" : "success",
                data: toolExecResult,
              })}\n\n`,
            );

            toolCalls.push({
              id: st.id,
              tool: st.tool,
              args: st.args,
              status: toolExecResult.error ? "error" : "success",
              data: toolExecResult,
            });

            extraMessages.push(
              {
                role: "assistant",
                content: responseObj.finalReply || null,
                tool_calls: [
                  {
                    id: st.id,
                    type: "function",
                    function: {
                      name: st.tool,
                      arguments: JSON.stringify(st.args),
                    },
                  },
                ],
              },
              {
                role: "tool",
                tool_call_id: st.id,
                name: st.tool,
                content: JSON.stringify(toolExecResult),
              },
            );
          }

          // Continue the agentic loop with the server tool result.
          continue;
        }

        // No server-side continuation.
        // Client tools such as create_note/update_note terminate the loop.
        break;
      } catch (streamError) {
        console.error(
          "Streaming error in round:",
          streamError.message,
        );

        break;
      }
    }

    return {
      finalReply,
      toolCalls,
      pdfContext: pdfContextToEmit,
    };
  }
}

export const irisAgent = new IrisAgent();
