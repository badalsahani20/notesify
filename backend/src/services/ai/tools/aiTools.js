export const performWebSearch = async (query) => {
  try {
    if (!process.env.TAVILY_API) return "";
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API,
        query: query,
        include_answer: true,
        max_results: 3,
      }),
    });
    const data = await response.json();
    if (!data.results) return "No results found";

    return data.results
      .map((r) => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`)
      .join("\n\n");
  } catch (error) {
    console.error("Tavily Search Error:", error);
    return "Failed to search the web";
  }
};

export const crawlUrl = async (url) => {
  try {
    if (!process.env.JINA_API) return "";
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${process.env.JINA_API}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();
    return data.data?.content || data.content || "No content found.";
  } catch (error) {
    console.error("Jina Crawl Error", error);
    return "Failed to crawl URL.";
  }
};

export const detectTools = async (message) => {
  const urlMatch = message.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return { tool: "crawl_url", query: urlMatch[0] };
  }
  return { tool: "search_web", query: message };
};
