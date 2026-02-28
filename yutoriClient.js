/**
 * Yutori Scout API: https://api.yutori.com
 * Auth: X-API-Key
 * To get immediate results, set YUTORI_SCOUT_ID in .env to an existing scout's UUID (from Yutori dashboard).
 * Otherwise we can create a scout (results come later on interval) or skip.
 */
const YUTORI_BASE = "https://api.yutori.com/v1";
const KEY = (process.env.YUTORI_API_KEY || "").trim();

function getHeaders() {
  if (!KEY) return null;
  return {
    "X-API-Key": KEY,
    "Content-Type": "application/json",
  };
}

/**
 * Fetch latest updates from an existing scout. Returns articles in our shape.
 * Set YUTORI_SCOUT_ID in .env to the scout's UUID (from Yutori dashboard URL or API).
 */
async function fetchFromYutori(topic, maxResults = 5) {
  const scoutId = (process.env.YUTORI_SCOUT_ID || "").trim();
  const headers = getHeaders();

  if (!headers || !scoutId) {
    return []; // no key or no scout → no Yutori results (avoids [SIM])
  }

  try {
    const url = `${YUTORI_BASE}/scouting/tasks/${scoutId}/updates?page_size=${Math.max(maxResults, 10)}`;
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Yutori HTTP ${res.status}: ${t}`);
    }
    const data = await res.json();
    const updates = data.updates || [];

    const now = new Date().toISOString();
    return updates.slice(0, maxResults).map((u) => {
      const title = u.content?.slice(0, 120).trim() || "Yutori update";
      const url = u.citations?.[0]?.url || "";
      return {
        title: title.length >= 120 ? title + "…" : title,
        url,
        published: u.timestamp ? new Date(u.timestamp * 1000).toISOString() : now,
        content: u.content || "",
        source: "yutori",
      };
    });
  } catch (err) {
    console.error("Yutori fetch failed:", err.message);
    return [];
  }
}

module.exports = {
  fetchFromYutori,
};
