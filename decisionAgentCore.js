/**
 * Inlined Agent Brain: Senso (impact) → Reka (plan) → Reka (validate).
 * Exports runAgent({ topic, articles, incident }) for use by the main server.
 * No HTTP server; called directly from server.js.
 */

const REKA_API_KEY = process.env.REKA_API_KEY || "";
const REKA_MODEL = process.env.REKA_MODEL || "reka-flash";
const SENSO_BASE_URL = process.env.SENSO_BASE_URL || "";
const SENSO_API_KEY = process.env.SENSO_API_KEY || "";

async function rekaChat(messages) {
  if (!REKA_API_KEY) {
    throw new Error("REKA_API_KEY is not set");
  }
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
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function sensoAnalyze({ topic, articles }) {
  if (!SENSO_BASE_URL || !SENSO_API_KEY) {
    return {
      labels: ["impact_assessment"],
      impact: "Unknown impact (Senso not configured).",
      key_entities: [],
      recommended_focus: ["verify", "monitor", "prepare"],
    };
  }
  const res = await fetch(`${SENSO_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SENSO_API_KEY}`,
    },
    body: JSON.stringify({ topic, articles }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Senso status ${res.status}`);
  return await res.json();
}

/**
 * Run the decision agent: Senso → Reka plan → Reka validate → merged result.
 * @param {{ topic: string, articles: Array<{title, content, url, time}>, incident?: object }} opts
 * @returns {Promise<{ topic, senso, severity, confidence, summary, actions, checklist, validation }>}
 */
async function runAgent({ topic, articles, incident }) {
  const safeArticles = Array.isArray(articles) && articles.length > 0
    ? articles
    : [{ title: "No articles", content: `Placeholder for ${topic}`, url: "mock://", time: new Date().toISOString() }];

  // 1) Senso: impact assessment
  let senso;
  try {
    senso = await sensoAnalyze({ topic, articles: safeArticles });
  } catch (e) {
    senso = {
      labels: ["impact_assessment"],
      impact: "Senso failed",
      key_entities: [],
      recommended_focus: [],
      error: String(e.message),
    };
  }

  // 2) Reka plan (uses Senso output)
  const planResp = await rekaChat([
    { role: "system", content: "Return ONLY valid JSON. No extra text." },
    {
      role: "user",
      content: `Topic: ${topic}

Senso impact assessment (JSON):
${JSON.stringify(senso).slice(0, 4000)}

Articles (JSON):
${JSON.stringify(safeArticles).slice(0, 8000)}

Return STRICT JSON:
{
 "severity":"Low|Medium|High",
 "confidence":0-1,
 "summary":string,
 "actions":[{"priority":1,"action":string,"owner":string,"eta":string}],
 "checklist":[string]
}`,
    },
  ]);

  const planText = extractText(planResp);
  const plan = safeJson(planText, {
    severity: "Medium",
    confidence: 0.5,
    summary: planText.slice(0, 300),
    actions: [{ priority: 1, action: "Fix JSON prompt/parse", owner: "Engineer", eta: "now" }],
    checklist: [],
  });

  // 3) Reka validate
  const valResp = await rekaChat([
    { role: "system", content: "Return ONLY valid JSON. No extra text." },
    {
      role: "user",
      content: `You are a risk validator. Review plan JSON and return STRICT JSON:
{
 "reka_verdict":"OK|WARN|FAIL",
 "missing_steps":[string],
 "risks":[string]
}

Plan JSON:
${JSON.stringify(plan)}`,
    },
  ]);

  const valText = extractText(valResp);
  const validation = safeJson(valText, {
    reka_verdict: "WARN",
    missing_steps: ["Non-JSON validation"],
    risks: [],
  });

  // 4) Merge (incident is optional; mapper can attach it when building the response)
  return {
    topic,
    senso,
    ...plan,
    validation,
  };
}

module.exports = {
  runAgent,
};
