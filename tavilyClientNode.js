const path = require("path");

const TAVILY_URL = "https://api.tavily.com/search";

/**
 * Node client for Tavily, mirroring the Python tavily_search behavior.
 * Returns: [{ title, url, published, content, source }]
 */
async function fetchFromTavily(topic, maxResults = 5) {
  let key = (process.env.TAVILY_API_KEY || "").trim();
  if (!key) {
    try {
      require("dotenv").config({ path: path.join(__dirname, ".env") });
      key = (process.env.TAVILY_API_KEY || "").trim();
    } catch (_) {}
  }

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

  // Prefer recent news/incidents over definitions (e.g. "latest earthquake news" not "earthquake")
  const newsQuery =
    topic === "earthquake" ? "latest earthquake news today magnitude" :
    topic === "flood" ? "latest flood news today" :
    topic === "cyber_attack" || topic === "power_outage" ? `latest ${topic.replace("_", " ")} news today` :
    `latest ${topic} news incidents today`;
  const query = newsQuery;

  const payload = {
    query,
    search_depth: "advanced",
    max_results: maxResults,
  };

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
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

