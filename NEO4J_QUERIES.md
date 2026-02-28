# Neo4j: View incidents from Tavily → Fastino-style extraction

After you **Run Agent** in the app, incidents are written to Neo4j (when `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` are set in `.env`).

## Graph shape

- **(Event)** – one per incident (id, type, summary, severity_cues, severity, confidence)
- **(Location)** – name (place name or "lat,long" when only coords), optional `lat` and `long` for coordinates
- **(Org)** – organizations mentioned (USGS, Reuters, etc.)
- **(Source)** – each Tavily article (url, title, reported_at)

Relationships:

- `(Event)-[:LOCATED_IN]->(Location)`
- `(Event)-[:MENTIONS]->(Org)`
- `(Event)-[:REPORTED_BY]->(Source)`

## Run these in Neo4j Browser

**All events and their location:**
```cypher
MATCH (e:Event)-[:LOCATED_IN]->(loc:Location)
RETURN e.id, e.type, e.severity, e.severity_cues, loc.name
ORDER BY e.created_at DESC
LIMIT 20;
```

**Full graph for one event (replace the id with a real one):**
```cypher
MATCH (e:Event {id: "incident-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"})
OPTIONAL MATCH (e)-[:LOCATED_IN]->(loc:Location)
OPTIONAL MATCH (e)-[:MENTIONS]->(o:Org)
OPTIONAL MATCH (e)-[:REPORTED_BY]->(s:Source)
RETURN e, loc, o, s;
```

**Events and all connected nodes (visual graph):**
```cypher
MATCH (e:Event)-[r]-(n)
RETURN e, r, n
LIMIT 100;
```

**List events with severity cues (Fastino-style):**
```cypher
MATCH (e:Event)-[:LOCATED_IN]->(loc:Location)
RETURN e.id, e.type AS event, loc.name AS location, e.severity_cues, e.summary
ORDER BY e.created_at DESC
LIMIT 10;
```

## Optional: create constraints once (Neo4j Browser)

Run once if you want unique constraints:

```cypher
CREATE CONSTRAINT unique_event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT unique_location_name IF NOT EXISTS FOR (l:Location) REQUIRE l.name IS UNIQUE;
CREATE CONSTRAINT unique_org_name IF NOT EXISTS FOR (o:Org) REQUIRE o.name IS UNIQUE;
CREATE CONSTRAINT unique_source_url IF NOT EXISTS FOR (s:Source) REQUIRE s.url IS UNIQUE;
```
