let driver = null;

function getDriver() {
  if (driver) return driver;

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    console.warn("Neo4j env vars not set, graph persistence will be skipped.");
    return null;
  }

  // Lazy require so the app can still run without the dependency if needed
  const neo4j = require("neo4j-driver");
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  return driver;
}

async function saveIncidentToGraph(incident) {
  const drv = getDriver();
  if (!drv) {
    return;
  }

  const session = drv.session();

  const params = {
    id: incident.id,
    event: incident.event,
    location: incident.location,
    orgs: incident.orgs || [],
    severity_cues: incident.severity_cues || [],
    time_window: incident.time_window || null,
    summary: incident.summary,
    raw_sources: incident.raw_sources || [],
    severity: incident.severity || "High",
    confidence: incident.confidence || 0.0,
  };

  const query = `
CREATE CONSTRAINT unique_event_id IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT unique_location_name IF NOT EXISTS
FOR (l:Location) REQUIRE l.name IS UNIQUE;

CREATE CONSTRAINT unique_org_name IF NOT EXISTS
FOR (o:Org) REQUIRE o.name IS UNIQUE;

CREATE CONSTRAINT unique_source_url IF NOT EXISTS
FOR (s:Source) REQUIRE s.url IS UNIQUE;

MERGE (e:Event {id: $id})
SET e.type = $event,
    e.summary = $summary,
    e.time_window = $time_window,
    e.severity_cues = $severity_cues,
    e.severity = $severity,
    e.confidence = $confidence,
    e.created_at = datetime()

MERGE (loc:Location {name: $location})
MERGE (e)-[:LOCATED_IN]->(loc);

FOREACH (orgName IN $orgs |
  MERGE (o:Org {name: orgName})
  MERGE (e)-[:MENTIONS]->(o)
);

FOREACH (src IN $raw_sources |
  MERGE (s:Source {url: src.url})
  SET s.title = src.title,
      s.reported_at = src.reported_at
  MERGE (e)-[:REPORTED_BY]->(s)
);
`;

  try {
    await session.executeWrite((tx) => tx.run(query, params));
  } finally {
    await session.close();
  }
}

module.exports = {
  saveIncidentToGraph,
};

