export const mockRunResponse = {
  sources: [
    {
      title: "Example: Major outage reported for payment services",
      url: "https://example.com/outage",
      published: "2026-02-27T10:15:00Z",
      source: "tavily",
    },
    {
      title: "Example: Monitoring alert - service instability",
      url: "https://example.com/monitor",
      published: "2026-02-27T10:12:00Z",
      source: "yutori",
    },
    {
      title: "Example: RSS ingestion record",
      url: "https://example.com/rss-item",
      published: "2026-02-27T10:05:00Z",
      source: "airbyte",
    },
  ],
  event: {
    event_id: "evt_demo_001",
    event_type: "cyber outage",
    entities: {
      orgs: ["CompanyX"],
      locations: ["San Francisco"],
      assets: ["payment system"],
    },
  },
  graph_status: "updated",
  plan: {
    severity: "High",
    confidence: 0.84,
    summary:
      "Multiple sources report a service outage affecting payments. Possible cyber incident or infrastructure failure. Immediate triage recommended.",
    recommended_actions: [
      { task: "Notify security on-call", owner: "Ops", eta: "15m", priority: "P0", status: "Todo" },
      { task: "Check incident dashboard + logs", owner: "SRE", eta: "15m", priority: "P0", status: "Todo" },
      { task: "Isolate suspected affected systems", owner: "IT", eta: "30m", priority: "P0", status: "Todo" },
      { task: "Prepare customer communication draft", owner: "Comms", eta: "45m", priority: "P1", status: "Todo" },
    ],
    reka_notes: ["Confirm scope via at least 2 sources", "Add a post-incident review task"],
  },
};
