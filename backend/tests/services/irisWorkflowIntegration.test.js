import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { IrisStreamHandler } from "../../src/services/ai/stream/irisStreamHandler.js";
import { ToolExecutor } from "../../src/services/ai/tools/toolExecutor.js";
import { IrisAgent } from "../../src/services/ai/agent/irisAgent.js";
import { WorkflowService } from "../../src/services/ai/workflow/workflowService.js";
import { InMemoryWorkflowRepository } from "../../src/services/ai/workflow/repository/inMemoryWorkflowRepository.js";
import {
  WORKFLOW_STATUS,
  COMMAND,
  CHECKPOINT_STATUS,
  TASK_STATUS,
  VERDICT,
} from "../../src/services/ai/workflow/domain/workflowConstants.js";

function createMockStream(chunks) {
  const encoder = new TextEncoder();
  return (async function* () {
    for (const chunk of chunks) {
      yield encoder.encode(chunk);
    }
  })();
}

function createMockResponse() {
  const written = [];
  return {
    write: jest.fn((data) => written.push(data)),
    end: jest.fn(),
    written,
  };
}

describe("Iris Workflow Streaming Integration", () => {
  let repository;
  let workflowService;
  let toolExecutor;
  let streamHandler;

  beforeEach(() => {
    repository = new InMemoryWorkflowRepository();
    workflowService = new WorkflowService(repository);
    toolExecutor = new ToolExecutor({ workflowService });
    streamHandler = new IrisStreamHandler({ toolExecutor });
  });

  describe("IrisStreamHandler server tool recognition", () => {
    it("recognizes create_workflow tool call and includes it in serverToolCalls", async () => {
      const toolCallArgs = JSON.stringify({
        title: "MongoDB Mastery",
        phases: [
          {
            id: "p1",
            title: "Basics",
            tasks: [{ id: "t1", title: "Intro", concept: "Documents", order: 1 }],
          },
        ],
      });

      const ssePayload =
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_wf_1",
                    type: "function",
                    function: {
                      name: "create_workflow",
                      arguments: toolCallArgs,
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n` + `data: [DONE]\n\n`;

      const stream = createMockStream([ssePayload]);
      const res = createMockResponse();

      const result = await streamHandler.handle({
        stream,
        res,
        noteFetched: false,
        userId: "user-1",
      });

      expect(result.serverToolCalls).toHaveLength(1);
      expect(result.serverToolCalls[0]).toEqual({
        id: "call_wf_1",
        tool: "create_workflow",
        args: JSON.parse(toolCallArgs),
      });

      // Verifies an executing tool call SSE event was emitted
      const executingEvent = res.written.find((chunk) =>
        chunk.includes('"tool":"create_workflow"') && chunk.includes('"status":"executing"'),
      );
      expect(executingEvent).toBeDefined();
    });

    it("recognizes transition_workflow tool call in serverToolCalls", async () => {
      const toolCallArgs = JSON.stringify({
        workflowId: "wf-123",
        command: "START_WORKFLOW",
        expectedVersion: 0,
      });

      const ssePayload =
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_wf_2",
                    type: "function",
                    function: {
                      name: "transition_workflow",
                      arguments: toolCallArgs,
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n` + `data: [DONE]\n\n`;

      const stream = createMockStream([ssePayload]);
      const res = createMockResponse();

      const result = await streamHandler.handle({
        stream,
        res,
        noteFetched: false,
        userId: "user-1",
      });

      expect(result.serverToolCalls).toHaveLength(1);
      expect(result.serverToolCalls[0]).toEqual({
        id: "call_wf_2",
        tool: "transition_workflow",
        args: JSON.parse(toolCallArgs),
      });
    });

    it("does not treat ask_question as a server tool", async () => {
      const ssePayload =
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_q_1",
                    type: "function",
                    function: {
                      name: "ask_question",
                      arguments: JSON.stringify({
                        purpose: "quiz",
                        questions: [
                          {
                            id: "q1",
                            question: "What is MongoDB?",
                            type: "single_select",
                            options: ["Document DB", "Relational DB"],
                          },
                        ],
                      }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n` + `data: [DONE]\n\n`;

      const stream = createMockStream([ssePayload]);
      const res = createMockResponse();

      const result = await streamHandler.handle({
        stream,
        res,
        noteFetched: false,
        userId: "user-1",
      });

      expect(result.serverToolCalls).toHaveLength(0);
      expect(result.interaction).toBeDefined();
      expect(result.interaction.type).toBe("ask_question");
    });
  });

  describe("IrisAgent end-to-end continuation loop", () => {
    it("handles workflow tool call in Round 1, executes via ToolExecutor, and continues in Round 2", async () => {
      const workflowPhases = [
        {
          id: "phase-1",
          title: "MongoDB Core",
          tasks: [
            { id: "task-1", title: "Documents & Collections", concept: "Documents", order: 1 },
          ],
        },
      ];

      // Mock chatWithAi across rounds
      let roundCounter = 0;
      const chatWithAiMock = jest.fn(async ({ extraMessages }) => {
        roundCounter++;

        if (roundCounter === 1) {
          // Round 1: Model calls create_workflow
          const round1Sse =
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: "call_create_1",
                        type: "function",
                        function: {
                          name: "create_workflow",
                          arguments: JSON.stringify({
                            title: "MongoDB Course",
                            phases: workflowPhases,
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            })}\n\n` + `data: [DONE]\n\n`;

          return {
            stream: createMockStream([round1Sse]),
          };
        }

        if (roundCounter === 2) {
          // Verify round 2 received tool result in extraMessages
          expect(extraMessages).toBeDefined();
          const toolResultMsg = extraMessages.find((m) => m.role === "tool");
          expect(toolResultMsg).toBeDefined();
          expect(toolResultMsg.tool_call_id).toBe("call_create_1");

          const parsedResult = JSON.parse(toolResultMsg.content);
          expect(parsedResult.title).toBe("MongoDB Course");
          expect(parsedResult.status).toBe(WORKFLOW_STATUS.DRAFT);

          // Round 2: Model returns conversational text response
          const round2Sse =
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: "I've structured your MongoDB course! Let's begin Phase 1: MongoDB Core.",
                  },
                },
              ],
            })}\n\n` + `data: [DONE]\n\n`;

          return {
            stream: createMockStream([round2Sse]),
          };
        }

        throw new Error(`Unexpected round ${roundCounter}`);
      });

      const res = createMockResponse();

      const agent = new IrisAgent({
        maxToolRounds: 3,
        chatService: chatWithAiMock,
      });

      const finalResult = await agent.run({
        chatWithAi: chatWithAiMock,
        message: "Teach me MongoDB as a structured course.",
        history: [],
        summary: "",
        noteContext: "",
        systemPrompt: "You are Iris.",
        stream: true,
        useReasoning: false,
        enableWeb: false,
        chatMode: "study",
        tools: [],
        userId: "user-1",
        res,
        streamAiResponse: (stream, response, noteFetched, uId) =>
          streamHandler.handle({ stream, res: response, noteFetched, userId: uId }),
        executeServerTool: (toolName, args, uId, fallbackNoteId) =>
          streamHandler.executeServerTool(toolName, args, uId, fallbackNoteId),
      });

      // 1. Check agent executed exactly 2 rounds
      expect(chatWithAiMock).toHaveBeenCalledTimes(2);

      // 2. Check workflow was persisted to repository
      const userWorkflows = await repository.listByUser("user-1");
      expect(userWorkflows).toHaveLength(1);
      expect(userWorkflows[0].title).toBe("MongoDB Course");

      // 3. Check finalReply aggregated from Round 2
      expect(finalResult.finalReply).toContain(
        "I've structured your MongoDB course! Let's begin Phase 1: MongoDB Core.",
      );

      // 4. Check tool execution success SSE event was emitted to client
      const successToolEvent = res.written.find((chunk) =>
        chunk.includes('"tool":"create_workflow"') && chunk.includes('"status":"success"'),
      );
      expect(successToolEvent).toBeDefined();

      // 5. Check toolCalls tracked on final agent return
      expect(finalResult.toolCalls).toHaveLength(1);
      expect(finalResult.toolCalls[0].tool).toBe("create_workflow");
      expect(finalResult.toolCalls[0].status).toBe("success");
    });
  });

  describe("End-to-End Checkpoint & JEV Learning Loop", () => {
    let mockEvaluator;
    let initialWorkflow;

    beforeEach(async () => {
      mockEvaluator = {
        evaluate: jest.fn(),
      };
      workflowService = new WorkflowService(repository, mockEvaluator);
      toolExecutor = new ToolExecutor({ workflowService });
      streamHandler = new IrisStreamHandler({ toolExecutor });

      // Create an active workflow ready for checkpoint presentation
      initialWorkflow = {
        id: "wf-e2e",
        userId: "user-1",
        sessionId: "sess-1",
        title: "BSON Mastery",
        phases: [
          {
            id: "p1",
            title: "Serialization",
            tasks: [
              {
                id: "t1",
                title: "BSON Fundamentals",
                concept: "BSON binary format",
                order: 1,
              },
            ],
          },
        ],
        status: WORKFLOW_STATUS.ACTIVE,
        activePhaseId: "p1",
        activeTaskId: "t1",
        activeCheckpointId: null,
        taskStates: {
          t1: { status: TASK_STATUS.ACTIVE, attempts: 0 },
        },
        checkpoints: {},
        version: 2,
      };

      await repository.create(initialWorkflow);
    });

    it("Iris presents checkpoint, emits ask_question with workflow/checkpoint identity, and SUBMIT_ANSWER triggers JEV evaluation to complete task", async () => {
      const evaluationSpec = {
        expectedAnswer: "Binary JSON, which provides serialization and fast traversal.",
        keyConcepts: ["Binary JSON", "serialization"],
        rubric: [{ criterion: "Accurate BSON definition", weight: 1.0 }],
        commonMisconceptions: ["BSON is text JSON"],
      };

      // --- PHASE 1: Iris presents checkpoint and emits interactive question ---
      const presentToolCall = {
        workflowId: "wf-e2e",
        command: COMMAND.PRESENT_CHECKPOINT,
        payload: {
          taskId: "t1",
          checkpointId: "cp-1",
          question: "What does BSON stand for and what is its role in MongoDB?",
          evaluationSpec,
        },
        expectedVersion: 2,
      };

      const askQuestionToolCall = {
        workflowId: "wf-e2e",
        checkpointId: "cp-1",
        purpose: "quiz",
        title: "BSON Checkpoint",
        questions: [
          {
            id: "q1",
            workflowId: "wf-e2e",
            checkpointId: "cp-1",
            question: "What does BSON stand for and what is its role in MongoDB?",
            type: "single_select",
            options: ["Binary JSON serialization", "Basic String Object Notation", "None"],
          },
        ],
      };

      const round1Sse =
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_present_1",
                    type: "function",
                    function: {
                      name: "transition_workflow",
                      arguments: JSON.stringify(presentToolCall),
                    },
                  },
                  {
                    index: 1,
                    id: "call_ask_1",
                    type: "function",
                    function: {
                      name: "ask_question",
                      arguments: JSON.stringify(askQuestionToolCall),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n` + `data: [DONE]\n\n`;

      const res1 = createMockResponse();
      const stream1 = createMockStream([round1Sse]);

      const round1Result = await streamHandler.handle({
        stream: stream1,
        res: res1,
        noteFetched: false,
        userId: "user-1",
      });

      // 1. Verify IrisStreamHandler recognized transition_workflow as a server tool
      expect(round1Result.serverToolCalls).toHaveLength(1);
      expect(round1Result.serverToolCalls[0].tool).toBe("transition_workflow");

      // 2. Execute server tool (as IrisAgent does)
      const serverToolResult = await streamHandler.executeServerTool(
        round1Result.serverToolCalls[0].tool,
        round1Result.serverToolCalls[0].args,
        "user-1",
      );

      // Verify PRESENT_CHECKPOINT succeeded and persisted to repository
      expect(serverToolResult.version).toBe(3);
      expect(serverToolResult.activeCheckpointId).toBe("cp-1");
      const storedAfterPresent = await repository.getById("wf-e2e", "user-1");
      expect(storedAfterPresent.version).toBe(3);
      expect(storedAfterPresent.checkpoints["cp-1"]).toMatchObject({
        id: "cp-1",
        taskId: "t1",
        status: CHECKPOINT_STATUS.WAITING_FOR_ANSWER,
        evaluationSpec,
      });

      // 3. Verify ask_question emitted to client with preserved workflowId and checkpointId!
      const askQuestionEvent = res1.written.find((chunk) =>
        chunk.includes('"tool":"ask_question"') && chunk.includes('"checkpointId":"cp-1"'),
      );
      expect(askQuestionEvent).toBeDefined();
      expect(askQuestionEvent).toContain('"workflowId":"wf-e2e"');
      expect(askQuestionEvent).toContain('"checkpointId":"cp-1"');

      // --- PHASE 2: User answers -> SUBMIT_ANSWER -> JEV evaluates -> task completes ---
      mockEvaluator.evaluate.mockResolvedValue({
        verdict: VERDICT.PASSED,
        confidence: 0.98,
        feedback: "Spot on! BSON provides binary serialization with type information.",
        misconceptions: [],
        criterionResults: [
          { criterion: "Accurate BSON definition", passed: true, feedback: "Correct." },
        ],
      });

      const submitResult = await toolExecutor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: "wf-e2e",
          command: "SUBMIT_ANSWER",
          payload: {
            checkpointId: "cp-1",
            answer: "Binary JSON serialization format used by MongoDB.",
          },
          expectedVersion: 3,
        },
        userId: "user-1",
      });

      // 4. Verify JEV was invoked with only checkpoint context and user answer
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(1);
      expect(mockEvaluator.evaluate).toHaveBeenCalledWith({
        checkpoint: expect.objectContaining({
          id: "cp-1",
          question: "What does BSON stand for and what is its role in MongoDB?",
          status: CHECKPOINT_STATUS.ANSWERED,
          userAnswer: "Binary JSON serialization format used by MongoDB.",
        }),
        userAnswer: "Binary JSON serialization format used by MongoDB.",
      });

      // 5. Verify final workflow state: evaluated, version advanced twice (3 -> 4 -> 5), task completed, workflow completed!
      expect(submitResult.version).toBe(5);
      expect(submitResult.status).toBe(WORKFLOW_STATUS.COMPLETED);
      expect(submitResult.taskStates["t1"].status).toBe(TASK_STATUS.COMPLETED);
      expect(submitResult.checkpoints["cp-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
      expect(submitResult.checkpoints["cp-1"].evaluation.verdict).toBe(VERDICT.PASSED);
      expect(submitResult.checkpoints["cp-1"].evaluation.feedback).toContain("Spot on!");

      // 6. Verify repository state matches exactly
      const finalStored = await repository.getById("wf-e2e", "user-1");
      expect(finalStored.version).toBe(5);
      expect(finalStored.status).toBe(WORKFLOW_STATUS.COMPLETED);
      expect(finalStored.taskStates["t1"].status).toBe(TASK_STATUS.COMPLETED);
      expect(finalStored.checkpoints["cp-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
    });

    it("marks task as NEEDS_REVIEW when JEV returns MISCONCEPTION for recovery teaching", async () => {
      // Setup checkpoint already presented at version 3
      await toolExecutor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: "wf-e2e",
          command: COMMAND.PRESENT_CHECKPOINT,
          payload: {
            taskId: "t1",
            checkpointId: "cp-1",
            question: "What does BSON stand for?",
            evaluationSpec: {
              expectedAnswer: "Binary JSON",
              keyConcepts: ["Binary"],
              rubric: [{ criterion: "Accurate BSON definition", weight: 1.0 }],
              commonMisconceptions: ["Text JSON"],
            },
          },
          expectedVersion: 2,
        },
        userId: "user-1",
      });

      // JEV returns MISCONCEPTION
      mockEvaluator.evaluate.mockResolvedValue({
        verdict: VERDICT.MISCONCEPTION,
        confidence: 0.92,
        feedback: "Incorrect. BSON is binary serialized, not plain text JSON.",
        misconceptions: ["BSON is text JSON"],
        criterionResults: [
          { criterion: "Accurate BSON definition", passed: false, feedback: "Assumed text JSON." },
        ],
      });

      const submitResult = await toolExecutor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: "wf-e2e",
          command: "SUBMIT_ANSWER",
          payload: {
            checkpointId: "cp-1",
            answer: "It is text-based JSON stored on disk.",
          },
          expectedVersion: 3,
        },
        userId: "user-1",
      });

      // Task is marked NEEDS_REVIEW, attempts incremented, workflow remains ACTIVE for Iris recovery teaching!
      expect(submitResult.status).toBe(WORKFLOW_STATUS.ACTIVE);
      expect(submitResult.taskStates["t1"].status).toBe(TASK_STATUS.NEEDS_REVIEW);
      expect(submitResult.taskStates["t1"].attempts).toBe(1);
      expect(submitResult.checkpoints["cp-1"].evaluation.verdict).toBe(VERDICT.MISCONCEPTION);

      const stored = await repository.getById("wf-e2e", "user-1");
      expect(stored.taskStates["t1"].status).toBe(TASK_STATUS.NEEDS_REVIEW);
      expect(stored.checkpoints["cp-1"].status).toBe(CHECKPOINT_STATUS.EVALUATED);
    });
  });
});
