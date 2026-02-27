import { useEffect, useMemo, useState } from "react";

import SourceList from "./components/SourceList";
import PlanCard from "./components/PlanCard";
import ChecklistTable from "./components/ChecklistTable";
import SponsorBadges from "./components/SponsorBadges";
import VoiceTip from "./components/VoiceTip";

import { toCSV, downloadCSV } from "./utils/csv";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

// Topics shown in dropdown (you can add more)
const TOPICS = [
  { label: "Cyber Outage", value: "cyber outage" },
  { label: "Market Shock", value: "market shock" },
  { label: "Supply Chain Disruption", value: "supply chain disruption" },
  { label: "Regulatory Alert", value: "regulatory alert" },
];

function formatNow() {
  return new Date().toLocaleString();
}

export default function App() {
  const [topic, setTopic] = useState(TOPICS[0].value);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState(null);

  // Optional: store last run time in UI
  const [lastRun, setLastRun] = useState(null);

  // Optional: hold voice tip (accepted by Modulate) so it can be sent to /run
  const [voiceTip, setVoiceTip] = useState(null);

  // Derived: recommended actions (checklist rows)
  const actions = useMemo(() => {
    const rows = data?.plan?.recommended_actions || [];
    // Normalize in case backend uses different keys
    return rows.map((r) => ({
      task: r.task ?? r.Task ?? "",
      owner: r.owner ?? r.Owner ?? "",
      eta: r.eta ?? r.ETA ?? "",
      priority: r.priority ?? r.Priority ?? "",
      status: r.status ?? r.Status ?? "Todo",
    }));
  }, [data]);

  // Derived: last run label
  const lastRunLabel = lastRun ? lastRun : "—";

  useEffect(() => {
    // Clear error when topic changes
    setErrorMsg("");
  }, [topic]);

  async function runAgent() {
    setLoading(true);
    setErrorMsg("");

    try {
      if (!BACKEND) {
        throw new Error("Missing VITE_BACKEND_URL. Falling back to mock.");
      }

      const res = await fetch(`${BACKEND}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Include voiceTip text if accepted (optional)
        body: JSON.stringify({
          topic,
          extra_tip: voiceTip?.text || "",
        }),
      });

      if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);

      const json = await res.json();
      setData(json);
      setLastRun(formatNow());
    } catch (e) {
      // Fallback to mock so demo always works
      try {
        const mod = await import("./mock/mockRunResponse");
        setData(mod.mockRunResponse);
        setLastRun(formatNow());
        setErrorMsg(
          "Backend not reachable (Failed to fetch). Showing mock data so the demo still works."
        );
      } catch {
        setErrorMsg(
          `Run failed and mock not found. Error: ${e?.message || String(e)}`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadCSV() {
    if (!actions.length) return;
    const csvText = toCSV(actions);
    downloadCSV("numeric_checklist.csv", csvText);
  }

  function downloadIncidentJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "incident.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const graphStatus = data?.graph_status ?? "—";
  const eventId = data?.event?.event_id ?? "—";

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={{ margin: 0 }}>SentinelOps</h1>
          <div style={{ color: "#555", marginTop: 4 }}>
            Autonomous News → Action Agent (Crisis / Market Watcher)
          </div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
            Last run: {lastRunLabel}
          </div>
        </div>

        <div style={controls}>
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
            onClick={handleDownloadCSV}
            disabled={!actions.length}
            style={{
              ...button,
              opacity: actions.length ? 1 : 0.5,
            }}
          >
            Download Checklist (CSV)
          </button>

          <button
            onClick={downloadIncidentJSON}
            disabled={!data}
            style={{
              ...button,
              opacity: data ? 1 : 0.5,
            }}
          >
            Download Incident JSON
          </button>
        </div>
      </header>

      {/* Sponsor badges row */}
      <div style={{ marginTop: 10 }}>
        <SponsorBadges />
      </div>

      {/* Note / warning */}
      {loading ? (
        <div style={infoBanner}>
          Agent analyzing signals… (Tavily + Airbyte + graph update)
        </div>
      ) : null}

      {errorMsg ? (
        <div style={warnBanner}>
          <strong>Note:</strong> {errorMsg}
        </div>
      ) : null}

      {/* Voice tip upload (Modulate gate) */}
      <div style={{ marginTop: 12 }}>
        <VoiceTip
          backendUrl={BACKEND}
          onAccepted={(tipJson) => {
            // tipJson could be: { allowed, text, source }
            setVoiceTip(tipJson);

            // Optional: instantly add it as a source in UI if current data exists
            if (tipJson?.allowed && tipJson?.source) {
              setData((prev) => {
                if (!prev) return prev;
                const prevSources = prev.sources || [];
                return { ...prev, sources: [tipJson.source, ...prevSources] };
              });
            }
          }}
        />
      </div>

      <main style={grid}>
        <section style={card}>
          <h2 style={h2}>Sources</h2>
          <SourceList sources={data?.sources ?? []} />
        </section>

        <section style={card}>
          <h2 style={h2}>Incident Plan</h2>
          <PlanCard plan={data?.plan} />
        </section>

        <section style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <h2 style={{ ...h2, marginBottom: 0 }}>Checklist</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={pill}>Graph: {graphStatus}</span>
              <span style={pill}>Event: {eventId}</span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <ChecklistTable actions={actions} />
          </div>
        </section>
      </main>

      <footer style={{ marginTop: 18, color: "#666", fontSize: 12 }}>
        Demo-safe: if backend is down, mock mode still works.
      </footer>
    </div>
  );
}

/* ---------------- styles ---------------- */

const page = {
  minHeight: "100vh",
  background: "#f6f7fb",
  padding: 18,
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
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

const controls = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const select = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const button = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const infoBanner = {
  marginTop: 12,
  background: "#eef6ff",
  border: "1px solid #d8eaff",
  color: "#124a7b",
  padding: 10,
  borderRadius: 12,
  fontSize: 13,
};

const warnBanner = {
  marginTop: 12,
  background: "#fff3df",
  border: "1px solid #ffe2b3",
  color: "#7a4a00",
  padding: 10,
  borderRadius: 12,
  fontSize: 13,
};

const grid = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
};

const card = {
  background: "white",
  border: "1px solid #e9e9e9",
  borderRadius: 14,
  padding: 14,
};

const h2 = {
  margin: "0 0 10px 0",
  fontSize: 16,
};

const pill = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #eee",
  background: "#fafafa",
};