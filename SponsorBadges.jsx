export default function SponsorBadges() {
  const items = [
    { name: "Tavily", text: "News search" },
    { name: "Airbyte", text: "Feed ingestion" },
    { name: "Neo4j", text: "Incident graph" },
    { name: "Reka", text: "Validation notes" },
    { name: "Render", text: "Hosting" },
    { name: "OpenAI", text: "LLM planning" },
    { name: "AWS", text: "Artifacts / storage" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {items.map((x) => (
        <span
          key={x.name}
          style={{
            border: "1px solid #eee",
            background: "#fafafa",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
          }}
        >
          <strong>{x.name}</strong>: {x.text}
        </span>
      ))}
    </div>
  );
}
