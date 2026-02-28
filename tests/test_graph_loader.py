"""Tests for graph loader — validates MERGE queries and batch logic."""
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

# Add parent to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from graph.loader import GraphLoader, _hash, _load_json, _batch


class TestHelpers:
    def test_hash_deterministic(self):
        data = {"name": "test", "value": 123}
        assert _hash(data) == _hash(data)

    def test_hash_different_for_different_data(self):
        assert _hash({"a": 1}) != _hash({"a": 2})

    def test_load_json_missing_file(self):
        assert _load_json(Path("/nonexistent.json")) == []

    def test_load_json_valid(self, tmp_path):
        f = tmp_path / "test.json"
        f.write_text(json.dumps([{"id": 1}, {"id": 2}]))
        assert len(_load_json(f)) == 2

    def test_load_json_single_object(self, tmp_path):
        f = tmp_path / "test.json"
        f.write_text(json.dumps({"id": 1}))
        result = _load_json(f)
        assert len(result) == 1

    def test_batch(self):
        items = list(range(10))
        batches = list(_batch(items, 3))
        assert len(batches) == 4
        assert batches[0] == [0, 1, 2]
        assert batches[-1] == [9]


class TestGraphLoader:
    def setup_method(self):
        self.mock_driver = MagicMock()
        self.mock_session = MagicMock()
        self.mock_driver.session.return_value.__enter__ = MagicMock(return_value=self.mock_session)
        self.mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)
        self.loader = GraphLoader(self.mock_driver)

    def test_load_officials_uses_merge(self):
        officials = [{
            "bioguide_id": "T000123",
            "name": "Test Person",
            "first_name": "Test",
            "last_name": "Person",
            "party": "D",
            "state": "TX",
            "district": 30,
            "chamber": "House",
            "level": "federal",
            "office": "US Representative",
            "term_start": 2023,
            "term_end": 2025,
            "url": "",
            "source": "congress.gov",
        }]
        self.loader.load_officials(officials)
        cypher_call = self.mock_session.run.call_args
        assert "MERGE" in cypher_call[0][0]
        assert "Official" in cypher_call[0][0]

    def test_load_bills_uses_merge_and_sponsored(self):
        bills = [{
            "source_id": "119-HR1",
            "bill_id": "HR1",
            "congress": 119,
            "bill_type": "HR",
            "number": "1",
            "title": "Test Bill",
            "introduced_date": "2025-01-01",
            "status": "Introduced",
            "status_date": "2025-01-01",
            "level": "federal",
            "summary": "",
            "policy_area": "",
            "url": "",
            "source": "congress.gov",
            "sponsor_bioguide": "T000123",
        }]
        self.loader.load_bills(bills)
        cypher = self.mock_session.run.call_args[0][0]
        assert "MERGE" in cypher
        assert "SPONSORED" in cypher

    def test_load_donors_uses_merge(self):
        donors = [{
            "source_id": "john_doe",
            "name": "John Doe",
            "employer": "Acme Corp",
            "occupation": "Engineer",
            "city": "Dallas",
            "state": "TX",
            "source": "fec.gov",
        }]
        self.loader.load_donors(donors)
        cypher = self.mock_session.run.call_args[0][0]
        assert "MERGE" in cypher
        assert "Donor" in cypher

    def test_load_contracts_uses_merge(self):
        contracts = [{
            "source_id": "contract-1",
            "award_id": "A1",
            "title": "Test Contract",
            "amount": 100000,
            "awardee": "Acme Corp",
            "agency": "DOD",
            "sub_agency": "",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "county": "DALLAS",
            "level": "federal",
            "source": "usaspending.gov",
        }]
        self.loader.load_contracts(contracts)
        cypher = self.mock_session.run.call_args[0][0]
        assert "MERGE" in cypher
        assert "Contract" in cypher

    def test_stats_tracking(self):
        officials = [{
            "bioguide_id": "T000123", "name": "Test", "first_name": "T", "last_name": "T",
            "party": "D", "state": "TX", "district": 1, "chamber": "House",
            "level": "federal", "office": "Rep", "term_start": 2023, "term_end": 2025,
            "url": "", "source": "test",
        }]
        self.loader.load_officials(officials)
        assert self.loader.stats.get("officials", 0) == 1

    def test_load_all_graceful_with_empty_dir(self, tmp_path):
        """load_all should not crash with empty/missing data dirs."""
        self.loader.load_all(tmp_path)
        # No exception means success


class TestLoadAll:
    def test_load_all_finds_normalized_files(self, tmp_path):
        """Verify load_all reads from correct normalized paths."""
        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__ = MagicMock(return_value=mock_session)
        mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)

        # Create a members file
        members_dir = tmp_path / "congress_members" / "normalized"
        members_dir.mkdir(parents=True)
        (members_dir / "tx_members.json").write_text(json.dumps([{
            "bioguide_id": "X000001", "name": "X", "first_name": "X", "last_name": "X",
            "party": "R", "state": "TX", "district": 1, "chamber": "House",
            "level": "federal", "office": "Rep", "term_start": 2023, "term_end": 2025,
            "url": "", "source": "test", "committees": [],
        }]))

        loader = GraphLoader(mock_driver)
        loader.load_all(tmp_path)
        assert loader.stats.get("officials", 0) == 1
