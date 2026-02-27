import express from "express";

const app = express();
app.use(express.json());

const REKA_API_KEY = process.env.REKA_API_KEY || "36a18f6abafa3f8953b608ad834accd0c250a0baad9480b6ab4e967f714c9f38";
const REKA_MODEL = process.env.REKA_MODEL || "reka-flash";

const SENSO_BASE_URL = process.env.SENSO_BASE_URL || "https://sdk.senso.ai/api/v1";  // set later
const SENSO_API_KEY = process.env.SENSO_API_KEY || "tgr_3j95LUFJSpvZCdbsAQE-MHAQfHE11jyn54B5jdoubKc";    // set later

// ---------- Reka ----------
async function rekaChat(messages) {
  const res = await fetch("https://api.reka.ai/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": REKA_API_KEY },
    body: JSON.stringify({ model: REKA_MODEL, messages, temperature: 0.2, max_tokens: 900 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Reka status ${res.status}`);
  return await res.json();
}

function extractText(resp) {
  return resp.text || resp.output_text || resp.choices?.[0]?.message?.content || "";
}

function safeJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

// ---------- Senso (pluggable) ----------
async function sensoAnalyze({ topic, articles }) {
  // If you don’t have Senso wired yet, fallback.
  if (!SENSO_BASE_URL || !SENSO_API_KEY) {
    return {
      labels: ["impact_assessment"],
      impact: "Unknown impact (Senso not configured yet).",
      key_entities: [],
      recommended_focus: ["verify", "monitor", "prepare"]
    };
  }

  // Generic HTTP shape; adjust once you know the real Senso endpoint.
  const res = await fetch(`${SENSO_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SENSO_API_KEY}`,
    },
    body: JSON.stringify({ topic, articles }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Senso status ${res.status}`);
  return await res.json();
}

// ---------- Main ----------
app.post("/run-agent", async (req, res) => {
  const topic = req.body?.topic || "earthquake";
  const articles = req.body?.articles || [
    { title: "Mock article", content: `Placeholder content for ${topic}`, url: "mock://", time: "now" }
  ];

  // 1) Senso summary/classification
  let senso;
  try {
    senso = await sensoAnalyze({ topic, articles });
  } catch (e) {
    senso = { labels: ["impact_assessment"], impact: "Senso failed", key_entities: [], recommended_focus: [], error: String(e) };
  }

  // 2) Reka plan (uses Senso output)
  const planResp = await rekaChat([
    { role: "system", content: "Return ONLY valid JSON. No extra text." },
    { role: "user", content:
`Topic: ${topic}

Senso impact assessment (JSON):
${JSON.stringify(senso).slice(0, 4000)}

Articles (JSON):
${JSON.stringify(articles).slice(0, 8000)}

Return STRICT JSON:
{
 "severity":"Low|Medium|High",
 "confidence":0-1,
 "summary":string,
 "actions":[{"priority":1,"action":string,"owner":string,"eta":string}],
 "checklist":[string]
}` }
  ]);

  const planText = extractText(planResp);
  const plan = safeJson(planText, {
    severity: "Medium", confidence: 0.5, summary: planText.slice(0, 300),
    actions: [{ priority: 1, action: "Fix JSON prompt/parse", owner: "Engineer", eta: "now" }],
    checklist: []
  });

  // 3) Reka validate
  const valResp = await rekaChat([
    { role: "system", content: "Return ONLY valid JSON. No extra text." },
    { role: "user", content:
`You are a risk validator. Review plan JSON and return STRICT JSON:
{
 "reka_verdict":"OK|WARN|FAIL",
 "missing_steps":[string],
 "risks":[string]
}

Plan JSON:
${JSON.stringify(plan)}`
    }
  ]);

  const valText = extractText(valResp);
  const validation = safeJson(valText, { reka_verdict: "WARN", missing_steps: ["Non-JSON validation"], risks: [] });

  // 4) Merge
  const final = {
    topic,
    senso,          // keep Senso output visible (judges like “multi-sponsor”)
    ...plan,
    validation
  };

  res.json(final);
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(process.env.PORT || 8080, () => console.log("Person3 (Senso+Reka) running"));