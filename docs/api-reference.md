# API Reference

Base URL: `http://localhost:8000`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

## Health

### `GET /health`

```json
{"status": "ok", "neo4j": "connected"}
```

## Officials

### `GET /officials`

List officials with optional filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | State code (e.g., `TX`) |
| `party` | string | Party name |
| `chamber` | string | `Senate` or `House of Representatives` |

```bash
curl "http://localhost:8000/officials?state=TX&party=Republican"
```

### `GET /officials/{bioguide_id}`

Full profile for a single official.

```bash
curl http://localhost:8000/officials/C001098
```

### `GET /officials/{bioguide_id}/votes`

Voting record.

```bash
curl http://localhost:8000/officials/C001098/votes
```

### `GET /officials/{bioguide_id}/donors`

Top campaign donors.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 20 | Max results (1-100) |

```bash
curl "http://localhost:8000/officials/C001098/donors?limit=10"
```

### `GET /officials/{bioguide_id}/connections`

Follow-the-money connections for an official.

```bash
curl http://localhost:8000/officials/C001098/connections
```

## Bills

### `GET /bills`

| Parameter | Type | Description |
|-----------|------|-------------|
| `congress` | int | Congress number |
| `status` | string | Status filter (partial match) |
| `sponsor` | string | Sponsor bioguide_id |

```bash
curl "http://localhost:8000/bills?congress=118&sponsor=C001098"
```

### `GET /bills/{congress}/{number}`

Bill detail with sponsors and votes.

```bash
curl http://localhost:8000/bills/118/hr-1234
```

## Contracts

### `GET /contracts`

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | State code |
| `district` | int | Congressional district |
| `agency` | string | Agency name (partial match) |
| `min_amount` | float | Minimum dollar amount |

```bash
curl "http://localhost:8000/contracts?state=TX&min_amount=1000000"
```

### `GET /contracts/by-donor/{donor_name}`

Contracts awarded to a donor's employer.

```bash
curl "http://localhost:8000/contracts/by-donor/Smith"
```

## Search

### `GET /search`

Search across officials, bills, donors, and contracts.

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required, min 1 char) |

```bash
curl "http://localhost:8000/search?q=cruz"
```

Response:
```json
{
  "query": "cruz",
  "results": [
    {"type": "official", "id": "C001098", "name": "Cruz, Ted", "detail": "US Senator"}
  ],
  "total": 1
}
```

## Graph Visualization

### `GET /graph/connections/{bioguide_id}`

Nodes and edges for frontend graph rendering. Returns all connected entities: donors, organizations, contracts, committees.

```bash
curl http://localhost:8000/graph/connections/C001098
```

Response:
```json
{
  "nodes": [
    {"id": "C001098", "label": "Cruz, Ted", "type": "Official", "properties": {}},
    {"id": "donor-123", "label": "John Smith", "type": "Donor", "properties": {}}
  ],
  "edges": [
    {"source": "donor-123", "target": "C001098", "type": "DONATED_TO"}
  ]
}
```

### `GET /graph/money-flow/{bioguide_id}`

Donor → Official → Contract chain visualization. Shows the money trail.

```bash
curl http://localhost:8000/graph/money-flow/C001098
```
