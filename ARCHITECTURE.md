# Pegboard Architecture

## System Overview

Pegboard has two complementary backend layers: a **Supabase layer** for real-time data serving and user interactions, and a **Graph layer** for deep connection analysis.

```
┌─────────────────────────────────────────────────┐
│              The Forum (Planned)                 │
│  User comments, flags, investigations            │
│  Every post anchored to a graph node             │
│  Upvotes, threads, citation chains               │
├─────────────────────────────────────────────────┤
│              The Canvas (React + TypeScript)      │
│  Objective Canvas — real-time civic dashboard     │
│  Multi-level representative profiles             │
│  Bill tracking, vote monitoring, spending data    │
│  Mobile-responsive, district-based lookup         │
├──────────────────────┬──────────────────────────┤
│   Supabase Layer     │   Graph Layer             │
│                      │                           │
│  PostgreSQL database │  Neo4j knowledge graph    │
│  Edge Functions      │  Python ingestors         │
│  (Deno/TypeScript)   │  FastAPI endpoints        │
│                      │                           │
│  Real-time subs      │  Connection analysis      │
│  API caching         │  Money-flow queries       │
│  Auth & RLS          │  Entity resolution        │
│                      │                           │
│  APIs served:        │  APIs served:             │
│  - Congress.gov      │  - Graph traversal        │
│  - OpenStates        │  - Search                 │
│  - Federal Register  │  - Money flow             │
│  - USAspending       │  - Officials network      │
│  - District lookup   │  - Contract connections   │
├──────────────────────┴──────────────────────────┤
│              Data Sources                        │
│  Congress.gov · OpenStates · USAspending ·       │
│  Federal Register · FEC · Dallas OpenData        │
└─────────────────────────────────────────────────┘
```

## Supabase Layer

The Supabase layer handles the live application:

### Edge Functions (Deno/TypeScript)
Located in `supabase/functions/`:

| Function | Purpose |
|----------|---------|
| `congress-api-v2` | Congress.gov proxy with intelligent caching |
| `congress-members` | Member lookup and profiles |
| `openstates-api` | State legislature data (all 50 states) |
| `openstates-api-v2` | Enhanced OpenStates with caching |
| `openstates-sync` | Bulk state data synchronization |
| `federal-register-api` | Federal Register documents |
| `usaspending-api` | Federal spending data |
| `district-lookup` | Address → district → representatives |
| `dallas-council-votes` | Dallas City Council voting records |
| `sync-bills` | Bill synchronization pipeline |
| `sync-votes` | Vote synchronization pipeline |
| `calculate-attribution` | Data attribution scoring |
| `govinfo-api` | GovInfo document access |
| `legiscan-api` | LegiScan bill tracking |

### Database (PostgreSQL)
- Migrations in `supabase/migrations/` (001–007)
- Row-Level Security for multi-tenant access
- Real-time subscriptions for live updates
- Caching layer for API rate limit management

## Graph Layer

The Graph layer provides deep analytical queries:

### Graph Schema (Core Nodes)

| Node | Key Properties | Primary Source |
|------|---------------|----------------|
| `Official` | name, office, party, district, level | Congress.gov, OpenStates |
| `Bill` | number, title, summary, status | Congress.gov, OpenStates |
| `Vote` | date, result, chamber, level | Congress.gov, OpenStates |
| `VotePosition` | position (yea/nay/abstain) | Congress.gov |
| `Committee` | name, chamber, level | Congress.gov |
| `Budget` | fiscal_year, department, amount | USAspending |
| `Contract` | title, amount, awardee, agency | USAspending |
| `Donor` | name, employer, total_amount | FEC |
| `Contribution` | amount, date, type | FEC |
| `Lobbyist` | name, firm, clients | OpenSecrets |
| `Agency` | name, level, parent_agency | USAspending |

### Edge Types

| Edge | From → To | Meaning |
|------|-----------|---------|
| `CAST_VOTE` | Official → VotePosition | How they voted |
| `VOTE_ON` | VotePosition → Vote | Links position to vote event |
| `VOTE_REGARDING` | Vote → Bill | What the vote was about |
| `SPONSORED` | Official → Bill | Primary sponsor |
| `COSPONSORED` | Official → Bill | Co-sponsor |
| `MEMBER_OF` | Official → Committee | Committee membership |
| `DONATED_TO` | Donor → Official | Campaign contribution |
| `LOBBIED_FOR` | Lobbyist → Bill | Lobbying activity |
| `AWARDED_TO` | Contract → Organization | Contract recipient |

## Directory Structure

```
pegboard/
├── frontend/              # React + TypeScript app
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API service layers
│   │   ├── pages/         # Route pages
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utilities
│   └── public/
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge Functions (Deno)
│   ├── migrations/        # Database migrations
│   └── config.toml
├── src/                   # Root-level React source (dev)
├── ingestors/             # Python data ingestors
│   ├── base.py            # Base ingestor class
│   ├── congress_members.py
│   ├── congress_bills.py
│   ├── fec_contributions.py
│   ├── usaspending.py
│   └── run_all.py
├── graph/                 # Neo4j graph layer
│   ├── schema.py
│   ├── loader.py
│   └── queries.py
├── api/                   # FastAPI application
│   ├── main.py
│   └── routes/
├── backend/               # SQL schemas & import scripts
├── data/                  # Processed data files
├── tests/                 # Python test suite
├── docs/                  # Documentation
├── config.py              # Python configuration
└── requirements.txt       # Python dependencies
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
4. Resolves entities
5. Loads into Neo4j with full provenance (source URL, timestamp, data hash)
6. Logs changes for audit trail

## MVP Scope (Dallas First)

### Phase 1: Federal Delegation ✅
- All TX US House + Senate members
- 118th/119th Congress voting records
- Bills sponsored/cosponsored
- FEC campaign finance for TX delegation
- USAspending contracts in TX congressional districts

### Phase 2: State Legislature (In Progress)
- TX House + Senate members for DFW districts via OpenStates
- Current session bills and votes
- All 50 states available through OpenStates integration

### Phase 3: Dallas Local (In Progress)
- Dallas City Council members
- Council voting records
- City budget (department-level)
- City contracts/procurement

### Phase 4: Forum Layer (Planned)
- Comment/discussion system anchored to graph nodes
- Citation chains linking opinions to data
