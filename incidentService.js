const crypto = require("crypto");
const { extractIncidentWithFastino } = require("./fastinoClient");
const { saveIncidentToGraph } = require("./neo4jClient");

function buildArticlesBlock(articles) {
  return articles
    .map(
      (a, idx) =>
        `[${idx + 1}] Title: ${a.title}\nURL: ${a.url}\nTime: ${a.time}\nContent: ${a.content}\n`
    )
    .join("\n");
}

function generateIncidentId() {
  return `incident-${crypto.randomUUID()}`;
}

async function analyzeArticlesIntoIncident(articles, topic) {
  const incidentId = generateIncidentId();

  const fastinoIncident =
    (await extractIncidentWithFastino(articles, topic).catch((err) => {
      console.error("Fastino extraction failed, falling back to heuristic:", err.message);
      return null;
    })) || buildHeuristicIncident(articles, topic);

  const incident = {
    id: incidentId,
    event: fastinoIncident.event,
    location: fastinoIncident.location,
    orgs: fastinoIncident.orgs || [],
    severity_cues: fastinoIncident.severity_cues || [],
    time_window: fastinoIncident.time_window || null,
    summary: fastinoIncident.summary,
    raw_sources: fastinoIncident.raw_sources || [],
    severity: fastinoIncident.severity || "High",
    confidence: typeof fastinoIncident.confidence === "number" ? fastinoIncident.confidence : 0.8,
    topic,
  };

  await saveIncidentToGraph(incident).catch((err) => {
    console.error("Failed to save incident to Neo4j (continuing without graph):", err.message);
  });

  return incident;
}

function buildHeuristicIncident(articles, topic) {
  const first = articles[0] || {
    title: `Mock ${topic} incident`,
    content: `A significant ${topic} event has been reported.`,
    url: "https://example.com/mock",
    time: new Date().toISOString(),
  };

  const locationGuess = guessLocationFromText(first.content) || "Unknown";

  return {
    event: topic || "unknown_event",
    location: locationGuess,
    orgs: [],
    severity_cues: [],
    time_window: first.time,
    summary: first.content.slice(0, 220),
    raw_sources: [
      {
        title: first.title,
        url: first.url,
        reported_at: first.time,
      },
    ],
    severity: "High",
    confidence: 0.7,
  };
}

function guessLocationFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("japan")) return "Japan";
  if (lower.includes("california")) return "California, USA";
  if (lower.includes("turkey")) return "Turkey";
  if (lower.includes("india")) return "India";
  return null;
}

module.exports = {
  buildArticlesBlock,
  analyzeArticlesIntoIncident,
};

