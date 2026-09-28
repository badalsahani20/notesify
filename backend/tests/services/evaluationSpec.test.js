import { describe, it, expect } from "@jest/globals";
import { normalizeEvaluationSpec } from "../../src/services/ai/workflow/domain/evaluationSpec.js";

describe("normalizeEvaluationSpec", () => {
  it("normalizes a full valid evaluation spec", () => {
    const raw = {
      expectedAnswer: "An index in MongoDB is a data structure that improves the speed of data retrieval.",
      keyConcepts: ["B-tree", "query performance", "index scan"],
      rubric: [
        { criterion: "Explains what an index is", weight: 0.6 },
        { criterion: "Mentions performance impact", weight: 0.4 },
      ],
      commonMisconceptions: [
        "Indexes speed up write operations",
        "Indexes do not consume memory",
      ],
    };

    const normalized = normalizeEvaluationSpec(raw);

    expect(normalized).toEqual({
      expectedAnswer: "An index in MongoDB is a data structure that improves the speed of data retrieval.",
      keyConcepts: ["B-tree", "query performance", "index scan"],
      rubric: [
        { criterion: "Explains what an index is", weight: 0.6 },
        { criterion: "Mentions performance impact", weight: 0.4 },
      ],
      commonMisconceptions: [
        "Indexes speed up write operations",
        "Indexes do not consume memory",
      ],
    });
  });

  it("defaults missing or empty fields safely", () => {
    const normalized = normalizeEvaluationSpec({});

    expect(normalized).toEqual({
      expectedAnswer: null,
      keyConcepts: [],
      rubric: [],
      commonMisconceptions: [],
    });
  });

  it("returns null when spec is not an object", () => {
    expect(normalizeEvaluationSpec(null)).toBeNull();
    expect(normalizeEvaluationSpec(undefined)).toBeNull();
    expect(normalizeEvaluationSpec("invalid")).toBeNull();
    expect(normalizeEvaluationSpec(42)).toBeNull();
  });

  it("trims strings and defaults rubric weight to 1 if not a valid number", () => {
    const raw = {
      expectedAnswer: "  Valid Answer  ",
      keyConcepts: ["  Concept A  ", ""],
      rubric: [
        { criterion: "Criterion 1" },
        { criterion: "Criterion 2", weight: "not-a-number" },
      ],
      commonMisconceptions: ["  Misconception 1  "],
    };

    const normalized = normalizeEvaluationSpec(raw);

    expect(normalized.expectedAnswer).toBe("Valid Answer");
    expect(normalized.keyConcepts).toEqual(["Concept A"]);
    expect(normalized.rubric).toEqual([
      { criterion: "Criterion 1", weight: 1 },
      { criterion: "Criterion 2", weight: 1 },
    ]);
    expect(normalized.commonMisconceptions).toEqual(["Misconception 1"]);
  });
});
