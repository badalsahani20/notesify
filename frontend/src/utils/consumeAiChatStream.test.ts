import { describe, expect, it } from "vitest";
import { consumeAiChatStream } from "./consumeAiChatStream";

const encoder = new TextEncoder();

const sseContent = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

const makeStream = (payloads: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });

describe("consumeAiChatStream", () => {
  it("reveals incrementally while keeping every snapshot a prefix of the final text", async () => {
    const chunks = ["Hello", " there", ", how", " can", " I", " help", " you?"];
    const snapshots: string[] = [];

    const result = await consumeAiChatStream(
      makeStream(chunks.map((chunk) => sseContent(chunk))),
      { onUpdate: ({ fullText }) => snapshots.push(fullText) },
    );

    const expected = chunks.join("");
    expect(result.fullText).toBe(expected);
    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < snapshots.length; i++) {
      expect(expected.startsWith(snapshots[i])).toBe(true);
      if (i > 0) {
        expect(snapshots[i].length).toBeGreaterThanOrEqual(snapshots[i - 1].length);
      }
    }

    expect(snapshots.at(-1)).toBe(expected);
  });

  it("does not dump a whole burst into the first update", async () => {
    const burst = "a".repeat(200);
    const snapshots: string[] = [];

    const result = await consumeAiChatStream(makeStream([sseContent(burst)]), {
      onUpdate: ({ fullText }) => snapshots.push(fullText),
    });

    expect(result.fullText).toBe(burst);
    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots[0].length).toBeLessThan(burst.length);
    expect(snapshots.at(-1)).toBe(burst);
  });

  it("keeps reasoning content separate from the visible text", async () => {
    const stream = makeStream([
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "thinking..." } }] })}\n\n`,
      sseContent("Answer"),
    ]);
    const snapshots: Array<{ text: string; thought: string; isThinking: boolean }> = [];

    const result = await consumeAiChatStream(stream, {
      onUpdate: ({ fullText, fullThought, isThinking }) =>
        snapshots.push({ text: fullText, thought: fullThought, isThinking }),
    });

    expect(result.fullText).toBe("Answer");
    expect(result.fullThought).toBe("thinking...");
    // Reasoning never leaks into the visible text, and both streams only ever
    // expose prefixes of their final content.
    for (const snapshot of snapshots) {
      expect("thinking...".startsWith(snapshot.thought)).toBe(true);
      expect("Answer".startsWith(snapshot.text)).toBe(true);
    }
    expect(snapshots.at(-1)).toMatchObject({
      text: "Answer",
      thought: "thinking...",
      isThinking: false,
    });
  });

  it("reveals a reasoning burst progressively instead of dumping it at once", async () => {
    const burst = "r".repeat(200);
    const snapshots: string[] = [];
    const stream = makeStream([
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning: burst } }] })}\n\n`,
    ]);

    const result = await consumeAiChatStream(stream, {
      onUpdate: ({ fullThought }) => snapshots.push(fullThought),
    });

    expect(result.fullThought).toBe(burst);
    expect(result.fullText).toBe("");
    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots[0].length).toBeLessThan(burst.length);
    expect(snapshots.at(-1)).toBe(burst);
  });

  it("rejects on an SSE error event and still publishes partial text", async () => {
    const snapshots: string[] = [];
    const stream = makeStream([
      sseContent("partial"),
      `data: ${JSON.stringify({ type: "error", message: "boom" })}\n\n`,
    ]);

    await expect(
      consumeAiChatStream(stream, { onUpdate: ({ fullText }) => snapshots.push(fullText) }),
    ).rejects.toThrow("boom");

    expect(snapshots.at(-1)).toBe("partial");
  });
});
