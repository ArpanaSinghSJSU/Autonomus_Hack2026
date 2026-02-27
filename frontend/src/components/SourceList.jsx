import { formatDate } from "../utils/format";

export default function SourceList({ sources = [] }) {
  if (!sources.length) return <p>No sources yet.</p>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sources.map((s, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ lineHeight: 1.3 }}>{s.title || "Untitled source"}</strong>
            <span style={tag}>{s.source || "source"}</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#444" }}>
            <div>{formatDate(s.published)}</div>
            {s.url && !s.url.includes("example.com") ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            ) : s.url && s.url.includes("example.com") ? (
              <span style={{ color: "#888" }}>Simulated source (no external link)</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const tag = {
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #eee",
  height: "fit-content",
  whiteSpace: "nowrap",
};
