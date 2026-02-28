# 📌 Pegboard

![CI](https://github.com/pegboard-guild/pegboard/actions/workflows/ci.yml/badge.svg)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-React-blue.svg)](frontend/)
[![GitHub stars](https://img.shields.io/github/stars/pegboard-guild/pegboard)](https://github.com/pegboard-guild/pegboard/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/pegboard-guild/pegboard)](https://github.com/pegboard-guild/pegboard/commits/main)

### Government data is public. Understanding it shouldn't require a lobbyist.

Pegboard is an open-source civic transparency platform. It ingests public government data — votes, legislation, budgets, contracts, campaign finance — into a knowledge graph, then makes it navigable, searchable, and discussable by anyone.

No editorializing. No spin. Just structured, verifiable, connected facts.

**[Docs](docs/)** · **[Architecture](ARCHITECTURE.md)** · **[Contributing](CONTRIBUTING.md)** · **[Good First Issues](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)**

---

## Status

| Component | Status |
|-----------|--------|
| ✅ React + TypeScript frontend with Objective Canvas | Live |
| ✅ Supabase backend (PostgreSQL, Edge Functions, Auth) | Live |
| ✅ Multi-level representative lookup (Federal → State → Local) | Live |
| ✅ Real-time bill tracking & vote monitoring | Live |
| ✅ Congress.gov API integration (members, bills, votes) | Live |
| ✅ OpenStates API integration (50-state legislature data) | Live |
| ✅ Federal Register integration | Live |
| ✅ USAspending contracts integration | Live |
| ✅ District-based representative lookup | Live |
| ✅ Intelligent API caching layer | Live |
| ✅ Base ingestor framework (Python) | Built |
| ✅ Neo4j graph schema + loader | Built |
| ✅ FastAPI with search, graph viz, money-flow endpoints | Built |
| ✅ FEC campaign finance ingestor | Built |
| 🔨 Dallas City Council scraper | In progress |
| 🔨 Texas Legislature ingestor | In progress |
| 📋 Forum layer (comments on graph nodes) | Planned |

---

## The Problem

Your city council voted on a $4.2B budget last Tuesday. A PAC funded by a construction company donated $50K to three council members who approved a $12M road contract to... that same construction company.

All of this is public record. None of it is easy to find. The data exists across dozens of government websites, buried in PDFs, published in formats designed for compliance — not comprehension.

**The result:** The people with the most at stake — citizens — are the least equipped to follow the money.

## Why Not Just Use [X]?

**OpenSecrets** — Excellent for federal campaign finance. But it's federal-only. Your city council, county commissioners, and state legislature aren't covered. Pegboard connects all levels.

**Follow The Money** — Good state-level data. But it's a flat database, not a knowledge graph. You can look up donations, but you can't trace Donor → Official → Contract in one query. Pegboard makes those connections explicit.

**City open data portals** — Raw data dumps. CSVs with no cross-referencing. You can download your city's contracts, but nothing links them to the council members who approved them or the donors who funded their campaigns. Pegboard builds the graph.

## How Pegboard Works

Two complementary layers:

```
┌─────────────────────────────────────────────────┐
│         🖥️  The App (Supabase + React)           │
│  Real-time UI: representative profiles, bills,   │
│  votes, spending. Supabase Edge Functions for     │
│  Congress.gov, OpenStates, Federal Register,      │
│  USAspending APIs. PostgreSQL + caching layer.    │
├─────────────────────────────────────────────────┤
│         🔗  The Graph (Neo4j + Python)           │
│  Knowledge graph for connection analysis.         │
│  Trace money flows: Donor → Official → Contract.  │
│  Python ingestors pull from public APIs.          │
│  FastAPI serves graph queries.                    │
├─────────────────────────────────────────────────┤
│         🗣️  The Forum (Planned)                  │
│  Citizens comment, flag, investigate.             │
│  Every post anchored to a data node.              │
│  Opinions come with receipts.                     │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone & configure environment

```bash
git clone https://github.com/pegboard-guild/pegboard.git
cd pegboard

# Copy env templates
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

### 2. Get your free API keys

| Variable | Required? | Sign up |
|----------|-----------|---------|
| `CONGRESS_API_KEY` | Recommended | [api.congress.gov/sign-up](https://api.congress.gov/sign-up/) |
| `FEC_API_KEY` | Recommended | [api.open.fec.gov/developers](https://api.open.fec.gov/developers/) |
| `OPENSTATES_API_KEY` | Recommended | [openstates.org/accounts/signup](https://openstates.org/accounts/signup/) |
| `GOOGLE_CIVIC_API_KEY` | Optional | [GCP Console](https://console.cloud.google.com/apis/library/civicinfo.googleapis.com) |
| `NEO4J_URI/USER/PASSWORD` | Optional | Only if running Neo4j locally |
| `SUPABASE_URL/ANON_KEY` | Optional | Only if using Supabase backend |
| USAspending API | — | **No key required** |

Add your keys to `.env` (backend) and `frontend/.env.local` (frontend, use `REACT_APP_` prefix).

### 3. Frontend (React + Supabase)

```bash
cd frontend
npm install
npm start
```

### 4. Graph Layer (Python + Neo4j)

```bash
cd pegboard
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the Congress members ingestor
python -m ingestors.congress_members

# Run tests
make test
```

> **Neo4j not required to start contributing.** Ingestors output normalized JSON to `data/` — you can build and test ingestors without a graph database.

See **[docs/getting-started.md](docs/getting-started.md)** for the full setup guide including Docker and Neo4j.

## MVP: Dallas First

We're building the first city implementation. The architecture is designed so any city, county, or state can be added by writing ingestors for their data sources.

| Coverage | Sources |
|----------|---------|
| **Dallas City Council** | Votes, agendas, minutes, budget, contracts |
| **Texas Legislature** | Bills, votes, committees (DFW districts) |
| **Federal Delegation** | Congress.gov voting records, FEC campaign finance, USAspending contracts |
| **Campaign Finance** | FEC + Texas Ethics Commission |
| **All 50 States** | State legislator data via OpenStates |

**Your city is next.** See [docs/writing-an-ingestor.md](docs/writing-an-ingestor.md) for the tutorial.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React · TypeScript · Mobile-responsive |
| **Backend** | Supabase (PostgreSQL, Edge Functions, Real-time, Auth) |
| **Graph Database** | Neo4j (connection analysis) |
| **Graph API** | Python · FastAPI |
| **Data Ingestors** | Python (httpx, APScheduler) · Deno (Supabase Edge Functions) |
| **Data Sources** | Congress.gov, OpenStates, USASpending, Federal Register, FEC, Dallas OpenData |
| **License** | AGPL-3.0 |

## Data Sources

| Source | What It Provides | API | Status |
|--------|-----------------|-----|--------|
| [Congress.gov](https://api.congress.gov) | Members, bills, votes, committees | ✅ Free (key required) | 🟢 Live |
| [OpenStates](https://openstates.org) | State legislators, bills (all 50 states) | ✅ Free (key required) | 🟢 Live |
| [USAspending.gov](https://api.usaspending.gov) | Federal contracts, grants | ✅ Free (no key) | 🟢 Live |
| [Federal Register](https://www.federalregister.gov/developers) | Regulations, executive orders | ✅ Free (no key) | 🟢 Live |
| [FEC](https://api.open.fec.gov) | Campaign contributions, PAC spending | ✅ Free (key required) | 🟢 Built |
| [Texas Legislature](https://capitol.texas.gov) | TX bills, votes, committees | ⚠️ Scraping required | 🟡 Planned |
| [TX Ethics Commission](https://www.ethics.state.tx.us) | State campaign finance | ⚠️ Bulk download | 🟡 Planned |
| [Dallas City Secretary](https://dallascityhall.com) | Council votes, agendas, minutes | ⚠️ Scraping required | 🟡 Planned |

**Want to add a data source?** See [docs/writing-an-ingestor.md](docs/writing-an-ingestor.md).

## Contributing

This project needs people who care about civic transparency — not just developers:

🔧 **Developers** — Write ingestors, build UI components, improve the graph schema
📊 **Data people** — Find and document government data sources for your city/state
🎨 **Designers** — Help make complex government data actually comprehensible
📝 **Writers** — Documentation, tutorials, data source guides
🏛️ **Civic nerds** — Domain expertise on how government data is structured and where it hides

**Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.** Look for `good first issue` labels.

## Roadmap

- [x] React + TypeScript frontend with Objective Canvas
- [x] Supabase backend with Edge Functions
- [x] Multi-level representative lookup
- [x] Congress.gov API integration
- [x] OpenStates integration (50-state coverage)
- [x] Federal Register integration
- [x] USAspending integration
- [x] Intelligent caching layer
- [x] Base ingestor framework (Python)
- [x] Neo4j graph schema + loader
- [x] FastAPI graph query endpoints
- [x] FEC campaign finance ingestor
- [ ] Dallas City Council scraper
- [ ] Texas Legislature ingestor
- [ ] Forum layer (comments anchored to graph nodes)
- [ ] **Your city here** — add ingestors, expand the graph

## Philosophy

**Transparency about transparency.** The code is open, the data sources are documented, the methodology is auditable. If the transparency tool isn't transparent, it's just another black box.

**Data, not opinion.** The Graph and the Canvas are purely factual. The Forum is where humans add interpretation. The separation is sacred.

**Local first.** National politics gets all the coverage. Your city council decides where the pothole money goes, which developer gets the zoning variance, which contractor gets the no-bid deal. Start there.

**Portable by design.** Dallas is first. The architecture is built so any city can be added.

## License

**AGPL-3.0** — If you deploy a modified version, you must share your source code. This ensures forks that serve the public stay open to the public. See [LICENSE](LICENSE).

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=pegboard-guild/pegboard&type=Date)](https://star-history.com/#pegboard-guild/pegboard&Date)

---

<p align="center">
  <i>Government accountability shouldn't require a FOIA request and a data science degree.</i>
</p>
