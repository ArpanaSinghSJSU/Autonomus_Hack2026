const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve React UI from /public
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Main agent endpoint – currently returns a mock result
// Shape matches the React UI expectations for /api/decision
app.post("/api/decision", (req, res) => {
  const topic = req.body.topic || "earthquake";

  const mockResult = {
    incidentId: `event-${Date.now()}`,
    topic,
    severity: "High",
    confidence: 0.82,
    summary: `Mock situation summary for ${topic}. A strong event has been reported with potential infrastructure impact.`,
    rationale:
      "High magnitude reports, mentions of infrastructure disruption, and alerts from multiple sources justify high severity.",
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
        "Mock validator agrees with primary assessment based on limited sample data.",
      critical_warnings: ["This is mock data. Do not use for real emergencies."],
    },
  };

  res.json(mockResult);
});

// Feedback endpoint – for now just logs body to console
app.post("/api/feedback", (req, res) => {
  console.log("Received feedback:", req.body);
  res.json({ ok: true });
});

// Fallback: send index.html for any unknown route (for SPA routing if needed)
// Use app.use without a path to avoid path-to-regexp issues in Express 5.
app.use((req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

