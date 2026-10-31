import { jest } from "@jest/globals";

const ENV_KEYS = [
  "EXA_API_KEY",
  "EXA_API_KEYS",
  "EXA_API_KEY_2",
  "EXA_API_KEY_3",
  "PARALLEL_API_KEY",
  "PARALLEL_API_KEYS",
  "PARALLEL_API_KEY_2",
  "SEARCH_PROVIDER",
];

const {
  searchWeb,
  isLocalSearchConfigured,
  getConfiguredProviders,
  getProviderKeys,
  resetSearchAdapterState,
} = await import("../../src/services/ai/search/searchAdapter.js");

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("searchAdapter", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetSearchAdapterState();
    global.fetch = jest.fn();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("returns no results and makes no request when nothing is configured", async () => {
    await expect(searchWeb("anything")).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(isLocalSearchConfigured()).toBe(false);
    expect(getConfiguredProviders()).toEqual([]);
  });

  it("is disabled when SEARCH_PROVIDER=openrouter even with a key", () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.SEARCH_PROVIDER = "openrouter";

    expect(isLocalSearchConfigured()).toBe(false);
  });

  it("auto-detects configured providers in priority order", () => {
    process.env.PARALLEL_API_KEY = "p";
    process.env.EXA_API_KEY = "e";

    expect(getConfiguredProviders()).toEqual(["exa", "parallel"]);
    expect(isLocalSearchConfigured()).toBe(true);
  });

  it("ignores a pinned provider that no longer exists", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.SEARCH_PROVIDER = "brave";

    expect(isLocalSearchConfigured()).toBe(false);
    await expect(searchWeb("anything")).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses Exa with contents.highlights and no deprecated params", async () => {
    process.env.EXA_API_KEY = "exa-key";
    global.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          {
            title: "Exa result",
            url: "https://example.com/b",
            highlights: ["Exa highlight"],
          },
        ],
      }),
    );

    const results = await searchWeb("semantic query");

    expect(results[0]).toMatchObject({
      url: "https://example.com/b",
      snippet: "Exa highlight",
      source: "exa",
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.exa.ai/search");

    const body = JSON.parse(options.body);
    expect(body.contents).toEqual({ highlights: true });
    expect(body.useAutoprompt).toBeUndefined();
    expect(body.text).toBeUndefined();
  });

  it("uses Parallel v1 search_queries", async () => {
    process.env.PARALLEL_API_KEY = "parallel-key";
    global.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          {
            title: "Parallel result",
            url: "https://example.com/c",
            excerpts: ["Excerpt one", "Excerpt two"],
          },
        ],
      }),
    );

    const results = await searchWeb("agent query");

    expect(results[0]).toMatchObject({
      url: "https://example.com/c",
      source: "parallel",
    });
    expect(results[0].snippet).toContain("Excerpt one");

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.parallel.ai/v1/search");

    const body = JSON.parse(options.body);
    expect(body.search_queries).toEqual(["agent query"]);
    expect(body.mode).toBe("fast");
  });

  it("falls through to the next provider when one returns nothing", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.PARALLEL_API_KEY = "parallel-key";

    global.fetch
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              title: "Parallel fallback",
              url: "https://example.com/d",
              excerpts: ["fallback"],
            },
          ],
        }),
      );

    const results = await searchWeb("fallback");

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("parallel");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("skips a provider that returns an HTTP error", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.PARALLEL_API_KEY = "parallel-key";

    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({ error: "rate limited" }, { ok: false, status: 429 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              title: "Parallel",
              url: "https://example.com/e",
              excerpts: ["ok"],
            },
          ],
        }),
      );

    const results = await searchWeb("rate limited");

    expect(results[0].source).toBe("parallel");
  });

  it("dedupes repeated URLs", async () => {
    process.env.EXA_API_KEY = "exa-key";
    global.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          { title: "One", url: "https://example.com/x", highlights: ["a"] },
          {
            title: "One again",
            url: "https://example.com/x",
            highlights: ["b"],
          },
        ],
      }),
    );

    const results = await searchWeb("dupes");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("One");
  });

  it("returns an empty list instead of throwing when every provider fails", async () => {
    process.env.EXA_API_KEY = "exa-key";
    global.fetch.mockRejectedValue(new Error("network down"));

    await expect(searchWeb("offline")).resolves.toEqual([]);
  });

  it("returns an empty list for a blank query", async () => {
    process.env.EXA_API_KEY = "exa-key";

    await expect(searchWeb("   ")).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("respects a pinned SEARCH_PROVIDER", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.PARALLEL_API_KEY = "parallel-key";
    process.env.SEARCH_PROVIDER = "parallel";

    global.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          {
            title: "Parallel only",
            url: "https://example.com/f",
            excerpts: ["x"],
          },
        ],
      }),
    );

    const results = await searchWeb("pinned");

    expect(results[0].source).toBe("parallel");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.parallel.ai/v1/search");
  });

  describe("key rotation", () => {
    const exaOk = (url = "https://example.com/ok") =>
      jsonResponse({
        results: [{ title: "Exa", url, highlights: ["ok"] }],
      });

    const keyOfCall = (index) =>
      global.fetch.mock.calls[index][1].headers["x-api-key"];

    it("collects numbered slots and comma-separated lists, deduped and trimmed", () => {
      process.env.EXA_API_KEY = " k1 ";
      process.env.EXA_API_KEY_2 = "k2";
      process.env.EXA_API_KEYS = "k3, k1";

      expect(getProviderKeys({ keyEnv: "EXA_API_KEY" })).toEqual([
        "k1",
        "k3",
        "k2",
      ]);
    });

    it("rotates to the next key when the first is rate-limited", async () => {
      process.env.EXA_API_KEY = "k1";
      process.env.EXA_API_KEY_2 = "k2";

      global.fetch
        .mockResolvedValueOnce(
          jsonResponse({ error: "quota" }, { ok: false, status: 429 }),
        )
        .mockResolvedValueOnce(exaOk());

      const results = await searchWeb("rotate");

      expect(results[0].source).toBe("exa");
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(keyOfCall(0)).toBe("k1");
      expect(keyOfCall(1)).toBe("k2");
    });

    it("rotates on an invalid key (401)", async () => {
      process.env.EXA_API_KEY = "bad";
      process.env.EXA_API_KEY_2 = "good";

      global.fetch
        .mockResolvedValueOnce(
          jsonResponse({ error: "unauthorized" }, { ok: false, status: 401 }),
        )
        .mockResolvedValueOnce(exaOk());

      await searchWeb("rotate on 401");

      expect(keyOfCall(1)).toBe("good");
    });

    it("starts from the last working key on the next request", async () => {
      process.env.EXA_API_KEY = "k1";
      process.env.EXA_API_KEY_2 = "k2";

      global.fetch
        .mockResolvedValueOnce(
          jsonResponse({ error: "quota" }, { ok: false, status: 429 }),
        )
        .mockResolvedValueOnce(exaOk())
        .mockResolvedValueOnce(exaOk("https://example.com/second"));

      await searchWeb("first");
      await searchWeb("second");

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(keyOfCall(2)).toBe("k2");
    });

    it("does not rotate on a network error", async () => {
      process.env.EXA_API_KEY = "k1";
      process.env.EXA_API_KEY_2 = "k2";

      global.fetch.mockRejectedValue(new Error("ECONNRESET"));

      await expect(searchWeb("offline")).resolves.toEqual([]);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("moves to the next provider when every key is exhausted", async () => {
      process.env.EXA_API_KEY = "k1";
      process.env.EXA_API_KEY_2 = "k2";
      process.env.PARALLEL_API_KEY = "p1";

      global.fetch
        .mockResolvedValueOnce(
          jsonResponse({ error: "quota" }, { ok: false, status: 429 }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ error: "quota" }, { ok: false, status: 402 }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            results: [
              {
                title: "Parallel",
                url: "https://example.com/p",
                excerpts: ["ok"],
              },
            ],
          }),
        );

      const results = await searchWeb("all keys spent");

      expect(results[0].source).toBe("parallel");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("ignores blank keys when deciding whether a provider is configured", () => {
      process.env.EXA_API_KEY = "   ";
      process.env.EXA_API_KEY_2 = "k2";

      expect(isLocalSearchConfigured()).toBe(true);
      expect(getConfiguredProviders()).toEqual(["exa"]);
    });
  });
});
