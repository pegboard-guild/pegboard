# Getting Started

## Prerequisites

- Python 3.11+
- Git
- (Optional) Docker & Docker Compose
- (Optional) Neo4j 5.x

## Option A: Local Setup

```bash
git clone https://github.com/pegboard-guild/pegboard.git
cd pegboard

# Install everything
make setup
source .venv/bin/activate

# Copy env config (DEMO_KEY works for Congress.gov)
cp .env.example .env

# Run tests to verify setup
make test
```

### Run an ingestor

```bash
python -m ingestors.congress_members
```

Output lands in `data/congress_members/normalized/`. No database needed — you can inspect the JSON directly.

### Start the API (requires Neo4j)

```bash
# Start Neo4j (Docker is easiest)
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/pegboard123 neo4j:5

# Load data into graph
make load-graph

# Start the API
make serve
# → http://localhost:8000/docs
```

## Option B: Docker Compose

```bash
git clone https://github.com/pegboard-guild/pegboard.git
cd pegboard
cp .env.example .env

docker compose up -d
# API: http://localhost:8000
# Neo4j Browser: http://localhost:7474
```

## First Query

Once the API is running with data loaded:

```bash
# List Texas officials
curl http://localhost:8000/officials?state=TX

# Search across all entities
curl "http://localhost:8000/search?q=cruz"

# Get an official's connections (follow the money)
curl http://localhost:8000/graph/connections/C001098
```

## Next Steps

- [Write an ingestor](writing-an-ingestor.md) for your city
- [Explore the graph schema](graph-schema.md)
- [API reference](api-reference.md)
