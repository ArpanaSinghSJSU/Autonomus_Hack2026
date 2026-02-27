export default function ChecklistTable({ actions = [] }) {
  if (!actions.length) return <p>No checklist items yet.</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
        <thead>
          <tr>
            {["Task", "Owner", "ETA", "Priority", "Status"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderBottom: "1px solid #eee",
                  fontSize: 13,
                  background: "#fafafa",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {actions.map((a, idx) => (
            <tr key={idx}>
              <td style={td}>{a.task}</td>
              <td style={td}>{a.owner}</td>
              <td style={td}>{a.eta}</td>
              <td style={td}>{a.priority}</td>
              <td style={td}>{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const td = {
  padding: 10,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 13,
  verticalAlign: "top",
};
