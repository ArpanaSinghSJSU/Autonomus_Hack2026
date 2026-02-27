/**
 * Maps decision agent (Senso + Reka) output to the shape expected by the main app and UI.
 *
 * Decision agent returns:
 *   actions: [{ priority, action, owner, eta }]
 *   validation: { reka_verdict, missing_steps, risks }
 *
 * Main app / UI expect:
 *   actions: [{ title, description, owner, priority }]
 *   validator: { agreement_with_plan, severity_adjustment_reason, critical_warnings }
 */

function mapDecisionAgentResponse(agentOutput, incidentId, incident = null) {
  const plan = agentOutput;
  const validation = plan.validation || {};

  // Map actions: action → title, eta → description
  const actions = (plan.actions || []).map((a) => ({
    title: a.action != null ? String(a.action) : "Unspecified action",
    description: a.eta != null ? String(a.eta) : (a.action != null ? String(a.action) : ""),
    owner: a.owner != null ? String(a.owner) : "—",
    priority: typeof a.priority === "number" ? a.priority : 1,
  }));

  // Derive validator shape from Reka validation
  const verdict = (validation.reka_verdict || "WARN").toUpperCase();
  const agreement_with_plan =
    verdict === "OK" ? 1 : verdict === "WARN" ? 0.5 : 0;

  const risks = validation.risks || [];
  const missing_steps = validation.missing_steps || [];
  const critical_warnings = [...risks, ...missing_steps];
  const severity_adjustment_reason =
    critical_warnings.length > 0
      ? critical_warnings.join(". ")
      : `Reka verdict: ${verdict}.`;

  const response = {
    incidentId: incidentId || `event-${Date.now()}`,
    topic: plan.topic || "earthquake",
    severity: plan.severity || "Medium",
    confidence: typeof plan.confidence === "number" ? plan.confidence : 0.5,
    summary: plan.summary || "",
    rationale: `Plan generated from Senso + Reka. ${severity_adjustment_reason}`,
    actions,
    validator: {
      agreement_with_plan,
      severity_adjustment_reason,
      critical_warnings,
    },
  };

  if (incident) {
    response.incident = incident;
  }

  if (Array.isArray(plan.checklist) && plan.checklist.length > 0) {
    response.checklist = plan.checklist;
  }

  return response;
}

module.exports = {
  mapDecisionAgentResponse,
};
