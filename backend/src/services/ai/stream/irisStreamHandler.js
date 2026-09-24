import { SseStreamParser } from "../../../utils/sseParser.js";
import { toolExecutor } from "../tools/toolExecutor.js";

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
    let memoryToolArgs = "";
    let memoryToolIndex = -1;
    let quizToolArgs = "";
    let quizToolIndex = -1;

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
                }
              } catch (_) {
                // Arguments are still streaming across chunks; wait for complete JSON
              }
            }

            // Custom function tools (save_memory, generate_quiz, ask_question)
            if (
              state.name === "generate_quiz" ||
              tc.function?.name === "generate_quiz" ||
              state.name === "ask_question" ||
              tc.function?.name === "ask_question"
            ) {
              quizToolIndex = toolIndex;
              if (tc.function?.arguments) quizToolArgs += tc.function.arguments;
            } else if (state.name === "save_memory" || tc.function?.name === "save_memory") {
              memoryToolIndex = toolIndex;
              if (tc.function?.arguments) memoryToolArgs += tc.function.arguments;
            } else if (memoryToolIndex !== -1 && toolIndex === memoryToolIndex) {
              if (tc.function?.arguments) memoryToolArgs += tc.function.arguments;
            } else if (quizToolIndex !== -1 && toolIndex === quizToolIndex) {
              if (tc.function?.arguments) quizToolArgs += tc.function.arguments;
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
      } else if (normalizedTool === "crawl_url" && state.parsedUrl) {
        toolCalls.push({
          id: state.id,
          tool: "crawl_url",
          url: state.parsedUrl,
        });
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
            finalReply = `I've created ${noteTitle} in your workspace!`;
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

    // Execute memory save if triggered
    if (memoryToolIndex !== -1 && memoryToolArgs) {
      try {
        const args = JSON.parse(memoryToolArgs);
        if (args.category && args.content && userId) {
          import("../../memoryService.js").then(({ saveMemory }) => {
            saveMemory(userId, args).catch(console.error);
          });
          res.write(
            `data: ${JSON.stringify({ type: "tool_call", tool: "save_memory" })}\n\n`,
          );

          toolCalls.push({
            tool: "save_memory",
            category: args.category,
            content: args.content,
          });

          if (!finalReply.trim()) {
            finalReply = `Got it! I've saved that to my memory: "${args.content}"`;
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: finalReply } }] })}\n\n`,
            );
          }
        }
      } catch (err) {
        console.error(
          `Failed to parse save_memory arguments: ${err.message}. Raw args:`,
          memoryToolArgs,
        );
      }
    }

    if (quizToolIndex !== -1 && quizToolArgs) {
      try {
        const args = JSON.parse(quizToolArgs);
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

          const toolPayload = {
            type: "tool_call",
            tool: "ask_question",
            purpose,
            quizData: normalizedQuestions,
            questions: normalizedQuestions,
            title: args.title || null,
          };

          res.write(`data: ${JSON.stringify(toolPayload)}\n\n`);
          toolCalls.push({
            tool: "ask_question",
            purpose,
            quizData: normalizedQuestions,
            questions: normalizedQuestions,
            title: args.title || null,
          });
        }
      } catch (err) {
        console.error(
          `Failed to parse ask_question/generate_quiz arguments: ${err.message}. Raw args:`,
          quizToolArgs,
        );
      }
    }

    // Clean any accidental hallucinated pseudo-tags from finalReply before saving
    finalReply = finalReply.replace(/\[Tool requested:\s*[^\]]+\]/gi, "").trim();

    return { finalReply, toolCalls, serverToolCalls };
  }
}

export const irisStreamHandler = new IrisStreamHandler();
