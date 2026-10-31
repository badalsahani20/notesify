import { jest } from "@jest/globals";

const ENV_KEYS = [
  "BRAVE_API_KEY",
  "EXA_API_KEY",
  "PARALLEL_API_KEY",
  "SEARCH_PROVIDER",
];

const {
  searchWeb,
  isLocalSearchConfigured,
  getConfiguredProviders,
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
    process.env.BRAVE_API_KEY = "brave-key";
    process.env.SEARCH_PROVIDER = "openrouter";

    expect(isLocalSearchConfigured()).toBe(false);
  });

  it("auto-detects configured providers in priority order", () => {
    process.env.PARALLEL_API_KEY = "p";
    process.env.BRAVE_API_KEY = "b";

    expect(getConfiguredProviders()).toEqual(["brave", "parallel"]);
    expect(isLocalSearchConfigured()).toBe(true);
  });

  it("uses the Brave endpoint and subscription header", async () => {
    process.env.BRAVE_API_KEY = "brave-key";
    global.fetch.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            {
              title: "Brave result",
              url: "https://example.com/a",
              description: "Snippet A",
            },
          ],
        },
      }),
    );

    const results = await searchWeb("test query");

    expect(results).toEqual([
      {
        title: "Brave result",
        url: "https://example.com/a",
        snippet: "Snippet A",
        source: "brave",
      },
    ]);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("https://api.search.brave.com/res/v1/web/search");
    expect(url).toContain("q=test+query");
    expect(options.headers["X-Subscription-Token"]).toBe("brave-key");
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
    process.env.BRAVE_API_KEY = "brave-key";
    process.env.EXA_API_KEY = "exa-key";

    global.fetch
      .mockResolvedValueOnce(jsonResponse({ web: { results: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              title: "Exa fallback",
              url: "https://example.com/d",
              highlights: ["fallback"],
            },
          ],
        }),
      );

    const results = await searchWeb("fallback");

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("exa");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("skips a provider that returns an HTTP error", async () => {
    process.env.BRAVE_API_KEY = "brave-key";
    process.env.EXA_API_KEY = "exa-key";

    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({ error: "rate limited" }, { ok: false, status: 429 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            { title: "Exa", url: "https://example.com/e", highlights: ["ok"] },
          ],
        }),
      );

    const results = await searchWeb("rate limited");

    expect(results[0].source).toBe("exa");
  });

  it("dedupes repeated URLs", async () => {
    process.env.BRAVE_API_KEY = "brave-key";
    global.fetch.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            { title: "One", url: "https://example.com/x", description: "a" },
            { title: "One again", url: "https://example.com/x", description: "b" },
          ],
        },
      }),
    );

    const results = await searchWeb("dupes");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("One");
  });

  it("returns an empty list instead of throwing when every provider fails", async () => {
    process.env.BRAVE_API_KEY = "brave-key";
    global.fetch.mockRejectedValue(new Error("network down"));

    await expect(searchWeb("offline")).resolves.toEqual([]);
  });

  it("returns an empty list for a blank query", async () => {
    process.env.BRAVE_API_KEY = "brave-key";

    await expect(searchWeb("   ")).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("respects a pinned SEARCH_PROVIDER", async () => {
    process.env.BRAVE_API_KEY = "brave-key";
    process.env.EXA_API_KEY = "exa-key";
    process.env.SEARCH_PROVIDER = "exa";

    global.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          { title: "Exa only", url: "https://example.com/f", highlights: ["x"] },
        ],
      }),
    );

    const results = await searchWeb("pinned");

    expect(results[0].source).toBe("exa");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.exa.ai/search");
  });
});
