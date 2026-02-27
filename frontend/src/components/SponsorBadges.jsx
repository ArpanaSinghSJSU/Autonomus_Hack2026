export default function SponsorBadges() {
  const items = [
    { name: "Tavily", text: "News search" },
    { name: "Yutori", text: "Scout" },
    { name: "Fastino", text: "Entity extraction" },
    { name: "Neo4j", text: "Incident graph" },
    { name: "Senso", text: "Impact" },
    { name: "Reka", text: "Plan & validation" },
    { name: "Render", text: "Hosting" },
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
