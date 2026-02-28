"""Pegboard data ingestors."""
from .congress_members import CongressMembersIngestor
from .congress_bills import CongressBillsIngestor
from .fec_contributions import FECContributionsIngestor
from .usaspending import USASpendingIngestor

ALL_INGESTORS = [
    CongressMembersIngestor,
    CongressBillsIngestor,
    FECContributionsIngestor,
    USASpendingIngestor,
]

__all__ = [
    "CongressMembersIngestor",
    "CongressBillsIngestor",
    "FECContributionsIngestor",
    "USASpendingIngestor",
    "ALL_INGESTORS",
]
