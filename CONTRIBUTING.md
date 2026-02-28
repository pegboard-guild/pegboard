# Contributing to Pegboard

Thanks for wanting to help make government data accessible. Here's how to get involved.

## Ways to Contribute

### 🔧 Write an Ingestor

This is the highest-impact contribution right now. Each government data source needs a Python ingestor that pulls, normalizes, and outputs structured data.

**What an ingestor does:**
1. Fetches data from a public API or website
2. Normalizes it to Pegboard's graph schema (see [ARCHITECTURE.md](ARCHITECTURE.md))
3. Saves raw responses (audit trail) and normalized JSON (graph-ready)
4. Logs run stats

**Template:**

```python
from .base import BaseIngestor, console

class MyIngestor(BaseIngestor):
    name = "my_source"
    source_url = "https://api.example.gov"

    def run(self):
        console.print("[bold blue]═══ My Source Ingestor ═══[/bold blue]")
        
        # 1. Fetch from API
        data = self.fetch("https://api.example.gov/endpoint", params={...})
        self.save_raw("response", data)
        
        # 2. Normalize to graph schema
        normalized = []
        for item in data["results"]:
            normalized.append({
                "node_type": "Official",  # or Bill, Vote, Contract, etc.
                "name": item["name"],
                # ... map to schema fields
                "source": "example.gov",
                "source_id": item["id"],
            })
        
        # 3. Save
        self.save_normalized("records", normalized)
        self.log_run()
        return normalized
```

**No Neo4j needed.** Ingestors output JSON files. You can develop and test without a database.

**Good first ingestors to build:**
- `fec_contributions.py` — FEC campaign finance (well-documented API, free key)
- `usaspending.py` — Federal contracts and grants (no key needed)
- `federal_register.py` — Regulations and executive orders (no key needed)

### 🏛️ Add Your City

Pegboard starts in Dallas but is designed for any jurisdiction. To add your city:

1. **Research available data sources** — Does your city publish council votes? Budget data? Contracts? In what format?
2. **Open an issue** with the `new-city` label documenting what you found
3. **Write ingestors** for each data source (or just document the sources and someone else can build them)

### 📊 Document Data Sources

Even without writing code, you can help enormously:
- Find public government APIs or data portals we haven't listed
- Document their endpoints, formats, rate limits, and quirks
- Note which data requires scraping vs. has a proper API

Open an issue with the `data-source` label.

### 🎨 Design & Frontend

The Canvas (Svelte frontend) needs design thinking:
- How do you visualize a knowledge graph without overwhelming people?
- What does a useful "representative scorecard" look like?
- How should budget treemaps work?

Open an issue with the `design` label with mockups, sketches, or ideas.

### 🐛 Report Issues

Found a bug? Data inaccuracy? Missing edge case? Open an issue.

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/pegboard.git
cd pegboard

# Python environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # adds pytest, ruff, mypy

# Get API keys (optional — DEMO_KEY works for testing)
cp .env.example .env
# Edit .env with your keys from:
#   Congress.gov: https://api.congress.gov/sign-up/
#   FEC: https://api.open.fec.gov/developers/

# Run tests
pytest

# Run linter
ruff check .

# Run an ingestor
python -m ingestors.congress_members
```

## Code Standards

- **Python 3.11+** with type hints
- **Formatting:** `ruff format`
- **Linting:** `ruff check`
- **Tests:** pytest — every ingestor should have tests with mocked API responses
- **Docstrings:** Every module, class, and public function

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Write your code with tests
3. Run `ruff check .` and `pytest`
4. Open a PR with:
   - What it does (1-2 sentences)
   - What data source it covers (if an ingestor)
   - Sample output (paste a few lines of normalized JSON)
5. A maintainer will review within a few days

## Commit Messages

Keep them clear and descriptive:
```
feat(ingestor): add FEC campaign contribution ingestor
fix(congress): handle pagination edge case for large result sets
docs: add Chicago data source documentation
test(fec): add mock response tests for contribution normalization
```

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Short version: be decent, assume good faith, focus on the work.

## Questions?

Open a [Discussion](../../discussions) or an issue tagged `question`. No question is too basic.

---

*The more cities, the more connections, the more transparency. Every ingestor you write opens a window into government that didn't exist before.*
