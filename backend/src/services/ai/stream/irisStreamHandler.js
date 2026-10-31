import { SseStreamParser } from "../../../utils/sseParser.js";
import { toolExecutor } from "../tools/toolExecutor.js";
import crypto from "node:crypto";

const NORMALIZE_TOOL_NAME = {
  "openrouter:web_search": "search_web",
  "web_search": "search_web",
  "openrouter:web_fetch": "crawl_url",
  "web_fetch": "crawl_url",
};

export class IrisStreamHandler {
  constructor({ toolExecutor: executor = toolExecutor } = {}) {
    this.toolExecutor = executor;
  }

  async executeServerTool(toolName, args, userId, fallbackNoteId) {
    return this.toolExecutor.execute({
      toolName,
      args,
      userId,
      fallbackNoteId,
    });
  }

  async handle({
    stream,
    res,
    noteFetched,
    userId,
    fallbackNoteId,
  }) {
    const decoder = new TextDecoder();
    let finalReply = "";
    const parser = new SseStreamParser();
    let askQuestionToolArgs = "";
    let askQuestionToolIndex = -1;
    let interaction = null;
    let capturedUsage = null;
    let recallMemoryToolIndex = -1;
    let recallMemoryToolArgs = "";

    // Server tools & citations tracking
    const toolCallsByIndex = new Map(); // index -> { id, name, rawArgs: "", emitted: false, parsedQuery: "", parsedUrl: "" }
    const citationsMap = new Map(); // normalizedUrl -> { url, title, content }
    const toolCalls = [];
    const serverToolCalls = [];

    if (noteFetched) {
      res.write(
        `data: ${JSON.stringify({ type: "tool_call", tool: "get_note_content" })}\n\n`,
      );
    }

    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      res.write(text);

      const events = parser.processChunk(chunk);

      for (const data of events) {

        if (data?.usage) {
          capturedUsage = {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens || data.usage.cache_discount || 0,
          };
        }

        const choice = data.choices?.[0];

        // 1. Intercept choice annotations (citations returned by OpenRouter server tools)
        if (choice?.delta?.annotations && Array.isArray(choice.delta.annotations)) {
          let hasNewCitation = false;
          for (const ann of choice.delta.annotations) {
            if (ann?.type === "url_citation" && ann.url_citation?.url) {
              const rawUrl = String(ann.url_citation.url).trim();
              const normUrl = rawUrl.toLowerCase();
              if (!citationsMap.has(normUrl)) {
                citationsMap.set(normUrl, {
                  url: rawUrl,
                  title: ann.url_citation.title || "",
                  content: ann.url_citation.content || "",
                });
                hasNewCitation = true;
              }
            }
          }
          if (hasNewCitation) {
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                tool: "web_citations",
                citations: Array.from(citationsMap.values()),
              })}\n\n`
            );
          }
        }

        // 2. Intercept and accumulate tool calls delta
        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const toolIndex = tc.index ?? 0;
            let state = toolCallsByIndex.get(toolIndex);
            if (!state) {
              state = {
                id: tc.id || `tool_${toolIndex}`,
                name: tc.function?.name || "",
                rawArgs: "",
                emitted: false,
                parsedQuery: "",
                parsedUrl: "",
              };
              toolCallsByIndex.set(toolIndex, state);
            }
            if (tc.id && !state.id) state.id = tc.id;
            if (tc.function?.name && !state.name) state.name = tc.function.name;
            if (tc.function?.arguments) {
              state.rawArgs += tc.function.arguments;
            }

            // Accumulate tool-call arguments and parse complete JSON before emitting
            if (state.rawArgs) {
              try {
                const parsed = JSON.parse(state.rawArgs);
                const normalizedTool = NORMALIZE_TOOL_NAME[state.name] || state.name;

                if (normalizedTool === "search_web" && parsed.query && !state.emitted) {
                  state.emitted = true;
                  state.parsedQuery = parsed.query;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "search_web",
                      query: parsed.query,
                    })}\n\n`,
                  );
                } else if (normalizedTool === "crawl_url" && (parsed.url || parsed.query) && !state.emitted) {
                  state.emitted = true;
                  state.parsedUrl = parsed.url || parsed.query;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "crawl_url",
                      url: state.parsedUrl,
                    })}\n\n`,
                  );
                } else if(normalizedTool === "create_note" && !state.emitted) {
                  state.emitted = true;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "create_note",
                      args: parsed,
                      execution: "local",
                    })}\n\n`,
                  )
                } else if(normalizedTool === "delete_note" && !state.emitted) {
                  state.emitted = true;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "delete_note",
                      args: parsed,
                      execution: "local",
                    })}\n\n`,
                  )
                } else if(normalizedTool === "get_note_content" && !state.emitted) {
                  state.emitted = true;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "get_note_content",
                      args: parsed,
                      status: "executing",
                    })}\n\n`,
                  )
                } else if(normalizedTool === "recall_memory" && !state.emitted) {
                  state.emitted = true;
                  state.parsedQuery = parsed.query;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "recall_memory",
                      query: parsed.query,
                    })}\n\n`,
                  )
                } else if(normalizedTool === "save_memory" && !state.emitted) {
                  state.emitted = true;
                  state.parsedArgs = parsed;
                  res.write(
                    `data: ${JSON.stringify({
                      type: "tool_call",
                      id: state.id,
                      tool: "save_memory",
                      args: parsed,
                      status: "executing",
                    })}\n\n`,
                  )
                } 
              } catch (_) {
                // Arguments are still streaming across chunks; wait for complete JSON
              }
            }

            // Custom function tools (ask_question, recall_memory)
            if (
              state.name === "ask_question" ||
              tc.function?.name === "ask_question"
            ) {
              askQuestionToolIndex = toolIndex;
              if (tc.function?.arguments) askQuestionToolArgs += tc.function.arguments;
            } else if (state.name === "recall_memory" || tc.function?.name === "recall_memory") {
              recallMemoryToolIndex = toolIndex;
              if (tc.function?.arguments) recallMemoryToolArgs += tc.function.arguments;
            } else if (askQuestionToolIndex !== -1 && toolIndex === askQuestionToolIndex) {
              if (tc.function?.arguments) askQuestionToolArgs += tc.function.arguments;
            } else if (recallMemoryToolIndex !== -1 && toolIndex === recallMemoryToolIndex) {
              if (tc.function?.arguments) recallMemoryToolArgs += tc.function.arguments;
            }
          }
        }

        finalReply +=
          choice?.delta?.content ||
          choice?.message?.content ||
          data.content ||
          data.text ||
          "";
      }
    }

    // Finalize tool calls once stream has ended
    for (const [_, state] of toolCallsByIndex) {
      const normalizedTool = NORMALIZE_TOOL_NAME[state.name] || state.name;

      if (!state.emitted && state.rawArgs) {
        try {
          const parsed = JSON.parse(state.rawArgs);
          if (normalizedTool === "search_web" && parsed.query) {
            state.emitted = true;
            state.parsedQuery = parsed.query;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "search_web",
                query: parsed.query,
              })}\n\n`,
            );
          } else if (normalizedTool === "crawl_url" && (parsed.url || parsed.query)) {
            state.emitted = true;
            state.parsedUrl = parsed.url || parsed.query;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "crawl_url",
                url: state.parsedUrl,
              })}\n\n`,
            );
          } else if (normalizedTool === "create_note") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "create_note",
                args: parsed,
                execution: "local",
              })}\n\n`,
            );
          } else if(normalizedTool === "update_note") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "update_note",
                args: parsed,
                execution: "local",
              })}\n\n`,
            );
          } else if(normalizedTool === "delete_note") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "delete_note",
                args: parsed,
                execution: "local",
              })}\n\n`,
            );
          } else if(normalizedTool === "get_note_content") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "get_note_content",
                args: parsed,
                status: "executing",
              })}\n\n`,
            );
          } else if(normalizedTool === "recall_memory") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "recall_memory",
                args: parsed,
                status: "executing",
              })}\n\n`,
            );
          } else if(normalizedTool === "save_memory") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "save_memory",
                args: parsed,
                status: "executing",
              })}\n\n`,
            );
          } else if(normalizedTool === "search_notes") {
            state.emitted = true;
            state.parsedArgs = parsed;
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                id: state.id,
                tool: "search_notes",
                args: parsed,
                status: "executing",
              })}\n\n`,
            );
          }
        } catch (_) {
          // Fallback regex extraction if stream was truncated before trailing JSON brace
          if (normalizedTool === "search_web") {
            const qMatch = state.rawArgs.match(/"query"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
            if (qMatch && qMatch[1]) {
              state.emitted = true;
              state.parsedQuery = qMatch[1];
              res.write(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  id: state.id,
                  tool: "search_web",
                  query: qMatch[1],
                })}\n\n`,
              );
            }
          } else if (normalizedTool === "crawl_url") {
            const uMatch = state.rawArgs.match(/"url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
            if (uMatch && uMatch[1]) {
              state.emitted = true;
              state.parsedUrl = uMatch[1];
              res.write(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  id: state.id,
                  tool: "crawl_url",
                  url: uMatch[1],
                })}\n\n`,
              );
            }
          }
        }
      }

      if (normalizedTool === "search_web" && state.parsedQuery) {
        toolCalls.push({
          id: state.id,
          tool: "search_web",
          query: state.parsedQuery,
        });

        // `search_web` (our function tool) must run server-side. The
        // `openrouter:web_search` variant has already executed provider-side,
        // so only the raw local name is queued for the agent loop.
        if (state.name === "search_web") {
          serverToolCalls.push({
            id: state.id,
            tool: "search_web",
            args: { query: state.parsedQuery },
          });
        }
      } else if (normalizedTool === "crawl_url" && state.parsedUrl) {
        toolCalls.push({
          id: state.id,
          tool: "crawl_url",
          url: state.parsedUrl,
        });

        // Native fetch runs server-side. `openrouter:web_fetch` already ran
        // provider-side, so only the raw local name is queued.
        if (state.name === "crawl_url") {
          serverToolCalls.push({
            id: state.id,
            tool: "crawl_url",
            args: { url: state.parsedUrl },
          });
        }
      } else if (normalizedTool === "create_note") {
        let parsedArgs = state.parsedArgs;
        if (!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          toolCalls.push({
            id: state.id,
            tool: "create_note",
            args: parsedArgs,
            execution: "local",
          });

          if (!finalReply.trim()) {
            const noteTitle = parsedArgs.title ? `**${parsedArgs.title}**` : "your note";
            finalReply = `I've drafted ${noteTitle}. Would you like me to create this note?`;
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`,
            );
          }
        }
      } else if (normalizedTool === "update_note") {
        let parsedArgs = state.parsedArgs;
        if(!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          toolCalls.push({
            id: state.id,
            tool: "update_note",
            args: parsedArgs,
            execution: "local",
          });

          if(!finalReply.trim()) {
            const noteTitle = parsedArgs.title ? `**${parsedArgs.title}**` : "your note";
            finalReply = `Got it! I've updated ${noteTitle} in your workspace`;
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`
            )
          }
        }
      } else if (normalizedTool === "delete_note") {
        let parsedArgs = state.parsedArgs;
        if (!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          toolCalls.push({
            id: state.id,
            tool: "delete_note",
            args: parsedArgs,
            execution: "local",
          });

          if (!finalReply.trim()) {
            const noteTitle = parsedArgs.title ? `**${parsedArgs.title}**` : "the note";
            finalReply = `Would you like me to move ${noteTitle} to the trash?`;
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`,
            );
          }
        }
      } else if (normalizedTool === "get_note_content") {
        let parsedArgs = state.parsedArgs;
        if (!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          serverToolCalls.push({
            id: state.id,
            tool: "get_note_content",
            args: parsedArgs,
          });
        }
      } else if(normalizedTool === "recall_memory") {
        let parsedArgs = state.parsedArgs;
        if (!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          serverToolCalls.push({
            id: state.id,
            tool: "recall_memory",
            args: parsedArgs,
          });
        }
      } else if(normalizedTool === "save_memory") {
        let parsedArgs = state.parsedArgs;
        if (!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if (parsedArgs) {
          serverToolCalls.push({
            id: state.id,
            tool: "save_memory",
            args: parsedArgs,
          });
        }
      } else if(normalizedTool === "search_notes") {
        let parsedArgs = state.parsedArgs;
        if(!parsedArgs && state.rawArgs) {
          try {
            parsedArgs = JSON.parse(state.rawArgs);
          } catch (_) {}
        }

        if(parsedArgs) {
          serverToolCalls.push({
            id: state.id,
            tool: "search_notes",
            args: parsedArgs,
          })
        }
      }
    }

    // Record citations into toolCalls and emit final snapshot
    if (citationsMap.size > 0) {
      const finalCitations = Array.from(citationsMap.values());
      toolCalls.push({
        tool: "web_citations",
        citations: finalCitations,
      });
      res.write(
        `data: ${JSON.stringify({
          type: "tool_call",
          tool: "web_citations",
          citations: finalCitations,
        })}\n\n`,
      );
    }

    if (askQuestionToolIndex !== -1 && askQuestionToolArgs) {
      try {
        const args = JSON.parse(askQuestionToolArgs);
        if (args.questions && args.questions.length > 0) {
          const purpose = args.purpose || "quiz";
          const questionLimit = purpose === "quiz" ? 15 : args.questions.length;
          const normalizedQuestions = args.questions.slice(0, questionLimit).map((q, idx) => ({
            id: q.id || `q${idx + 1}`,
            question: q.question,
            type: q.type || (q.isMultiSelect ? "multi_select" : "single_select"),
            options: Array.isArray(q.options) ? q.options : [],
            allowOther: q.allowOther !== false,
          }));

          const interactionId = crypto.randomUUID();
          const checkpointId = crypto.randomUUID();
          const firstQuestion = normalizedQuestions[0];

          interaction = {
            interactionId,
            checkpointId,
            type: "ask_question",
            purpose,
            question: firstQuestion?.question || "",
            options: firstQuestion?.options || [],
            questions: normalizedQuestions,
            status: "pending",
          };

          const toolPayload = {
            type: "tool_call",
            tool: "ask_question",
            interactionId,
            checkpointId,
            purpose,
            quizData: normalizedQuestions,
            questions: normalizedQuestions,
          };

          res.write(`data: ${JSON.stringify(toolPayload)}\n\n`);
          toolCalls.push({
            tool: "ask_question",
            purpose,
            quizData: normalizedQuestions,
            questions: normalizedQuestions,
          });

          if (!finalReply.trim()) {
            finalReply = firstQuestion?.question
              ? `I have a quick question to help clarify: **${firstQuestion.question}**`
              : "I have a quick question to help clarify your request:";
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`,
            );
          }
        }
      } catch (err) {
        console.error(
          `Failed to parse ask_question arguments: ${err.message}. Raw args:`,
          askQuestionToolArgs,
        );
      }
    }

    // Clean any accidental hallucinated pseudo-tags from finalReply before saving
    finalReply = finalReply
      .replace(/\[Tool requested:\s*[^\]]+\]/gi, "")
      .replace(/\[Tool result:\s*[^\]]+\]/gi, "")
      .trim();

    const tokenUsage = capturedUsage || {
        promptTokens: Math.ceil(500 / 3.8),
        completionTokens: Math.ceil(finalReply.length / 3.8),
        totalTokens: Math.ceil((500 + finalReply.length) / 3.8),
        cachedTokens: 0,
        estimated: true,
      };

    if (tokenUsage.cachedTokens > 0) {
      const pct = Math.round((tokenUsage.cachedTokens / (tokenUsage.promptTokens || 1)) * 100);
      console.log(`⚡ [OpenRouter Cache HIT] ${tokenUsage.cachedTokens}/${tokenUsage.promptTokens} tokens (${pct}%) served from cache`);
    } else if (tokenUsage.promptTokens > 0) {
      console.log(`📝 [OpenRouter Cache WRITE] Cold prompt: ${tokenUsage.promptTokens} tokens sent (cached for follow-ups)`);
    }

    return { finalReply, toolCalls, serverToolCalls, interaction, tokenUsage };
  }
}

export const irisStreamHandler = new IrisStreamHandler();
