import { useState } from "react";

export default function VoiceTip({ backendUrl, onAccepted }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  async function upload() {
    if (!file) return;
    setStatus("Uploading audio to Modulate...");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("audio", file);

      const res = await fetch(`${backendUrl}/tip`, {
        method: "POST",
        body: fd
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json);

      if (json.allowed) {
        setStatus("✅ Allowed. Added as an additional source.");
        onAccepted?.(json);
      } else {
        setStatus(`⛔ Blocked: ${json.reason || "Unsafe content"}`);
      }
    } catch (e) {
      setStatus("❌ Tip upload failed. Backend not reachable or /tip not ready.");
    }
  }

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Optional: Voice Tip (Modulate Gate)</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={upload} disabled={!backendUrl || !file}>
          Upload & Moderate
        </button>
      </div>

      {status ? <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>{status}</div> : null}

      {result?.allowed && result?.text ? (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>Tip text:</div>
          <div style={{ color: "#444" }}>{result.text}</div>
        </div>
      ) : null}
    </div>
  );
}
