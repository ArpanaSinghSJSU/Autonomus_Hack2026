const TAVILY_URL = "https://api.tavily.com/search";

/**
 * Node client for Tavily, mirroring the Python tavily_search behavior.
 * Returns: [{ title, url, published, content, source }]
 */
async function fetchFromTavily(topic, maxResults = 5) {
  const key = (process.env.TAVILY_API_KEY || "").trim();

  // Simulation fallback if no key configured
  if (!key) {
    const now = new Date().toISOString();
    return Array.from({ length: 3 }).map(() => ({
      title: `[SIM] Tavily result for ${topic}`,
      url: "https://example.com/tavily",
      published: now,
      content: `Simulated Tavily content for ${topic}`,
      source: "tavily",
    }));
  }

  const payload = {
    query: topic,
    search_depth: "advanced",
    max_results: maxResults,
  };

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  const now = new Date().toISOString();

  const results = (data.results || []).slice(0, maxResults).map((item) => {
    const published =
      item.published_date || item.published_time || item.date || item.timestamp || now;
    const content = item.content || item.snippet || "";

    return {
      title: item.title || "",
      url: item.url || "",
      published,
      content,
      source: "tavily",
    };
  });

  return results;
}

module.exports = {
  fetchFromTavily,
};

