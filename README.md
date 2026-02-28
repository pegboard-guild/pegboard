# 📌 Pegboard

![CI](https://github.com/pegboard-guild/pegboard/actions/workflows/ci.yml/badge.svg)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://python.org)
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
| ✅ Base ingestor framework | Built |
| ✅ Congress.gov members ingestor | Built |
| ✅ Congress.gov bills ingestor | Built |
| ✅ FEC campaign finance ingestor | Built |
| ✅ USAspending contracts ingestor | Built |
| ✅ Neo4j graph schema + loader | Built |
| ✅ FastAPI with search, graph viz, money-flow endpoints | Built |
| 🔨 Dallas City Council scraper | In progress |
| 🔨 Texas Legislature ingestor | In progress |
| 📋 Svelte Canvas (frontend) | Planned |
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

Three layers, each building on the last:

```
┌─────────────────────────────────────────────────┐
│            🗣️  The Forum                         │
│  Citizens comment, flag, investigate.            │
│  Every post anchored to a data node.             │
│  Opinions come with receipts.                    │
├─────────────────────────────────────────────────┤
│            🗺️  The Canvas                        │
│  Visual navigation of the graph.                 │
│  Federal → State → County → City.                │
│  Follow the money. See the connections.          │
├─────────────────────────────────────────────────┤
│            🔗  The Graph                         │
│  Neo4j knowledge graph.                          │
│  Officials, votes, bills, budgets, contracts,    │
│  donors, lobbyists — all connected.              │
├─────────────────────────────────────────────────┤
│            ⚙️  Ingestors                         │
│  Automated pulls from public APIs.               │
│  Normalize → deduplicate → load.                 │
│  Full provenance on every data point.            │
└─────────────────────────────────────────────────┘
```

<!-- Screenshots of Neo4j graph queries coming soon -->

## Quick Start

```bash
# Clone and set up
git clone https://github.com/pegboard-guild/pegboard.git
cd pegboard
make setup
source .venv/bin/activate

# Configure (optional — DEMO_KEY works for Congress.gov)
cp .env.example .env

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

**Your city is next.** See [docs/writing-an-ingestor.md](docs/writing-an-ingestor.md) for the tutorial.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Graph Database** | Neo4j |
| **Backend** | Python · FastAPI |
| **Frontend** | Svelte |
| **Data Ingestors** | Python (httpx, APScheduler) |
| **License** | AGPL-3.0 |

## Data Sources

| Source | What It Provides | API | Status |
|--------|-----------------|-----|--------|
| [Congress.gov](https://api.congress.gov) | Members, bills, votes, committees | ✅ Free (key required) | 🟢 Built |
| [FEC](https://api.open.fec.gov) | Campaign contributions, PAC spending | ✅ Free (key required) | 🟢 Built |
| [USAspending.gov](https://api.usaspending.gov) | Federal contracts, grants | ✅ Free (no key) | 🟢 Built |
| [Federal Register](https://www.federalregister.gov/developers) | Regulations, executive orders | ✅ Free (no key) | 🟡 Planned |
| [Texas Legislature](https://capitol.texas.gov) | TX bills, votes, committees | ⚠️ Scraping required | 🟡 Planned |
| [TX Ethics Commission](https://www.ethics.state.tx.us) | State campaign finance | ⚠️ Bulk download | 🟡 Planned |
| [Dallas City Secretary](https://dallascityhall.com) | Council votes, agendas, minutes | ⚠️ Scraping required | 🟡 Planned |

**Want to add a data source?** See [docs/writing-an-ingestor.md](docs/writing-an-ingestor.md).

## Contributing

This project needs people who care about civic transparency — not just developers:

🔧 **Developers** — Write ingestors, build the Canvas UI, improve the graph schema
📊 **Data people** — Find and document government data sources for your city/state
🎨 **Designers** — Help make complex government data actually comprehensible
📝 **Writers** — Documentation, tutorials, data source guides
🏛️ **Civic nerds** — Domain expertise on how government data is structured and where it hides

**Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.** Look for `good first issue` labels.

## Roadmap

- [x] Project architecture and graph schema
- [x] Base ingestor framework
- [x] Congress.gov members ingestor
- [x] Congress.gov bills & votes ingestors
- [x] FEC campaign finance ingestor
- [x] USAspending contracts ingestor
- [x] Neo4j graph loader + schema constraints
- [x] FastAPI endpoints for graph queries
- [ ] Dallas City Council scraper
- [ ] Texas Legislature ingestor
- [ ] Svelte Canvas (v1 — representative profiles)
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
