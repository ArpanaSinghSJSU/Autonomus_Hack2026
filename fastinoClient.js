const FASTINO_API_URL = process.env.FASTINO_API_URL || "";
const FASTINO_API_KEY = process.env.FASTINO_API_KEY || "";

function buildArticlesBlock(articles) {
  return (articles || [])
    .map(
      (a, idx) =>
        `[${idx + 1}] Title: ${a.title}\nURL: ${a.url}\nTime: ${a.time}\nContent: ${a.content}\n`
    )
    .join("\n");
}

async function extractIncidentWithFastino(articles, topic) {
  if (!FASTINO_API_URL || !FASTINO_API_KEY) {
    throw new Error("FASTINO_API_URL or FASTINO_API_KEY not set");
  }

  const articlesBlock = buildArticlesBlock(articles);

  const systemPrompt = `
You are an information extraction engine for crisis events.
Extract a SINGLE incident object from the given news text.

Only output valid JSON matching exactly this schema:
{
  "event": "string, short event type e.g. earthquake, flood, cyber_attack",
  "location": "string: place name (e.g. Japan, California) OR 'lat,long' (e.g. 35.67,139.65) if coordinates appear in text",
  "orgs": ["array of organizations mentioned"],
  "severity_cues": ["array of phrases indicating severity"],
  "time_window": "ISO8601-ish text summarizing when (e.g. '2026-02-27T10:00Z' or 'early morning')",
  "summary": "2-3 sentence plain English summary",
  "raw_sources": [
    {
      "title": "source title",
      "url": "https://...",
      "reported_at": "timestamp or null"
    }
  ]
}
`.trim();

  const userPrompt = `
Topic: ${topic}

News articles:
${articlesBlock}

From this input, extract a single incident object in the JSON format described in the system prompt.
`.trim();

  const response = await fetch(FASTINO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FASTINO_API_KEY}`,
    },
    body: JSON.stringify({
      system: systemPrompt,
      input: userPrompt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fastino HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Expect Fastino to return JSON text in data.output or similar.
  const raw = typeof data === "string" ? data : data.output || data.result || data;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("Fastino response was not valid JSON");
    }
  }

  return raw;
}

module.exports = {
  extractIncidentWithFastino,
};

