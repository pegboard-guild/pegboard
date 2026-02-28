# 📌 Pegboard

### Government data is public. Understanding it shouldn't require a lobbyist.

---

Pegboard is an open-source civic transparency platform. It ingests public government data — votes, legislation, budgets, contracts, campaign finance — into a knowledge graph, then makes it navigable, searchable, and discussable by anyone.

No editorializing. No spin. Just structured, verifiable, connected facts.

**[Architecture](ARCHITECTURE.md)** · **[Contributing](CONTRIBUTING.md)** · **[Good First Issues](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** · **[Roadmap](#roadmap)**

---

## The Problem

Your city council voted on a $4.2B budget last Tuesday. A PAC funded by a construction company donated $50K to three council members who approved a $12M road contract to... that same construction company.

All of this is public record. None of it is easy to find. The data exists across dozens of government websites, buried in PDFs, published in formats designed for compliance — not comprehension.

**The result:** The people with the most at stake — citizens — are the least equipped to follow the money.

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

## MVP: Dallas First

We're building the first city implementation. The architecture is designed so any city, county, or state can be added by writing ingestors for their data sources.

| Coverage | Sources |
|----------|---------|
| **Dallas City Council** | Votes, agendas, minutes, budget, contracts |
| **Texas Legislature** | Bills, votes, committees (DFW districts) |
| **Federal Delegation** | Congress.gov voting records, FEC campaign finance, USAspending contracts |
| **Campaign Finance** | FEC + Texas Ethics Commission |

**Your city is next.** The ingestor architecture is modular — if your government publishes data, Pegboard can consume it.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Graph Database** | Neo4j |
| **Backend** | Python · FastAPI |
| **Frontend** | Svelte |
| **Data Ingestors** | Python (httpx, APScheduler) |
| **License** | AGPL-3.0 |

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR-HANDLE/pegboard.git
cd pegboard

# Set up Python environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure (optional — DEMO_KEY works for Congress.gov)
cp .env.example .env

# Run the Congress members ingestor
python -m ingestors.congress_members
```

> **Neo4j not required to start contributing.** Ingestors output normalized JSON files to `data/` — you can build and test ingestors without a graph database running.

## Data Sources

| Source | What It Provides | API | Status |
|--------|-----------------|-----|--------|
| [Congress.gov](https://api.congress.gov) | Members, bills, votes, committees | ✅ Free (key required) | 🟢 Ingestor built |
| [FEC](https://api.open.fec.gov) | Campaign contributions, PAC spending | ✅ Free (key required) | 🟡 Planned |
| [USAspending.gov](https://api.usaspending.gov) | Federal contracts, grants | ✅ Free (no key) | 🟡 Planned |
| [Federal Register](https://www.federalregister.gov/developers) | Regulations, executive orders | ✅ Free (no key) | 🟡 Planned |
| [Texas Legislature](https://capitol.texas.gov) | TX bills, votes, committees | ⚠️ Scraping required | 🟡 Planned |
| [TX Ethics Commission](https://www.ethics.state.tx.us) | State campaign finance | ⚠️ Bulk download | 🟡 Planned |
| [Dallas City Secretary](https://dallascityhall.com) | Council votes, agendas, minutes | ⚠️ Scraping required | 🟡 Planned |

**Want to add a data source?** See [CONTRIBUTING.md](CONTRIBUTING.md#writing-an-ingestor) for the ingestor guide.

## Contributing

This project needs people who care about civic transparency — not just developers. Here's how you can help:

🔧 **Developers** — Write ingestors, build the Canvas UI, improve the graph schema
📊 **Data people** — Find and document government data sources for your city/state
🎨 **Designers** — Help make complex government data actually comprehensible
📝 **Writers** — Documentation, tutorials, data source guides
🏛️ **Civic nerds** — Domain expertise on how government data is structured and where it hides

**Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.** We label issues by difficulty and domain — look for `good first issue` if you're new.

## Roadmap

- [x] Project architecture and graph schema
- [x] Base ingestor framework
- [x] Congress.gov members ingestor (Texas delegation)
- [ ] Congress.gov bills & votes ingestors
- [ ] FEC campaign finance ingestor
- [ ] USAspending contracts ingestor
- [ ] Neo4j graph loader + schema constraints
- [ ] FastAPI endpoints for graph queries
- [ ] Dallas City Council scraper
- [ ] Texas Legislature ingestor
- [ ] Svelte Canvas (v1 — representative profiles)
- [ ] Forum layer (comments anchored to graph nodes)
- [ ] **Your city here** — add ingestors, expand the graph

## Philosophy

**Transparency about transparency.** This platform asks citizens to trust it with civic truth. So the code is open, the data sources are documented, the methodology is auditable. If the transparency tool isn't transparent, it's just another black box.

**Data, not opinion.** The Graph and the Canvas are purely factual. The Forum is where humans add interpretation. The separation is sacred.

**Local first.** National politics gets all the coverage. Your city council decides where the pothole money goes, which developer gets the zoning variance, which contractor gets the no-bid deal. Start there.

**Portable by design.** Dallas is first. The architecture is built so any city can be added. Government structures differ — the ingestor pattern accommodates that.

## Origin

Built by someone who wanted to know where their tax dollars go — and realized the tools didn't exist.

The core idea: a structured data layer beneath public discourse that anchors opinion to verifiable fact. The concept sat for years. Open source made it buildable.

## License

**AGPL-3.0** — If you deploy a modified version, you must share your source code. This ensures forks that serve the public stay open to the public. See [LICENSE](LICENSE).

---

<p align="center">
  <i>Government accountability shouldn't require a FOIA request and a data science degree.</i>
</p>
