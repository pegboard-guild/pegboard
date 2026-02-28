# Writing an Ingestor

Ingestors pull data from public government APIs, normalize it, and save it for graph loading. This guide walks through adding a new one.

## Architecture

Every ingestor extends `BaseIngestor` from `ingestors/base.py`:

```python
class BaseIngestor:
    name: str          # Unique identifier, used for data directory
    source_url: str    # Documentation URL for the data source

    def fetch(self, url, params=None) -> dict | list | None
    def save_raw(self, filename, data)        # Audit trail
    def save_normalized(self, filename, data)  # Graph-ready output
    def log_run(self)                          # Stats logging
    def run(self)                              # Override this
```

Data flows through: **API → raw JSON → normalize → save**

## Example: Congress Members Ingestor

Here's the pattern from `ingestors/congress_members.py` (simplified):

```python
from ingestors.base import BaseIngestor, console


class CongressMembersIngestor(BaseIngestor):
    name = "congress_members"
    source_url = "https://api.congress.gov/v3/member"

    def run(self):
        console.print("[bold blue]═══ Congress Members Ingestor ═══[/bold blue]")

        # 1. Fetch raw data
        raw_members = self._get_members(state="TX")
        self.save_raw("tx_members_list", raw_members)

        # 2. Normalize each record
        normalized = []
        for raw in raw_members:
            member = self._normalize_member(raw)
            normalized.append(member)
            self.stats["new"] += 1

        # 3. Save normalized output
        self.save_normalized("tx_members", normalized)
        self.log_run()
        return normalized
```

## Step-by-Step: Add Your City Council Ingestor

### 1. Create the file

```bash
touch ingestors/my_city_council.py
```

### 2. Write the ingestor

```python
"""Ingestor for My City Council data.

Source: https://mycity.gov/opendata/council
"""
import time
from ingestors.base import BaseIngestor, console


class MyCityCouncilIngestor(BaseIngestor):
    name = "my_city_council"
    source_url = "https://mycity.gov/opendata/council"

    def _get_council_members(self) -> list[dict]:
        """Fetch council member records from the city API."""
        url = f"{self.source_url}/members"
        data = self.fetch(url)
        if not data:
            return []
        return data.get("results", [])

    def _normalize_member(self, raw: dict) -> dict:
        """Convert raw API record to Pegboard graph format."""
        return {
            "node_type": "Official",
            "name": raw.get("full_name", ""),
            "office": "City Council Member",
            "district": raw.get("district_number"),
            "party": raw.get("party", ""),
            "level": "local",        # federal / state / local
            "source": "mycity.gov",
            "source_id": f"mycity-{raw.get('id', '')}",
        }

    def run(self):
        console.print("[bold blue]═══ My City Council Ingestor ═══[/bold blue]")

        raw = self._get_council_members()
        self.save_raw("council_members", raw)

        normalized = [self._normalize_member(m) for m in raw]
        self.save_normalized("council_members", normalized)
        self.stats["new"] = len(normalized)
        self.log_run()
        return normalized


if __name__ == "__main__":
    MyCityCouncilIngestor().run()
```

### 3. Register it

In `ingestors/__init__.py`, add your class to `ALL_INGESTORS`:

```python
from .my_city_council import MyCityCouncilIngestor

ALL_INGESTORS = [
    CongressMembersIngestor,
    MyCityCouncilIngestor,
    # ...
]
```

### 4. Write tests

Create `tests/test_my_city_council.py`:

```python
"""Tests for My City Council ingestor."""
import pytest
from pytest_httpx import HTTPXMock
from ingestors.my_city_council import MyCityCouncilIngestor


@pytest.fixture
def ingestor():
    return MyCityCouncilIngestor()


def test_normalize_member(ingestor):
    raw = {"id": "42", "full_name": "Jane Smith", "district_number": 3, "party": ""}
    result = ingestor._normalize_member(raw)
    assert result["node_type"] == "Official"
    assert result["name"] == "Jane Smith"
    assert result["level"] == "local"
    assert result["source_id"] == "mycity-42"


def test_run_with_mock(ingestor, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://mycity.gov/opendata/council/members",
        json={"results": [{"id": "1", "full_name": "Test Person", "district_number": 1, "party": ""}]},
    )
    result = ingestor.run()
    assert len(result) == 1
```

### 5. Run it

```bash
make test                              # Verify tests pass
python -m ingestors.my_city_council    # Run standalone
make ingest                            # Run all ingestors
```

## Normalization Rules

- Every record needs `node_type` (matches a graph node label)
- Every record needs `source` and `source_id` (provenance)
- Use `level`: `federal`, `state`, or `local`
- Dates as ISO 8601 strings
- Money amounts as floats (USD)
- Be respectful with rate limits — add `time.sleep()` between requests

## Finding Data Sources

Government data hides in predictable places:
- `{city}.gov/opendata` or `data.{city}.gov`
- Socrata portals (many cities use these)
- State legislature websites (often have undocumented APIs)
- FOIA request logs (sometimes published online)

If a source requires scraping rather than an API, note it in the module docstring and be extra careful about rate limiting.
