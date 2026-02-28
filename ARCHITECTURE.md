# Pegboard Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│              Layer 3: The Forum                  │
│  User comments, flags, investigations            │
│  Every post anchored to a graph node             │
│  Upvotes, threads, citation chains               │
├─────────────────────────────────────────────────┤
│              Layer 2: The Canvas                 │
│  Visual navigation (Svelte SPA)                  │
│  Federal → State → County → City zoom            │
│  Follow-the-money pathways                       │
│  Representative scorecards                       │
│  Budget treemaps, vote timelines                 │
├─────────────────────────────────────────────────┤
│              Layer 1: The Graph                  │
│  Neo4j knowledge graph                           │
│  Nodes: Officials, Bills, Votes, Budgets,        │
│         Contracts, Donors, Committees,            │
│         Agencies, Lobbyists                       │
│  Edges: voted_on, sponsored, funded_by,          │
│         awarded_to, donated_to, lobbied_for,     │
│         member_of, amended, allocated_to          │
├─────────────────────────────────────────────────┤
│              Layer 0: Ingestors                  │
│  Scheduled Python scripts                        │
│  Pull from public APIs → normalize → load graph  │
│  Dedup, entity resolution, change detection      │
└─────────────────────────────────────────────────┘
```

## Graph Schema (Core Nodes)

### Node Types

| Node | Key Properties | Primary Source |
|------|---------------|----------------|
| `Official` | name, office, party, district, term_start, term_end, level (federal/state/local) | Congress.gov, TX Legislature, Dallas City |
| `Bill` | number, title, summary, full_text, status, introduced_date, level | Congress.gov, TX Legislature |
| `Vote` | date, result, chamber, level | Congress.gov, TX Legislature, Dallas City |
| `VotePosition` | position (yea/nay/abstain/not_voting) | Congress.gov, TX Legislature |
| `Committee` | name, chamber, level | Congress.gov, TX Legislature |
| `Budget` | fiscal_year, department, category, amount, level | USAspending, Dallas Budget |
| `Contract` | title, amount, awardee, agency, start_date, end_date | USAspending, Dallas Procurement |
| `Donor` | name, employer, occupation, total_amount | FEC, TX Ethics Commission |
| `Contribution` | amount, date, type (individual/pac/corporate) | FEC, TX Ethics Commission |
| `Lobbyist` | name, firm, clients | OpenSecrets, TX Ethics |
| `Agency` | name, level, parent_agency | USAspending |

### Edge Types

| Edge | From → To | Meaning |
|------|-----------|---------|
| `CAST_VOTE` | Official → VotePosition | How they voted |
| `VOTE_ON` | VotePosition → Vote | Links position to the vote event |
| `VOTE_REGARDING` | Vote → Bill | What the vote was about |
| `SPONSORED` | Official → Bill | Primary sponsor |
| `COSPONSORED` | Official → Bill | Co-sponsor |
| `MEMBER_OF` | Official → Committee | Committee membership |
| `DONATED_TO` | Donor → Official | Campaign contribution |
| `LOBBIED_FOR` | Lobbyist → Bill | Lobbying activity |
| `AWARDED_TO` | Contract → Donor/Organization | Contract recipient |
| `FUNDED_BY` | Budget → Agency | Budget allocation |
| `EMPLOYED_BY` | Donor → Organization | Donor's employer |

## Data Ingestor Architecture

Each data source gets its own ingestor module:

```
pegboard/
├── ingestors/
│   ├── base.py              # Base ingestor class
│   ├── congress_members.py   # Congress.gov - members
│   ├── congress_bills.py     # Congress.gov - legislation
│   ├── congress_votes.py     # Congress.gov - roll call votes
│   ├── fec_contributions.py  # FEC - campaign finance
│   ├── usaspending.py        # USAspending - contracts & grants
│   ├── federal_register.py   # Federal Register - regulations
│   ├── tx_legislature.py     # Texas Legislature Online
│   ├── tx_ethics.py          # Texas Ethics Commission
│   ├── dallas_council.py     # Dallas City Council
│   └── dallas_budget.py      # Dallas city budget
├── graph/
│   ├── schema.py             # Neo4j schema definitions
│   ├── loader.py             # Graph loading utilities
│   └── queries.py            # Common graph queries
├── api/
│   ├── main.py               # FastAPI application
│   ├── routes/               # API endpoints
│   └── models/               # Pydantic models
├── frontend/
│   └── (Svelte app)
├── config.py
├── scheduler.py              # Cron-based ingestor scheduling
└── requirements.txt
```

## Ingestor Pipeline

```
Source API → Raw JSON → Normalize → Deduplicate → Entity Resolution → Neo4j Load
                                                        ↓
                                                  Change Detection
                                                  (track deltas)
```

Each ingestor run:
1. Pulls new/updated data since last run
2. Normalizes to internal schema
3. Deduplicates against existing graph nodes
4. Resolves entities (is "Robert Smith" the donor the same as "Bob Smith" the contractor?)
5. Loads into Neo4j with full provenance (source URL, retrieval timestamp, raw data hash)
6. Logs changes for audit trail

## MVP Scope (Dallas First)

### Phase 1: Federal Delegation (Week 1-2)
- All TX US House + Senate members
- 118th/119th Congress voting records
- Bills sponsored/cosponsored
- FEC campaign finance for TX delegation
- USAspending contracts in TX congressional districts

### Phase 2: Texas Legislature (Week 3-4)
- TX House + Senate members for DFW districts
- Current session bills and votes
- TX Ethics Commission campaign finance

### Phase 3: Dallas Local (Week 5-6)
- Dallas City Council members
- Council voting records
- City budget (department-level)
- City contracts/procurement

### Phase 4: The Canvas + Forum (Week 7-10)
- Svelte frontend
- Graph visualization
- Representative profiles/scorecards
- Comment/discussion system anchored to nodes
