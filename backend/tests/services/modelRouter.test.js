import { jest } from "@jest/globals";
import { DEFAULT_CHAT_MODEL, DEFAULT_CHAT_MODEL_II } from "../../src/services/ai/config/aiModels.js";

const { classifyChatIntent } = await import(
  "../../src/services/ai/router/modelRouter.js"
);

const DEFAULT_CHAT = DEFAULT_CHAT_MODEL || "z-ai/glm-5.3-flash";
const FAST_CHAT = DEFAULT_CHAT_MODEL_II || DEFAULT_CHAT;

describe("modelRouter", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("routes ordinary chat to the default model", () => {
    expect(
      classifyChatIntent("explain how closures work", null, [], "", ""),
    ).toBe(DEFAULT_CHAT);
  });

  it("honours fast tier without image by routing to fast chat model", () => {
    expect(
      classifyChatIntent("what is the latest news", null, [], "", "", "fast"),
    ).toBe(FAST_CHAT);
  });

  it("routes fast tier with an attached image to the vision model", () => {
    expect(
      classifyChatIntent(
        "what is in this picture",
        "data:image/png;base64,abc",
        [],
        "",
        "",
        "fast",
      ),
    ).toBe(DEFAULT_CHAT);
  });

  it("routes an attached image to the default chat model when no tier is passed", () => {
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
