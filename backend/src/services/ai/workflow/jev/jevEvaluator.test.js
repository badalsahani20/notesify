import { describe, it, expect, jest } from "@jest/globals";
import { JevEvaluator } from "./jevEvaluator.js";
import { JEV_ERROR } from "./jevErrors.js";
import { VERDICT } from "../domain/workflowConstants.js";

describe("JevEvaluator", () => {
  const baseCheckpoint = {
    id: "checkpoint-1",
    taskId: "task-1",
    question: "What is an index in MongoDB and how does it affect query execution?",
    evaluationSpec: {
      expectedAnswer: "An index is a B-Tree structure that enables fast lookups and reduces scanned documents.",
      keyConcepts: ["B-Tree", "query performance", "document scan"],
      rubric: [
        { criterion: "Explains reduced document scanning", weight: 0.6 },
        { criterion: "Identifies B-Tree data structure", weight: 0.4 },
      ],
      commonMisconceptions: ["Indexes speed up all write operations"],
    },
  };

  const validAnswer = "Indexes organize keys into a B-Tree so queries don't need to scan the entire collection.";

  it("evaluates a valid PASSED result", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.PASSED,
      confidence: 0.94,
      feedback: "Correct. You identified the main reason indexes improve lookup performance.",
      misconceptions: [],
      criterionResults: [
        {
          criterion: "Explains reduced document scanning",
          passed: true,
          feedback: "Correctly explained.",
        },
        {
          criterion: "Identifies B-Tree data structure",
          passed: true,
          feedback: "Mentioned B-Tree.",
        },
      ],
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    const result = await evaluator.evaluate({
      checkpoint: baseCheckpoint,
      userAnswer: validAnswer,
    });

    expect(result).toEqual({
      verdict: VERDICT.PASSED,
      confidence: 0.94,
      feedback: "Correct. You identified the main reason indexes improve lookup performance.",
      misconceptions: [],
      criterionResults: [
        {
          criterion: "Explains reduced document scanning",
          passed: true,
          feedback: "Correctly explained.",
          notes: "Correctly explained.",
        },
        {
          criterion: "Identifies B-Tree data structure",
          passed: true,
          feedback: "Mentioned B-Tree.",
          notes: "Mentioned B-Tree.",
        },
      ],
    });
  });

  it("evaluates a valid PARTIAL result", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.PARTIAL,
      confidence: 0.85,
      feedback: "You correctly noted it speeds up searches, but did not mention B-Trees or scan reductions.",
      misconceptions: [],
      criterionResults: [
        {
          criterion: "Explains reduced document scanning",
          passed: false,
          feedback: "Did not mention scan reduction.",
        },
      ],
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    const result = await evaluator.evaluate({
      checkpoint: baseCheckpoint,
      userAnswer: "It makes searching faster.",
    });

    expect(result.verdict).toBe(VERDICT.PARTIAL);
    expect(result.confidence).toBe(0.85);
    expect(result.feedback).toContain("speeds up searches");
    expect(result.criterionResults[0].passed).toBe(false);
  });

  it("evaluates a valid MISCONCEPTION result", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.MISCONCEPTION,
      confidence: 0.9,
      feedback: "Incorrect. Indexes actually add overhead to insert and update operations.",
      misconceptions: ["Indexes speed up all write operations"],
      criterionResults: [
        {
          criterion: "Explains reduced document scanning",
          passed: false,
          feedback: "Incorrect assumption regarding writes.",
        },
      ],
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    const result = await evaluator.evaluate({
      checkpoint: baseCheckpoint,
      userAnswer: "Indexes make inserts and updates much faster.",
    });

    expect(result.verdict).toBe(VERDICT.MISCONCEPTION);
    expect(result.confidence).toBe(0.9);
    expect(result.misconceptions).toEqual(["Indexes speed up all write operations"]);
  });

  it("rejects an invalid verdict", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: "INVALID_VERDICT",
      confidence: 0.9,
      feedback: "Some feedback",
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_EVALUATION,
      message: "JEV returned an invalid verdict.",
    });
  });

  it("rejects confidence < 0", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.PASSED,
      confidence: -0.1,
      feedback: "Some feedback",
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_EVALUATION,
      message: "JEV returned an invalid confidence value.",
    });
  });

  it("rejects confidence > 1", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.PASSED,
      confidence: 1.05,
      feedback: "Some feedback",
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });
    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_EVALUATION,
      message: "JEV returned an invalid confidence value.",
    });
  });

  it("rejects missing question", async () => {
    const evaluator = new JevEvaluator({ generateEvaluation: jest.fn() });

    await expect(
      evaluator.evaluate({
        checkpoint: { ...baseCheckpoint, question: null },
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_CHECKPOINT,
      message: "Checkpoint question is required.",
    });

    await expect(
      evaluator.evaluate({
        checkpoint: { ...baseCheckpoint, question: "   " },
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_CHECKPOINT,
      message: "Checkpoint question is required.",
    });
  });

  it("rejects missing evaluationSpec", async () => {
    const evaluator = new JevEvaluator({ generateEvaluation: jest.fn() });

    await expect(
      evaluator.evaluate({
        checkpoint: { question: "What is an index?", evaluationSpec: null },
        userAnswer: validAnswer,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.MISSING_EVALUATION_SPEC,
      message: "Checkpoint evaluationSpec is required.",
    });
  });

  it("rejects empty answer", async () => {
    const evaluator = new JevEvaluator({ generateEvaluation: jest.fn() });

    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: "",
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_ANSWER,
      message: "User answer is required.",
    });

    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: "    ",
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_ANSWER,
      message: "User answer is required.",
    });

    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: null,
      }),
    ).rejects.toMatchObject({
      code: JEV_ERROR.INVALID_ANSWER,
      message: "User answer is required.",
    });
  });

  it("model receives only required evaluation context", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      verdict: VERDICT.PASSED,
      confidence: 0.9,
      feedback: "Great explanation.",
    });

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });

    // Checkpoint with extraneous metadata that JEV should not pass down
    const richCheckpoint = {
      ...baseCheckpoint,
      chatHistory: [{ role: "user", content: "hello" }],
      workflowId: "wf-123",
      otherState: { foo: "bar" },
    };

    await evaluator.evaluate({
      checkpoint: richCheckpoint,
      userAnswer: "   " + validAnswer + "   ",
    });

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      question: baseCheckpoint.question,
      evaluationSpec: baseCheckpoint.evaluationSpec,
      userAnswer: validAnswer,
    });

    const invocationArgs = mockGenerate.mock.calls[0][0];
    expect(Object.keys(invocationArgs)).toEqual(["question", "evaluationSpec", "userAnswer"]);
  });

  it("model failure propagates cleanly", async () => {
    const upstreamError = new Error("LLM provider rate limit exceeded");
    const mockGenerate = jest.fn().mockRejectedValue(upstreamError);

    const evaluator = new JevEvaluator({ generateEvaluation: mockGenerate });

    await expect(
      evaluator.evaluate({
        checkpoint: baseCheckpoint,
        userAnswer: validAnswer,
      }),
    ).rejects.toThrow("LLM provider rate limit exceeded");
  });
});
