"""Tests for USAspending ingestor normalization."""
import pytest
from ingestors.usaspending import USASpendingIngestor, DFW_COUNTIES


@pytest.fixture
def ingestor():
    return USASpendingIngestor()


SAMPLE_AWARD = {
    "Award ID": "W911NF2510001",
    "generated_internal_id": "abc123",
    "Description": "Research support services",
    "Award Amount": 1500000.0,
    "Recipient Name": "LOCKHEED MARTIN CORP",
    "Awarding Agency": "Department of Defense",
    "Awarding Sub Agency": "Army",
    "Start Date": "2025-01-01",
    "End Date": "2026-12-31",
    "Place of Performance County Name": "DALLAS",
    "Place of Performance State Code": "TX",
}


class TestUSASpendingNormalization:
    def test_normalize_contract(self, ingestor):
        result = ingestor._normalize_contract(SAMPLE_AWARD)
        assert result["node_type"] == "Contract"
        assert result["amount"] == 1500000.0
        assert result["awardee"] == "LOCKHEED MARTIN CORP"
        assert result["agency"] == "Department of Defense"
        assert result["level"] == "federal"
        assert result["source_id"] == "abc123"

    def test_normalize_agency(self, ingestor):
        result = ingestor._normalize_agency("Department of Defense")
        assert result["node_type"] == "Agency"
        assert result["name"] == "Department of Defense"
        assert result["level"] == "federal"

    def test_is_dfw_dallas(self, ingestor):
        assert ingestor._is_dfw(SAMPLE_AWARD) is True

    def test_is_dfw_non_dfw(self, ingestor):
        award = {**SAMPLE_AWARD, "Place of Performance County Name": "HARRIS"}
        assert ingestor._is_dfw(award) is False

    def test_is_dfw_missing(self, ingestor):
        assert ingestor._is_dfw({}) is False

    def test_dfw_counties_list(self):
        assert "DALLAS" in DFW_COUNTIES
        assert "TARRANT" in DFW_COUNTIES
        assert "COLLIN" in DFW_COUNTIES
