/**
 * Provider-agnostic web search.
 *
 * Configured providers are tried in order until one returns usable results.
 * Missing keys, timeouts, HTTP errors, and empty result sets all fall through
 * to the next provider. A total failure returns an empty array so the caller
 * can degrade to OpenRouter's built-in search or answer without web context.
 *
 * Selection:
 *   SEARCH_PROVIDER=exa|parallel  -> use that provider only
 *   SEARCH_PROVIDER=openrouter    -> disable this adapter
 *   unset                         -> use every provider with a key,
 *                                    in PROVIDER_ORDER
 */

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 5;
const MAX_SNIPPET_CHARS = 600;

const PROVIDER_ORDER = ["exa", "parallel"];

const clipText = (value, max = MAX_SNIPPET_CHARS) => {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const fetchJson = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 1. Exa — semantic retrieval. Content controls must live under `contents`.
const searchExa = async (query, { limit, timeoutMs }) => {
  const data = await fetchJson(
    "https://api.exa.ai/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: limit,
        contents: { highlights: true },
      }),
    },
    timeoutMs,
  );

  return (data.results || []).map((item) => {
    const highlights = Array.isArray(item.highlights)
      ? item.highlights.join(" ")
      : "";
    return {
      title: clipText(item.title, 200) || "Untitled source",
      url: item.url,
      snippet: clipText(item.text || highlights),
      source: "exa",
    };
  });
};

// 2. Parallel — v1 Search API. `search_queries` is required on /v1.
const searchParallel = async (query, { limit, timeoutMs }) => {
  const data = await fetchJson(
    "https://api.parallel.ai/v1/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.PARALLEL_API_KEY,
      },
      body: JSON.stringify({
        search_queries: [query],
        mode: "fast",
        max_chars_total: 6000,
        advanced_settings: { max_results: limit },
      }),
    },
    timeoutMs,
  );

  return (data.results || []).map((item) => {
    const excerpts = Array.isArray(item.excerpts) ? item.excerpts.join(" ") : "";
    return {
      title: clipText(item.title, 200) || "Untitled source",
      url: item.url,
      snippet: clipText(excerpts),
      source: "parallel",
    };
  });
};

const PROVIDERS = {
  exa: { name: "exa", keyEnv: "EXA_API_KEY", search: searchExa },
  parallel: {
    name: "parallel",
    keyEnv: "PARALLEL_API_KEY",
    search: searchParallel,
  },
};

export const getSearchProviderName = () =>
  (process.env.SEARCH_PROVIDER || "").trim().toLowerCase();

export const getConfiguredProviders = () =>
  PROVIDER_ORDER.filter((name) => Boolean(process.env[PROVIDERS[name].keyEnv]));

export const isLocalSearchConfigured = () => {
  const pinned = getSearchProviderName();
  if (pinned === "openrouter") return false;
  if (pinned) {
    const provider = PROVIDERS[pinned];
    return Boolean(provider && process.env[provider.keyEnv]);
  }
  return getConfiguredProviders().length > 0;
};

const getCandidateProviders = () => {
  const pinned = getSearchProviderName();
  if (pinned === "openrouter") return [];

  if (pinned) {
    const provider = PROVIDERS[pinned];
    if (!provider) {
      console.warn(`🔎 [SearchAdapter] Unknown SEARCH_PROVIDER "${pinned}".`);
      return [];
    }
    return process.env[provider.keyEnv] ? [provider] : [];
  }

  return getConfiguredProviders().map((name) => PROVIDERS[name]);
};

const normalizeResults = (results, limit) => {
  const seen = new Set();
  const normalized = [];

  for (const result of results) {
    if (!result?.url || seen.has(result.url)) continue;
    seen.add(result.url);
    normalized.push(result);
    if (normalized.length >= limit) break;
  }

  return normalized;
};

/**
 * @returns {Promise<Array<{title: string, url: string, snippet: string, source: string}>>}
 *   Never throws. Returns [] when nothing is configured or every provider fails.
 */
export const searchWeb = async (
  query,
  { limit = DEFAULT_LIMIT, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) => {
  const cleanQuery = typeof query === "string" ? query.trim() : "";
  if (!cleanQuery) return [];

  const candidates = getCandidateProviders();
  if (candidates.length === 0) return [];

  for (const provider of candidates) {
    try {
      const results = await provider.search(cleanQuery, { limit, timeoutMs });
      const normalized = normalizeResults(results, limit);

      if (normalized.length > 0) {
        console.log(
          `🔎 [SearchAdapter] ${provider.name} returned ${normalized.length} result(s).`,
        );
        return normalized;
      }

      console.warn(
        `🔎 [SearchAdapter] ${provider.name} returned no usable results.`,
      );
    } catch (error) {
      console.warn(`🔎 [SearchAdapter] ${provider.name} failed: ${error.message}`);
    }
  }

  return [];
};
