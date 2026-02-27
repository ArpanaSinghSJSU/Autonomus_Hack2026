export default function PlanCard({ plan }) {
  if (!plan) return <p>No plan yet.</p>;

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 14,
        background: "white",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span style={pill}>
          <strong>Severity:</strong> {plan.severity ?? "—"}
        </span>
        <span style={pill}>
          <strong>Confidence:</strong>{" "}
          {typeof plan.confidence === "number" ? plan.confidence.toFixed(2) : "—"}
        </span>
      </div>

      <div>
        <strong>Summary</strong>
        <p style={{ marginTop: 6, marginBottom: 0, lineHeight: 1.4 }}>{plan.summary ?? "—"}</p>
      </div>

      {plan.rationale ? (
        <div>
          <strong>Rationale</strong>
          <p style={{ marginTop: 6, marginBottom: 0, lineHeight: 1.4, fontSize: 13, color: "#555" }}>
            {plan.rationale}
          </p>
        </div>
      ) : null}

      {plan.reka_notes?.length ? (
        <div>
          <strong>Reka validation notes</strong>
          <ul style={{ marginTop: 6 }}>
            {plan.reka_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const pill = {
  border: "1px solid #eee",
  background: "#fafafa",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 13,
};
