import { jest } from "@jest/globals";

const { classifyChatIntent } = await import(
  "../../src/services/ai/router/modelRouter.js"
);

const PRIMARY = "deepseek/deepseek-v4-flash-0731";
const DEFAULT_CHAT = "z-ai/glm-5.3-flash";

describe("modelRouter", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("routes research-flavoured questions to the primary model", () => {
    expect(
      classifyChatIntent("what is the latest Node.js version", null, [], "", ""),
    ).toBe(PRIMARY);
  });

  it("routes ordinary chat to the default model", () => {
    expect(
      classifyChatIntent("explain how closures work", null, [], "", ""),
    ).toBe(DEFAULT_CHAT);
  });

  it("honours an explicit tier regardless of the message", () => {
    expect(
      classifyChatIntent("what is the latest news", null, [], "", "", "fast"),
    ).toBe(DEFAULT_CHAT);
  });

  it("routes an attached image to the default chat model", () => {
    expect(
      classifyChatIntent(
        "what is this",
        "data:image/png;base64,abc",
        [],
        "",
        "",
      ),
    ).toBe(DEFAULT_CHAT);
  });
});
