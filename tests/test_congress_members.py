"""Tests for Congress members ingestor."""
import json
import pytest
from unittest.mock import patch, MagicMock
from ingestors.congress_members import CongressMembersIngestor


# Sample API response for testing
MOCK_MEMBERS_RESPONSE = {
    "members": [
        {
            "bioguideId": "C001098",
            "name": "Cruz, Ted",
            "firstName": "Ted",
            "lastName": "Cruz",
            "partyName": "Republican",
            "state": "TX",
            "district": None,
            "terms": {"item": [{"chamber": "Senate", "startYear": 2019, "endYear": 2025}]},
            "url": "https://api.congress.gov/v3/member/C001098",
        },
        {
            "bioguideId": "A000376",
            "name": "Allred, Colin",
            "firstName": "Colin",
            "lastName": "Allred",
            "partyName": "Democratic",
            "state": "TX",
            "district": None,
            "terms": {"item": [{"chamber": "Senate", "startYear": 2025}]},
            "url": "https://api.congress.gov/v3/member/A000376",
        },
        {
            "bioguideId": "S000001",
            "name": "Smith, John",
            "firstName": "John",
            "lastName": "Smith",
            "partyName": "Republican",
            "state": "CA",
            "district": 5,
            "terms": {"item": [{"chamber": "House of Representatives", "startYear": 2023}]},
            "url": "https://api.congress.gov/v3/member/S000001",
        },
    ],
    "pagination": {},
}


class TestCongressMembersIngestor:
    def test_normalize_senator(self):
        ingestor = CongressMembersIngestor()
        raw = MOCK_MEMBERS_RESPONSE["members"][0]
        result = ingestor._normalize_member(raw)

        assert result["node_type"] == "Official"
        assert result["bioguide_id"] == "C001098"
        assert result["name"] == "Cruz, Ted"
        assert result["party"] == "Republican"
        assert result["state"] == "TX"
        assert result["chamber"] == "Senate"
        assert result["level"] == "federal"
        assert result["office"] == "US Senator"
        assert result["source"] == "congress.gov"

    def test_normalize_representative(self):
        ingestor = CongressMembersIngestor()
        raw = MOCK_MEMBERS_RESPONSE["members"][2]
        result = ingestor._normalize_member(raw)

        assert result["office"] == "US Representative"
        assert result["district"] == 5

    def test_filters_to_texas_only(self):
        ingestor = CongressMembersIngestor()
        # Mock fetch to return our test data
        ingestor.fetch = MagicMock(return_value=MOCK_MEMBERS_RESPONSE)
        members = ingestor._get_members(state="TX")

        assert len(members) == 2
        assert all(m["state"] == "TX" for m in members)
