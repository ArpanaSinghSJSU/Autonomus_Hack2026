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

function locationToParams(loc) {
  if (loc == null) return { locationName: "Unknown", locationLat: null, locationLong: null };
  const name = loc.name != null ? String(loc.name).trim() : null;
  const lat = typeof loc.lat === "number" && !Number.isNaN(loc.lat) ? loc.lat : null;
  const long = typeof loc.long === "number" && !Number.isNaN(loc.long) ? loc.long : null;
  const locationName = name || (lat != null && long != null ? `${lat},${long}` : "Unknown");
  return { locationName, locationLat: lat, locationLong: long };
}

async function saveIncidentToGraph(incident) {
  const drv = getDriver();
  if (!drv) {
    return;
  }

  const session = drv.session();
  const locParams = locationToParams(incident.location);

  const params = {
    id: incident.id,
    event: incident.event,
    locationName: locParams.locationName,
    locationLat: locParams.locationLat,
    locationLong: locParams.locationLong,
    orgs: incident.orgs || [],
    severity_cues: incident.severity_cues || [],
    time_window: incident.time_window || null,
    summary: incident.summary,
    raw_sources: incident.raw_sources || [],
    severity: incident.severity || "High",
    confidence: incident.confidence || 0.0,
  };

  const mergeQuery = `
MERGE (e:Event {id: $id})
SET e.type = $event,
    e.summary = $summary,
    e.time_window = $time_window,
    e.severity_cues = $severity_cues,
    e.severity = $severity,
    e.confidence = $confidence,
    e.created_at = datetime()

WITH e
MERGE (loc:Location {name: $locationName})
SET loc.lat = $locationLat,
    loc.long = $locationLong
MERGE (e)-[:LOCATED_IN]->(loc)

WITH e
UNWIND $orgs AS orgName
MERGE (o:Org {name: orgName})
MERGE (e)-[:MENTIONS]->(o)

WITH e
UNWIND $raw_sources AS src
MERGE (s:Source {url: src.url})
SET s.title = src.title,
    s.reported_at = src.reported_at
MERGE (e)-[:REPORTED_BY]->(s)
`;

  try {
    await session.executeWrite((tx) => tx.run(mergeQuery, params));
  } finally {
    await session.close();
  }
}

/**
 * Verify Neo4j connection and return recent events with location and severity_cues.
 * Returns { connected: true, events: [...] } or { connected: false, error: string }.
 */
async function listRecentEvents(limit = 20) {
  const drv = getDriver();
  if (!drv) {
    return { connected: false, error: "Neo4j not configured (set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)" };
  }

  const session = drv.session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
      MATCH (e:Event)-[:LOCATED_IN]->(loc:Location)
      RETURN e.id AS id, e.type AS event, e.severity_cues AS severity_cues,
             e.summary AS summary, e.severity AS severity, e.created_at AS created_at,
             loc.name AS location_name, loc.lat AS location_lat, loc.long AS location_long
      ORDER BY e.created_at DESC
      LIMIT $limit
    `,
        { limit }
      )
    );
    const events = result.records.map((r) => ({
      id: r.get("id"),
      event: r.get("event"),
      location_name: r.get("location_name"),
      location_lat: r.get("location_lat"),
      location_long: r.get("location_long"),
      severity_cues: r.get("severity_cues"),
      severity: r.get("severity"),
      summary: r.get("summary"),
      created_at: r.get("created_at")?.toString?.() ?? r.get("created_at"),
    }));
    return { connected: true, count: events.length, events };
  } catch (err) {
    return { connected: false, error: err.message };
  } finally {
    await session.close();
  }
}

module.exports = {
  saveIncidentToGraph,
  listRecentEvents,
};

