const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");

// Startup: confirm env (so you can see if Tavily/Reka are loaded)
const hasTavily = !!(process.env.TAVILY_API_KEY || "").trim();
console.log("Tavily API key:", hasTavily ? "set" : "NOT SET (using simulated news)");
const cors = require("cors");
const { analyzeArticlesIntoIncident } = require("./incidentService");
const { fetchNews } = require("./newsService");
const { listRecentEvents } = require("./neo4jClient");
const { mapDecisionAgentResponse } = require("./decisionAgentMapper");
const { runAgent } = require("./decisionAgentCore");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, "public");

// ---------- API routes FIRST (so /api/* and /health never serve HTML) ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/env-check", (req, res) => {
  res.json({
    tavily: (process.env.TAVILY_API_KEY || "").trim() ? "set" : "not set",
    reka: (process.env.REKA_API_KEY || "").trim() ? "set" : "not set",
    neo4j: (process.env.NEO4J_URI || "").trim() ? "set" : "not set",
  });
});

// Verify Neo4j: list recent events (event, location, severity_cues). ?limit=20
app.get("/api/neo4j/events", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const data = await listRecentEvents(limit);
    res.json(data);
  } catch (err) {
    console.error("Error in /api/neo4j/events:", err);
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Person 1: Real-time inputs – Tavily + Yutori
// Deliverable API: GET /api/news?topic=earthquake
app.get("/api/news", async (req, res) => {
  try {
    const topic = req.query.topic || "earthquake";
    const articles = await fetchNews(topic, 5);
    res.json(articles);
  } catch (err) {
    console.error("Error in /api/news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Person 2: Understanding + Memory
app.post("/api/incident/analyze", async (req, res) => {
  try {
    const topic = req.body.topic || "earthquake";

    const articles = await fetchNews(topic, 5);

    const incident = await analyzeArticlesIntoIncident(articles, topic);

    res.json({ incident, articles });
  } catch (err) {
    console.error("Error in /api/incident/analyze:", err);
    res.status(500).json({ error: "Failed to analyze incident" });
  }
});

// Main agent endpoint – Person 1 (news) → Person 2 (incident) → Agent Brain (inlined Senso+Reka, or HTTP if DECISION_AGENT_URL set).
app.post("/api/decision", async (req, res) => {
  try {
    const topic = req.body.topic || "earthquake";
    const articles = await fetchNews(topic, 5);
    const incident = await analyzeArticlesIntoIncident(articles, topic);

    // 1) Try inlined Agent Brain first (Senso + Reka in-process)
    try {
      const agentOutput = await runAgent({ topic, articles, incident });
      const decision = mapDecisionAgentResponse(agentOutput, incident.id, incident);
      return res.json(decision);
    } catch (inlineErr) {
      console.warn("Inlined decision agent failed (e.g. REKA_API_KEY not set):", inlineErr.message);
    }

    // 2) Optional: call external decision agent service if URL is set
    const decisionAgentUrl = (process.env.DECISION_AGENT_URL || "").trim();
    if (decisionAgentUrl) {
      try {
        const runRes = await fetch(`${decisionAgentUrl.replace(/\/$/, "")}/run-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, articles }),
        });
        if (runRes.ok) {
          const agentOutput = await runRes.json();
          const decision = mapDecisionAgentResponse(agentOutput, incident.id, incident);
          return res.json(decision);
        }
      } catch (httpErr) {
        console.warn("Decision agent HTTP call failed:", httpErr.message);
      }
    }

    // 3) Fallback: mock decision (no Reka/Senso)
    const mockResult = {
      incidentId: incident.id,
      topic,
      severity: incident.severity,
      confidence: incident.confidence,
      summary: incident.summary,
      rationale:
        "Severity from incident. Set REKA_API_KEY (and optionally SENSO_*) for Senso + Reka, or DECISION_AGENT_URL for external agent.",
      actions: [
        {
          title: "Issue emergency alerts",
          description:
            "Send alerts through SMS, email, and public broadcast channels to notify people in affected areas.",
          owner: "local authorities",
          priority: 1,
        },
        {
          title: "Check critical infrastructure",
          description:
            "Assess the status of hospitals, power grids, and transportation hubs.",
          owner: "infrastructure teams",
          priority: 2,
        },
      ],
      validator: {
        agreement_with_plan: 0.9,
        severity_adjustment_reason:
          "Mock data. Set REKA_API_KEY for inlined Senso+Reka, or DECISION_AGENT_URL for external agent.",
        critical_warnings: ["This is mock data. Do not use for real emergencies."],
      },
      incident,
    };

    res.json(mockResult);
  } catch (err) {
    console.error("Error in /api/decision:", err);
    res.status(500).json({ error: "Failed to run decision pipeline" });
  }
});

app.post("/api/feedback", (req, res) => {
  console.log("Received feedback:", req.body);
  res.json({ ok: true });
});

// Serve React UI from /public, then SPA fallback (never serve HTML for /api/*)
app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/health") {
    return res.status(404).json({ error: "Not found", path: req.path });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!hasTavily) console.log("  → Add TAVILY_API_KEY to .env and restart for real news.");
});

