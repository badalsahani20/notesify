import { describe, expect, it } from "vitest";
import { normalizeIrisDirectives } from "./irisMarkdown";

describe("normalizeIrisDirectives", () => {
  it("converts supported callouts and takeaways into semantic elements", () => {
    const result = normalizeIrisDirectives(
      "Before\n\n:::insight Core idea\nThe boundary stays the same.\n:::\n\n:::takeaway\nRemember this.\n:::\n\nAfter",
    );

    expect(result).toContain('<iris-callout data-variant="insight" data-title="Core idea">');
    expect(result).toContain("<iris-takeaway>");
    expect(result).toContain("The boundary stays the same.");
    expect(result).toContain("After");
  });

  it("does not transform directives inside fenced code", () => {
    const result = normalizeIrisDirectives("```md\n:::insight\nnot a callout\n:::\n```");

    expect(result).not.toContain("<iris-callout");
    expect(result).toContain(":::insight");
  });

  it("leaves an incomplete streaming directive untouched", () => {
    const result = normalizeIrisDirectives(":::warning\nStill arriving");

    expect(result).toBe(":::warning\nStill arriving");
  });
});
