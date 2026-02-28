# Neo4j graph loader — load normalized JSON into graph database

**Labels:** infrastructure, data, graph

**Description:**

Build a loader that takes the normalized JSON output from ingestors and loads it into a Neo4j graph database.

This bridges Layer 0 (Ingestors) and Layer 1 (The Graph) in Pegboard's architecture. The loader should be idempotent — running it twice with the same data shouldn't create duplicates.

**Implementation:**
1. Create `graph/loader.py`
2. Use the `neo4j` Python driver
3. Define Cypher MERGE queries for each node type (Official, Bill, Vote, Donor, etc.)
4. Define Cypher MERGE queries for each edge type (voted_on, sponsored, funded_by, etc.)
5. Read JSON files from `data/*/` directories
6. Batch-load with transactions (1000 nodes per transaction for performance)
7. Log stats: nodes created, relationships created, duplicates skipped

**Schema mapping** (from `ARCHITECTURE.md`):
- `Official` → `(:Official {bioguide_id, name, party, state, district})`
- `Bill` → `(:Bill {bill_id, title, congress, status})`
- `Vote` → `(:Vote {vote_id, date, result})`
- `Donor` → `(:Donor {name, employer, occupation})`
- Edges: `(official)-[:VOTED_ON {position}]->(vote)`, etc.

**Acceptance criteria:**
- [ ] Loader reads all JSON from `data/` and loads into Neo4j
- [ ] MERGE-based: idempotent, no duplicates on re-run
- [ ] Batch transactions for performance
- [ ] Connection config via environment variables (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`)
- [ ] Stats output (created/merged/errors)
- [ ] Tests with an embedded or mocked Neo4j instance
- [ ] README in `graph/` with setup instructions
