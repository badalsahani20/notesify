import { jest } from "@jest/globals";

const { fetchPage, isNativeFetchEnabled } = await import(
  "../../src/services/ai/search/webFetch.js"
);

const originalFetch = global.fetch;
const originalProvider = process.env.WEB_FETCH_PROVIDER;

const makeResponse = ({
  status = 200,
  headers = {},
  body = "",
  ok = status >= 200 && status < 300,
} = {}) => ({
  ok,
  status,
  headers: {
    get: (name) => headers[name.toLowerCase()] ?? null,
  },
  text: async () => body,
  body: null,
});

describe("webFetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    delete process.env.WEB_FETCH_PROVIDER;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.WEB_FETCH_PROVIDER;
    else process.env.WEB_FETCH_PROVIDER = originalProvider;
  });

  it("extracts the title and readable text from HTML", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        headers: { "content-type": "text/html; charset=utf-8" },
        body: `<html><head><title>Docs &amp; Guides</title>
          <style>body { color: red }</style></head>
          <body><h1>Hello</h1><p>Some   body text.</p><script>ignored()</script>
          <!-- hidden comment --></body></html>`,
      }),
    );

    const result = await fetchPage("https://example.com/docs");

    expect(result.url).toBe("https://example.com/docs");
    expect(result.title).toBe("Docs & Guides");
    expect(result.text).toContain("Hello");
    expect(result.text).toContain("Some body text.");
    expect(result.text).not.toContain("color: red");
    expect(result.text).not.toContain("ignored");
    expect(result.text).not.toContain("hidden comment");
    expect(result.error).toBeUndefined();
  });

  it("returns plain text unchanged for non-HTML content", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        headers: { "content-type": "text/plain" },
        body: "line one\n\nline two",
      }),
    );

    const result = await fetchPage("https://example.com/notes.txt");

    expect(result.text).toBe("line one line two");
    expect(result.title).toBe("example.com");
  });

  it("refuses localhost without making a request", async () => {
    const result = await fetchPage("http://localhost:5500/admin");

    expect(result.error).toContain("only public http(s) URLs");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses private IPv4 ranges", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.0.5/",
      "http://172.16.4.4/",
      "http://169.254.169.254/latest/meta-data/",
      "http://2130706433/", // decimal form of 127.0.0.1
      "http://0x7f000001/", // hex form of 127.0.0.1
    ]) {
      const result = await fetchPage(url);
      expect(result.error).toContain("only public http(s) URLs");
    }

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses private IPv6 literals", async () => {
    for (const url of [
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://[fe80::1]/",
      "http://[::ffff:127.0.0.1]/",
    ]) {
      const result = await fetchPage(url);
      expect(result.error).toContain("only public http(s) URLs");
    }

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows public 172.x addresses outside the private block", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({ headers: { "content-type": "text/plain" }, body: "ok" }),
    );

    const result = await fetchPage("http://172.32.0.1/");

    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses non-http protocols", async () => {
    const result = await fetchPage("file:///C:/Windows/win.ini");

    expect(result.error).toContain("only public http(s) URLs");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("re-validates each redirect hop and blocks private targets", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        status: 302,
        headers: { location: "http://127.0.0.1/secret" },
      }),
    );

    const result = await fetchPage("https://example.com/go");

    expect(result.error).toContain("non-public URL");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to another public URL", async () => {
    global.fetch
      .mockResolvedValueOnce(
        makeResponse({
          status: 301,
          headers: { location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          headers: { "content-type": "text/plain" },
          body: "final page",
        }),
      );

    const result = await fetchPage("https://example.com/start");

    expect(result.url).toBe("https://example.com/final");
    expect(result.text).toBe("final page");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("stops after too many redirects", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        status: 302,
        headers: { location: "https://example.com/loop" },
      }),
    );

    const result = await fetchPage("https://example.com/loop");

    expect(result.error).toContain("Too many redirects");
  });

  it("reports an HTTP error status", async () => {
    global.fetch.mockResolvedValue(makeResponse({ status: 404 }));

    const result = await fetchPage("https://example.com/missing");

    expect(result.status).toBe(404);
    expect(result.error).toContain("HTTP 404");
  });

  it("rejects binary content types", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        headers: { "content-type": "application/pdf" },
        body: "%PDF-1.7",
      }),
    );

    const result = await fetchPage("https://example.com/file.pdf");

    expect(result.error).toContain("Unsupported content type");
  });

  it("truncates long pages to the character limit", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        headers: { "content-type": "text/plain" },
        body: "a".repeat(5000),
      }),
    );

    const result = await fetchPage("https://example.com/long", {
      maxChars: 1000,
    });

    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(1001); // 1000 chars + ellipsis
    expect(result.text.endsWith("…")).toBe(true);
  });

  it("never throws when the network fails", async () => {
    global.fetch.mockRejectedValue(new Error("ECONNRESET"));

    const result = await fetchPage("https://example.com/down");

    expect(result.error).toContain("ECONNRESET");
  });

  describe("isNativeFetchEnabled", () => {
    it("is enabled by default", () => {
      expect(isNativeFetchEnabled()).toBe(true);
    });

    it("is disabled when WEB_FETCH_PROVIDER=openrouter", () => {
      process.env.WEB_FETCH_PROVIDER = " OpenRouter ";
      expect(isNativeFetchEnabled()).toBe(false);
    });
  });
});
