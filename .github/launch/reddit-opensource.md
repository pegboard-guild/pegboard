# r/opensource Post

**Title:** Pegboard: open-source civic transparency platform — government data into a navigable knowledge graph (AGPL, Python + Neo4j + Svelte)

**Body:**

I've been building Pegboard, an open-source platform that ingests public government data and loads it into a knowledge graph so you can actually navigate it.

**The problem:** Government data is public but practically inaccessible. Campaign finance is on the FEC website. Votes are on Congress.gov. City council records are on Legistar. Lobbying disclosures are somewhere else. None of it links together. If you want to know who funded a representative and how they voted, you're doing manual research across five different sites.

**What Pegboard does:** Python ingestors pull from public APIs and normalize the data. A Neo4j graph stores the relationships — officials, bills, votes, donors, committees, lobbyists — all connected. A Svelte frontend (in progress) makes it visual and navigable.

**Architecture:**
- Layer 0: Ingestors — Python scripts, one per data source, extending a base class
- Layer 1: Graph — Neo4j with a defined schema for civic entities
- Layer 2: Canvas — Svelte SPA with treemaps, timelines, profile cards
- Layer 3: Forum — community annotations (future)

**What's built:** Congress members, bills, and FEC campaign finance ingestors are working. The graph schema is defined. 15 issues are up for grabs including city council ingestors for Austin, Chicago, NYC, LA, and Houston.

The modular city architecture means adding your city is writing one Python file. If your city publishes open data, it can be on Pegboard.

AGPL-3.0 licensed. Contributions welcome — especially from anyone in the civic tech space.

GitHub: [link]
