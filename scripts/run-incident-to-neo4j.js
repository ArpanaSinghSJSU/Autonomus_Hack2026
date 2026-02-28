#!/usr/bin/env node
/**
 * Run the full flow: Tavily/Yutori → extract event, location, severity_cues → send to Neo4j.
 * Usage: node scripts/run-incident-to-neo4j.js [topic]
 * Example: node scripts/run-incident-to-neo4j.js earthquake
 * Requires: .env with TAVILY_API_KEY (optional YUTORI_*). Neo4j optional (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD).
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { fetchNews } = require("../newsService");
const { analyzeArticlesIntoIncident } = require("../incidentService");

const topic = process.argv[2] || "earthquake";

async function main() {
  console.log("Fetching news for topic:", topic);
  const articles = await fetchNews(topic, 5);
  console.log("Articles:", articles.length);

  console.log("Analyzing into incident (event, location, severity_cues)…");
  const incident = await analyzeArticlesIntoIncident(articles, topic);

  console.log("\n--- Extracted (and sent to Neo4j if configured) ---");
  console.log("event:", incident.event);
  console.log("location:", incident.location);
  console.log("severity_cues:", incident.severity_cues);
  console.log("summary:", (incident.summary || "").slice(0, 200) + "...");
  console.log("\nIncident id:", incident.id);
  if (process.env.NEO4J_URI) {
    console.log("Neo4j: incident written to graph (Event + Location + Sources).");
  } else {
    console.log("Neo4j: skipped (set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD to persist).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
