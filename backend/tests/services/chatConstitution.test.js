import { describe, it, expect } from "@jest/globals";
import {
  buildBaseConstitution,
  workflowRules,
} from "../../src/services/ai/chatService.js";

describe("Chat Constitution & Workflow Rules", () => {
  it("includes the WORKFLOW RULES section in buildBaseConstitution for casual mode", () => {
    const constitution = buildBaseConstitution(false, "casual");

    expect(constitution).toContain("WORKFLOW RULES");
    expect(constitution).toContain("Use workflow tools for persistent, structured learning tasks.");
    expect(constitution).toContain("Do not create a workflow for ordinary questions or explanations.");
    expect(constitution).toContain("Use an existing workflow when the user clearly refers to it.");
    expect(constitution).toContain("Never invent workflowId or expectedVersion; use the latest known state.");
    expect(constitution).toContain("After a successful transition, use the returned version.");
    expect(constitution).toContain("If multiple workflows could match and the user is unclear, ask which one.");
    expect(constitution).toContain("Fetch the full workflow before mutating it when the available context is insufficient.");
    expect(constitution).toContain("Present a checkpoint by creating it in the workflow before asking the user the question.");
    expect(constitution).toContain("Use ask_question to present the checkpoint to the user.");
    expect(constitution).toContain("Submit the user's checkpoint answer through transition_workflow.");
    expect(constitution).toContain("Do not evaluate an answer yourself; let the workflow evaluator handle it.");
  });

  it("includes the WORKFLOW RULES section in buildBaseConstitution for study mode", () => {
    const constitution = buildBaseConstitution(false, "study");

    expect(constitution).toContain("WORKFLOW RULES");
    expect(constitution).toContain("Use workflow tools for persistent, structured learning tasks.");
  });

  it("includes the WORKFLOW RULES section in note-scoped mode", () => {
    const constitution = buildBaseConstitution(true, "casual");

    expect(constitution).toContain("WORKFLOW RULES");
  });

  it("exports workflowRules text", () => {
    expect(workflowRules).toContain("WORKFLOW RULES");
  });
});
