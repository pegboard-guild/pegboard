# Docker Compose setup (Neo4j + FastAPI + frontend)

**Labels:** infrastructure, devops

**Description:**

Create a Docker Compose configuration that spins up the full Pegboard stack for local development.

**Services:**
1. **neo4j** — Neo4j Community Edition, pre-configured with APOC plugin, ports 7474 (browser) + 7687 (bolt)
2. **api** — FastAPI backend serving graph data, port 8000
3. **frontend** — Svelte dev server, port 5173
4. **ingestor** (optional profile) — runs ingestors on demand

**Implementation:**
1. Create `docker-compose.yml` at repo root
2. Create `Dockerfile` for the API service
3. Create `Dockerfile` for the frontend
4. Neo4j uses official image with volume mount for persistence
5. API service: Python 3.12, installs from `requirements.txt`
6. `.env.example` updated with all required env vars
7. Add a `Makefile` or scripts for common operations (`make ingest`, `make load-graph`, `make dev`)

**Acceptance criteria:**
- [ ] `docker compose up` starts all services
- [ ] Neo4j browser accessible at http://localhost:7474
- [ ] API serves a health check at http://localhost:8000/health
- [ ] Frontend loads at http://localhost:5173
- [ ] Data persists across restarts (Neo4j volume)
- [ ] README updated with Docker quickstart
- [ ] `.env.example` has all variables documented
