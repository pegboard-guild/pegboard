"""Tests for FEC Contributions ingestor normalization."""
import pytest
from ingestors.fec_contributions import FECContributionsIngestor


@pytest.fixture
def ingestor():
    return FECContributionsIngestor()


SAMPLE_CONTRIBUTION = {
    "contributor_name": "SMITH, JOHN",
    "contributor_employer": "ACME CORP",
    "contributor_occupation": "ENGINEER",
    "contributor_city": "DALLAS",
    "contributor_state": "TX",
    "contributor_zip": "75201",
    "contribution_receipt_amount": 2800.0,
    "contribution_receipt_date": "2025-01-10",
    "receipt_type_full": "Individual Contribution",
    "receipt_type": "15",
    "memo_text": "",
    "sub_id": 12345678,
    "committee_id": "C00123456",
}

SAMPLE_CANDIDATE = {
    "candidate_id": "H8TX03044",
    "name": "DOE, JANE",
}


class TestFECNormalization:
    def test_normalize_contribution(self, ingestor):
        donor, contrib, edge = ingestor._normalize_contribution(
            SAMPLE_CONTRIBUTION, SAMPLE_CANDIDATE
        )

        # Donor node
        assert donor["node_type"] == "Donor"
        assert donor["name"] == "SMITH, JOHN"
        assert donor["employer"] == "ACME CORP"
        assert donor["state"] == "TX"

        # Contribution node
        assert contrib["node_type"] == "Contribution"
        assert contrib["amount"] == 2800.0
        assert contrib["date"] == "2025-01-10"

        # Edge
        assert edge["edge_type"] == "DONATED_TO"
        assert edge["to_id"] == "H8TX03044"
        assert edge["amount"] == 2800.0

    def test_donor_deduplication_key(self, ingestor):
        donor, _, _ = ingestor._normalize_contribution(
            SAMPLE_CONTRIBUTION, SAMPLE_CANDIDATE
        )
        assert donor["source_id"] == "smith,_john"

    def test_missing_fields(self, ingestor):
        minimal = {"contributor_name": "DOE, JANE", "sub_id": 1}
        donor, contrib, edge = ingestor._normalize_contribution(minimal, SAMPLE_CANDIDATE)
        assert donor["name"] == "DOE, JANE"
        assert contrib["amount"] == 0
        assert edge["edge_type"] == "DONATED_TO"
