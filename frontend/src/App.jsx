import { useMemo, useState } from "react";
import SourceList from "./components/SourceList";
import PlanCard from "./components/PlanCard";
import ChecklistTable from "./components/ChecklistTable";
import SponsorBadges from "./components/SponsorBadges";
import { useInterval } from "./utils/useInterval";
import { toCSV, downloadCSV } from "./utils/csv";

const TOPICS = [
  { value: "cyber_attack", label: "Cyber Outage" },
  { value: "earthquake", label: "Earthquake / Disaster" },
  { value: "flood", label: "Flood" },
  { value: "power_outage", label: "Infrastructure Outage" },
];

const INTERVALS = [
  { label: "Off", ms: null },
  { label: "15s", ms: 15000 },
  { label: "30s", ms: 30000 },
  { label: "60s", ms: 60000 },
];

/**
 * Map Hack_2026 /api/decision response to the UI shape (sources, plan, event, graph_status).
 */
function mapDecisionToUI(data) {
  if (!data) return null;

  const incident = data.incident || {};
  const rawSources = incident.raw_sources || [];

  const sources = rawSources.map((s) => ({
    title: s.title || "Untitled",
    url: s.url || "",
    published: s.reported_at || new Date().toISOString(),
    source: "tavily",
  }));

  const recommended_actions = (data.actions || []).map((a) => ({
    task: a.title || "",
    owner: a.owner || "—",
    eta: a.description || "",
    priority: String(a.priority ?? "—"),
    status: "Todo",
  }));

  return {
    sources,
    event: {
      event_id: data.incidentId || "—",
      event_type: data.topic || "—",
    },
    graph_status: incident.id ? "updated" : "—",
    plan: {
      severity: data.severity,
      confidence: data.confidence,
      summary: data.summary,
      rationale: data.rationale,
      recommended_actions,
      reka_notes: data.validator?.critical_warnings || [],
    },
  };
}

export default function App() {
  const [topic, setTopic] = useState(TOPICS[0].value);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoMs, setAutoMs] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [adjustSeverity, setAdjustSeverity] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const uiData = useMemo(() => mapDecisionToUI(data), [data]);
  const actions = useMemo(() => uiData?.plan?.recommended_actions ?? [], [uiData]);

  async function runAgent() {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (!res.ok) throw new Error(`Backend error: HTTP ${res.status}`);
      const json = await res.json();

      setData(json);
      setLastRun(new Date());
    } catch (e) {
      setData(null);
      setErrorMsg(e.message || "Failed to run agent. Is the server running on port 4000?");
    } finally {
      setLoading(false);
    }
  }

  function onDownloadCSV() {
    if (!actions.length) return;
    const csv = toCSV(actions);
    downloadCSV("numeric_checklist.csv", csv);
  }

  async function onSubmitFeedback() {
    if (!data?.incidentId || !adjustSeverity) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: data.incidentId,
          newSeverity: adjustSeverity,
          comment: "User adjustment from UI (self-improvement)",
        }),
      });
      setFeedbackSent(true);
    } catch (e) {
      console.error(e);
    }
  }

  useInterval(() => {
    if (!loading && autoMs) runAgent();
  }, autoMs);

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={{ margin: 0 }}>SentinelOps</h1>
          <p style={{ margin: "6px 0 0", color: "#444" }}>
            Autonomous News → Action Agent (Crisis / Market Watcher)
          </p>

          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
            Last run: {lastRun ? lastRun.toLocaleString() : "—"}
          </div>

          <SponsorBadges />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={select}
            disabled={loading}
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <button onClick={runAgent} disabled={loading} style={button}>
            {loading ? "Running..." : "Run Agent"}
          </button>

          <button
            onClick={onDownloadCSV}
            disabled={!actions.length}
            style={{ ...button, opacity: actions.length ? 1 : 0.6 }}
          >
            Download Checklist (CSV)
          </button>

          <select
            value={autoMs ?? "null"}
            onChange={(e) => setAutoMs(e.target.value === "null" ? null : Number(e.target.value))}
            style={selectSmall}
            disabled={loading}
            title="Auto-run agent"
          >
            {INTERVALS.map((i) => (
              <option key={i.label} value={i.ms ?? "null"}>
                Auto-run: {i.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div style={info}>
          Agent analyzing signals… (Tavily + incident pipeline + Senso + Reka)
        </div>
      ) : null}

      {errorMsg ? (
        <div style={warning}>
          <strong>Note:</strong> {errorMsg}
        </div>
      ) : null}

      <main style={grid}>
        <section style={card}>
          <h2 style={h2}>Sources</h2>
          <SourceList sources={uiData?.sources ?? []} />
        </section>

        <section style={card}>
          <h2 style={h2}>Incident Plan</h2>
          <PlanCard plan={uiData?.plan} />
        </section>

        <section style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h2 style={h2}>Checklist</h2>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={smallPill}>Graph: {uiData?.graph_status ?? "—"}</span>
              <span style={smallPill}>Event: {uiData?.event?.event_id ?? "—"}</span>
            </div>
          </div>

          <ChecklistTable actions={actions} />

          {data?.incidentId ? (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eee" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>👍 Adjust severity (self-improvement)</h3>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666" }}>
                Save your assessment so the next run can use it.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={adjustSeverity}
                  onChange={(e) => { setAdjustSeverity(e.target.value); setFeedbackSent(false); }}
                  style={selectSmall}
                >
                  <option value="">Pick severity</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                <button onClick={onSubmitFeedback} disabled={!adjustSeverity} style={button}>
                  Save feedback
                </button>
                {feedbackSent ? <span style={{ fontSize: 12, color: "#0a0" }}>Saved.</span> : null}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <footer style={{ marginTop: 18, color: "#666", fontSize: 12 }}>
        Hack_2026 – Tavily, Fastino, Neo4j, Senso, Reka.
      </footer>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#f6f7fb",
  padding: 18,
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  padding: 14,
  border: "1px solid #e9e9e9",
  borderRadius: 14,
  background: "white",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
  marginTop: 14,
};

const card = {
  border: "1px solid #e9e9e9",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

const h2 = {
  margin: "0 0 10px",
  fontSize: 16,
};

const select = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const selectSmall = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  fontSize: 13,
};

const button = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const warning = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #ffe3aa",
  background: "#fff7e6",
};

const info = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #cfe1ff",
  background: "#eef5ff",
};

const smallPill = {
  border: "1px solid #eee",
  background: "#fafafa",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  height: "fit-content",
};
