const { fetchFromTavily } = require("./tavilyClientNode");
const { fetchFromYutori } = require("./yutoriClient");

/**
 * Fetch and aggregate news articles from Tavily (primary) and Yutori (secondary).
 * Returns a normalized list:
 * [{ title, content, url, time }]
 */
async function fetchNews(topic, maxResults = 5) {
  const articles = [];

  try {
    const tavily = await fetchFromTavily(topic, maxResults);
    articles.push(
      ...tavily.map((a) => ({
        title: a.title,
        content: a.content,
        url: a.url,
        time: a.published,
        source: a.source || "tavily",
      }))
    );
  } catch (err) {
    console.error("Tavily fetch failed (check key + https://api.tavily.com):", err.message);
  }

  try {
    const yutori = await fetchFromYutori(topic, 3);
    articles.push(
      ...yutori.map((a) => ({
        title: a.title,
        content: a.content,
        url: a.url,
        time: a.published,
        source: a.source || "yutori",
      }))
    );
  } catch (err) {
    console.error("Yutori fetch failed (simulated or real):", err.message);
  }

  // If everything failed, return a minimal simulated article so the pipeline still works.
  if (articles.length === 0) {
    const now = new Date().toISOString();
    return [
      {
        title: `[SIM] No real news for ${topic}`,
        content: `Simulated article because external APIs were not available for topic: ${topic}.`,
        url: "https://example.com/simulated-news",
        time: now,
        source: "simulated",
      },
    ];
  }

  return articles;
}

module.exports = {
  fetchNews,
};

