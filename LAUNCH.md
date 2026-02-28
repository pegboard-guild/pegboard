# Launch Kit

Everything you need to seed the repo and announce it. Copy-paste ready.

---

## GitHub Issues (create these after pushing)

### Issue 1: [Ingestor] FEC Campaign Contributions
**Labels:** `good first issue`, `ingestor`

```
The FEC has a well-documented, free API for campaign contribution data.

**What we need:** An ingestor that pulls campaign contributions for Texas elected officials and normalizes them to `Donor` and `Contribution` nodes in our graph schema.

**API:** https://api.open.fec.gov/developers/
**Auth:** Free API key (sign up at the link above)
**Rate limits:** 1,000 requests/hour

**Suggested approach:**
1. Start with individual contributions to TX congressional candidates
2. Map to `Donor` nodes (name, employer, occupation, total_amount)
3. Map to `Contribution` edges (amount, date, type)
4. Link contributions to existing `Official` nodes via FEC candidate IDs

**Reference:** See `ingestors/congress_members.py` for how the base ingestor works. The `BaseIngestor` class handles fetching, saving raw data, and logging.

**Output:** Normalized JSON files in `data/fec_contributions/normalized/`. No Neo4j needed to develop and test.

This is a great first contribution — the API is clean and well-documented.
```

---

### Issue 2: [Ingestor] USAspending Federal Contracts
**Labels:** `good first issue`, `ingestor`

```
USAspending.gov provides data on every federal contract, grant, and spending transaction. No API key required.

**What we need:** An ingestor that pulls federal contracts awarded in Texas (starting with DFW-area congressional districts) and normalizes them to `Contract` and `Agency` nodes.

**API:** https://api.usaspending.gov/api/v2
**Auth:** None required
**Docs:** https://api.usaspending.gov/docs/endpoints

**Key endpoints:**
- `/api/v2/search/spending_by_award/` — search contracts by location
- `/api/v2/awards/` — award details

**Suggested approach:**
1. Pull contracts by place of performance (Texas, DFW zip codes)
2. Create `Contract` nodes (title, amount, awardee, agency, dates)
3. Create `Agency` nodes for awarding agencies
4. Later: link contractors to `Donor` nodes to surface contractor → donor → official connections

No API key needed. This is one of the most accessible government APIs available.
```

---

### Issue 3: [Ingestor] Federal Register — Regulations & Executive Orders
**Labels:** `good first issue`, `ingestor`

```
The Federal Register API provides access to regulations, executive orders, and proposed rules. Free, no key required, clean JSON API.

**What we need:** An ingestor that pulls executive orders and significant regulations, particularly those affecting Texas or healthcare/infrastructure.

**API:** https://www.federalregister.gov/developers/api/v1
**Auth:** None
**Rate limits:** Generous

**Key endpoints:**
- `/api/v1/documents` — search documents by type, agency, date
- Types: `RULE`, `PRRULE` (proposed), `NOTICE`, `PRESDOCU` (executive orders)

**Suggested approach:**
1. Pull recent executive orders and significant final rules
2. Normalize to a new `Regulation` node type (title, agency, type, publication_date, abstract, federal_register_url)
3. Link to `Agency` nodes

This is the easiest API on our list — clean JSON, no auth, good docs. Great for a first contribution.
```

---

### Issue 4: [City] Dallas City Council — Votes & Agendas
**Labels:** `new-city`, `help wanted`

```
Dallas is our MVP city, but we don't have a council data ingestor yet. This is the most important local data source.

**What we need:** Council member info, voting records, meeting agendas, and minutes.

**Challenge:** Dallas doesn't have a clean API. Data lives on:
- https://dallascityhall.com/government/citysecretary/Pages/council-agendas.aspx
- https://dallas.legistar.com/ (Legistar platform — many cities use this)

**Legistar has an API:** https://webapi.legistar.com — if Dallas uses it, this becomes much easier. Need someone to investigate.

**If no API:** We'll need a scraper. That's fine — document what you find about the page structure and we'll build it.

**Even just documenting** what data is available and in what format is a valuable contribution. Open a comment with your findings.
```

---

### Issue 5: [City] Add Your City
**Labels:** `new-city`, `help wanted`, `discussion`

```
Pegboard starts in Dallas, but the architecture supports any city. 

**Want to add yours?** Here's what to do:

1. Research your city's public data sources:
   - Council/commission votes (many cities use Legistar — check if yours does)
   - City budget (often published as PDF or open data portal)
   - Contracts/procurement
   - Campaign finance (state ethics commission usually)

2. Comment below with:
   - City name and state
   - What data sources you found
   - Whether they have APIs, open data portals, or require scraping
   - Any quirks or access issues

3. If you want to build the ingestors, even better. See CONTRIBUTING.md for the template.

**Cities with Legistar** (https://webapi.legistar.com) are easiest to add — one ingestor pattern covers council data for dozens of cities.

Let's see how many cities we can map.
```

---

### Issue 6: [Design] Canvas UI — How should we visualize this?
**Labels:** `design`, `help wanted`, `discussion`

```
Layer 2 (The Canvas) is the visual interface for navigating the knowledge graph. We need design thinking before we start building.

**Questions to answer:**
- How do you show a representative's voting record without information overload?
- What does a useful "follow the money" visualization look like? (Donor → Contribution → Official → Vote → Bill → Contract → Contractor... is that contractor also a donor?)
- How should budget treemaps work at the city level?
- How do you zoom from federal → state → local without losing context?

**Constraints:**
- Must be accessible to non-technical citizens
- Mobile-friendly (people look this stuff up on their phones)
- Data-dense without being overwhelming

**What's helpful:**
- Wireframes or sketches (napkin quality is fine)
- Links to existing civic data visualizations you think work well
- UX patterns from other domains that might apply

Drop your ideas here. We'll consolidate into a design spec once patterns emerge.
```

---

## Launch Posts

### Hacker News (Show HN)

**Title:** `Show HN: Pegboard – Open-source civic transparency platform (knowledge graph of government data)`

```
Hey HN,

I built the foundation for an open-source platform that ingests public government data — votes, bills, budgets, contracts, campaign finance — into a knowledge graph and makes it navigable.

The problem: your city council voted on a $4.2B budget last Tuesday. A PAC funded by a construction company donated $50K to three council members who approved a $12M road contract to that same construction company. All public record. None of it easy to find.

Three layers:
- The Graph (Neo4j) — connects officials, votes, bills, budgets, contracts, and donors
- The Canvas (Svelte) — visual navigation, follow-the-money pathways
- The Forum — citizens comment anchored to data nodes, not in a void

The architecture is modular: each city/jurisdiction is a set of Python ingestors that feed the same graph schema. Dallas is first. Adding your city means writing ingestors for your local data sources.

Stack: Neo4j, Python/FastAPI, Svelte. AGPL-3.0.

The first ingestor (Congress.gov members) is working. FEC campaign finance, USAspending contracts, and Federal Register are tagged as good first issues.

I'm a physician in Dallas who wanted to know where his tax dollars go. I can steer the architecture but I can't build every city alone. If civic transparency is something you care about, take a look.

https://github.com/YOURUSER/pegboard
```

---

### Reddit r/opensource

**Title:** `Pegboard: open-source civic transparency platform — turning public government data into a navigable knowledge graph`

```
I started building an open-source platform that ingests public government data (votes, legislation, budgets, contracts, campaign finance) into a Neo4j knowledge graph and makes it searchable and visual.

**Why:** Government data is technically public but practically inaccessible. It's scattered across dozens of websites in formats designed for compliance, not comprehension. Following the money from a campaign donation to a vote to a contract award requires manually cross-referencing 5+ different government databases.

**How it works:**
- Python ingestors pull from public APIs (Congress.gov, FEC, USAspending, state legislatures, city councils)
- Data normalizes into a graph schema connecting officials, votes, bills, budgets, contracts, and donors
- Svelte frontend (planned) for visual navigation
- Forum layer (planned) where citizen discussion is anchored to data nodes

**What's built:** Base ingestor framework, Congress.gov members ingestor, full graph schema, architecture docs.

**What needs help:** More ingestors (FEC, USAspending, Federal Register are tagged as good first issues), city-specific scrapers, frontend design, and anyone who knows where their city publishes data.

The architecture is city-agnostic — adding a new city means writing ingestors for its data sources. The graph schema accommodates federal, state, and local government structures.

AGPL-3.0. Python 3.11+, Neo4j, FastAPI, Svelte.

GitHub: https://github.com/YOURUSER/pegboard

Not looking for stars — looking for people who want their city on the map.
```

---

### Reddit r/civictech

**Title:** `Open-source platform to make government data actually navigable — looking for contributors who know where civic data hides`

```
I'm building Pegboard — an open-source civic transparency tool that ingests public government data into a knowledge graph (Neo4j) and makes it browsable.

The core insight: the data to hold government accountable already exists in public records. The problem is that it's scattered across Congress.gov, FEC, USAspending, state ethics commissions, city secretary websites, and PDF budget documents. Nobody connects the dots.

Pegboard does the connecting. Officials → votes → bills. Donors → contributions → officials → contracts → contractors. Budget allocations → departments → spending.

**Where this community can help most:**
- You know where civic data lives. State-level campaign finance APIs, city council data portals, budget publication formats — that domain knowledge is the bottleneck, not the code.
- If your city uses Legistar, it probably has an API we can tap.
- Documenting data sources is as valuable as writing code right now.

Stack: Python ingestors, Neo4j graph, FastAPI, Svelte frontend. AGPL-3.0.

MVP covers Dallas (my city), but the architecture is designed for any jurisdiction. Each city is an independent set of ingestors feeding a shared schema.

https://github.com/YOURUSER/pegboard

Would love to hear which cities you'd want to see first and what data sources you know about.
```

---

## After Launch Checklist

- [ ] Push repo to GitHub
- [ ] Create the 6 issues above
- [ ] Enable GitHub Discussions
- [ ] Add topics to repo: `civic-tech`, `transparency`, `open-data`, `government`, `neo4j`, `knowledge-graph`, `open-source`
- [ ] Post to Hacker News (Show HN)
- [ ] Post to r/opensource
- [ ] Post to r/civictech
- [ ] Post to r/Dallas (local angle — "I built a tool to follow Dallas city budget money")
- [ ] Optional: r/python, r/sveltejs, r/neography
- [ ] Optional: Tweet/X thread
- [ ] Optional: LinkedIn post (use your existing audience)
