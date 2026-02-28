"""Tests for Congress Bills ingestor normalization."""
import pytest
from ingestors.congress_bills import CongressBillsIngestor


@pytest.fixture
def ingestor():
    return CongressBillsIngestor()


SAMPLE_BILL = {
    "congress": 119,
    "type": "HR",
    "number": "1234",
    "title": "Test Act of 2025",
    "introducedDate": "2025-01-15",
    "url": "https://api.congress.gov/v3/bill/119/hr/1234",
    "latestAction": {"text": "Referred to committee", "actionDate": "2025-01-16"},
    "sponsors": [
        {"bioguideId": "C001098", "fullName": "Sen. Cruz, Ted", "state": "TX"}
    ],
}

SAMPLE_DETAIL = {
    "summaries": [{"text": "A bill to do something important."}],
    "policyArea": {"name": "Health"},
}

SAMPLE_VOTE = {
    "congress": 119,
    "chamber": "Senate",
    "number": 42,
    "date": "2025-02-01",
    "result": "Passed",
    "question": "On Passage",
    "description": "Test vote",
    "url": "https://api.congress.gov/v3/vote/119/senate/42",
    "bill": {"type": "HR", "number": "1234"},
}


class TestBillNormalization:
    def test_normalize_bill_basic(self, ingestor):
        result = ingestor._normalize_bill(SAMPLE_BILL)
        assert result["node_type"] == "Bill"
        assert result["bill_id"] == "HR1234"
        assert result["title"] == "Test Act of 2025"
        assert result["level"] == "federal"
        assert result["sponsor_state"] == "TX"
        assert result["introduced_date"] == "2025-01-15"

    def test_normalize_bill_with_detail(self, ingestor):
        result = ingestor._normalize_bill(SAMPLE_BILL, SAMPLE_DETAIL)
        assert result["summary"] == "A bill to do something important."
        assert result["policy_area"] == "Health"

    def test_normalize_vote(self, ingestor):
        result = ingestor._normalize_vote(SAMPLE_VOTE)
        assert result["node_type"] == "Vote"
        assert result["chamber"] == "Senate"
        assert result["result"] == "Passed"
        assert result["level"] == "federal"
        assert result["vote_id"] == "119-Senate-42"

    def test_is_tx_sponsor(self, ingestor):
        assert ingestor._is_tx_sponsor(SAMPLE_BILL) is True
        non_tx = {**SAMPLE_BILL, "sponsors": [{"state": "CA"}]}
        assert ingestor._is_tx_sponsor(non_tx) is False

    def test_is_tx_sponsor_no_sponsors(self, ingestor):
        assert ingestor._is_tx_sponsor({"sponsors": []}) is False
        assert ingestor._is_tx_sponsor({}) is False
