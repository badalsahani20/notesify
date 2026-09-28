import { describe, it, expect } from "@jest/globals";
import { getChatTools } from "../../src/services/ai/tools/chatTools.js";

describe("getChatTools", () => {
  const getToolNames = (tools) => tools.map((t) => t.function.name);

  it("includes workflow tools and base tools in casual mode", () => {
    const tools = getChatTools("casual");
    const names = getToolNames(tools);

    // Workflow tools are globally available
    expect(names).toContain("create_workflow");
    expect(names).toContain("list_workflows");
    expect(names).toContain("get_workflow");
    expect(names).toContain("delete_workflow");
    expect(names).toContain("transition_workflow");

    // Standard tools
    expect(names).toContain("save_memory");
    expect(names).toContain("get_note_content");
    expect(names).toContain("create_note");
    expect(names).toContain("update_note");
    expect(names).toContain("ask_question");
  });

  it("includes workflow tools and base tools in study mode", () => {
    const tools = getChatTools("study");
    const names = getToolNames(tools);

    expect(names).toContain("create_workflow");
    expect(names).toContain("list_workflows");
    expect(names).toContain("get_workflow");
    expect(names).toContain("delete_workflow");
    expect(names).toContain("transition_workflow");
    expect(names).toContain("ask_question");
  });

  it("excludes create_note when isNoteScoped is true, but retains workflow tools", () => {
    const tools = getChatTools("casual", { isNoteScoped: true });
    const names = getToolNames(tools);

    expect(names).not.toContain("create_note");
    expect(names).toContain("get_note_content");
    expect(names).toContain("update_note");
    expect(names).toContain("create_workflow");
    expect(names).toContain("transition_workflow");
  });
});
