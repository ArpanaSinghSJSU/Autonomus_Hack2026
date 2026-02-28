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

/**
 * Normalize location to { name?, lat?, long? }. Handles string (place name or "lat, long") or object.
 * So every news source can send name, coords, or both.
 */
function normalizeLocation(loc) {
  if (loc == null) return { name: null, lat: null, long: null };
  if (typeof loc === "object" && (loc.name != null || loc.lat != null || loc.long != null)) {
    return {
      name: loc.name != null ? String(loc.name).trim() || null : null,
      lat: typeof loc.lat === "number" && !Number.isNaN(loc.lat) ? loc.lat : null,
      long: typeof loc.long === "number" && !Number.isNaN(loc.long) ? loc.long : null,
    };
  }
  const str = String(loc).trim();
  if (!str) return { name: null, lat: null, long: null };
  // "35.6762, 139.6503" or "35.67, 139.65"
  const coordMatch = str.match(/^(-?\d+\.?\d*)\s*[,]\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const long = parseFloat(coordMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(long)) return { name: null, lat, long };
  }
  return { name: str, lat: null, long: null };
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

  const locationNormalized = normalizeLocation(fastinoIncident.location);

  const incident = {
    id: incidentId,
    event: fastinoIncident.event,
    location: locationNormalized,
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

  const combinedText = articles.map((a) => `${a.title} ${a.content}`).join(" ");
  const locationGuess = extractLocationFromText(combinedText) || extractLocationFromText(first.content) || { name: "Unknown", lat: null, long: null };
  const severity_cues = extractSeverityCues(combinedText);
  const orgs = extractOrgs(combinedText);

  const contentSnippet = first.content.slice(0, 300);
  const firstSentence = contentSnippet.split(/[.!?]/)[0]?.trim() || contentSnippet;
  const summary =
    first.title && !first.content?.toLowerCase().startsWith("what is") && !first.content?.toLowerCase().startsWith("an earthquake is")
      ? `${first.title}. ${firstSentence}.`
      : firstSentence + (firstSentence.endsWith(".") ? "" : ".");
  const time_window = first.time;

  const raw_sources = articles.map((a) => ({
    title: a.title || "Untitled",
    url: a.url || "",
    reported_at: a.time || null,
  }));

  return {
    event: topic?.replace(/\s+/g, "_") || "unknown_event",
    location: locationGuess, // { name?, lat?, long? }
    orgs,
    severity_cues,
    time_window,
    summary: summary.slice(0, 400),
    raw_sources,
    severity: severity_cues.length > 0 ? "High" : "Medium",
    confidence: 0.7,
  };
}

function extractSeverityCues(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const cues = [];
  const magnitudeMatch = text.match(/\d+\.?\d*\s*magnitude|magnitude\s*\d+\.?\d*/gi);
  if (magnitudeMatch) cues.push(...magnitudeMatch.slice(0, 2).map((s) => s.trim()));
  if (lower.includes("tsunami warning")) cues.push("tsunami warning");
  if (lower.includes("tsunami")) cues.push("tsunami");
  if (lower.includes("casualt") || lower.includes("injuries")) cues.push("injuries reported");
  if (lower.includes("damage") || lower.includes("destruction")) cues.push("damage reported");
  if (lower.includes("emergency") || lower.includes("evacuation")) cues.push("emergency/evacuation");
  if (lower.includes("aftershock")) cues.push("aftershocks");
  return [...new Set(cues)].slice(0, 8);
}

function extractOrgs(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const orgs = [];
  const known = [
    "usgs", "noaa", "bgs", "jma", "emsc", "gfz", "reuters", "ap", "bbc", "cnn",
    "red cross", "fema", "ndma", "national weather service", "british geological survey",
  ];
  for (const name of known) {
    if (lower.includes(name)) orgs.push(name.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const accordingTo = text.match(/according to\s+([^,.]+)/gi);
  if (accordingTo) {
    accordingTo.slice(0, 2).forEach((m) => {
      const name = m.replace(/according to\s+/i, "").trim().slice(0, 50);
      if (name && !orgs.includes(name)) orgs.push(name);
    });
  }
  return [...new Set(orgs)].slice(0, 6);
}

/**
 * Extract location from text: place name and/or lat/long so different news formats are supported.
 * Returns { name?, lat?, long? } (at least one of name or both coords).
 */
function extractLocationFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  let name = null;
  const placeNames = [
    ["japan", "Japan"],
    ["california", "California, USA"],
    ["turkey", "Turkey"],
    ["türkiye", "Turkey"],
    ["india", "India"],
    ["indonesia", "Indonesia"],
    ["philippines", "Philippines"],
    ["chile", "Chile"],
    ["mexico", "Mexico"],
    ["new zealand", "New Zealand"],
  ];
  for (const [key, label] of placeNames) {
    if (lower.includes(key)) {
      name = label;
      break;
    }
  }

  let lat = null;
  let long = null;
  // "lat 35.67 long 139.65" or "latitude 35.67 longitude 139.65"
  const latLongMatch = text.match(/(?:lat(?:itude)?)\s*(-?\d+\.?\d*)\D+(?:lon(?:g(?:itude)?)?)\s*(-?\d+\.?\d*)/i);
  if (latLongMatch) {
    lat = parseFloat(latLongMatch[1]);
    long = parseFloat(latLongMatch[2]);
    if (Number.isNaN(lat)) lat = null;
    if (Number.isNaN(long)) long = null;
  }
  // "35.6762, 139.6503" or "35.6762° N, 139.6503° E"
  if (lat == null || long == null) {
    const simple = text.match(/(-?\d+\.?\d*)\s*[°,]?\s*(?:N|S|E|W)?\s*[,]\s*(-?\d+\.?\d*)\s*[°,]?\s*(?:N|S|E|W)?/);
    if (simple) {
      const a = parseFloat(simple[1]);
      const b = parseFloat(simple[2]);
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        lat = a;
        long = b;
      }
    }
  }

  if (name || (lat != null && long != null)) {
    return { name: name || null, lat, long };
  }
  return null;
}

module.exports = {
  buildArticlesBlock,
  analyzeArticlesIntoIncident,
};

