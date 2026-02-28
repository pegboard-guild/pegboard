"""Pydantic response models for Pegboard API."""
from pydantic import BaseModel, Field
from typing import Optional


class OfficialSummary(BaseModel):
    """Brief official info for lists."""
    bioguide_id: str
    name: str
    party: str = ""
    state: str = ""
    district: Optional[int] = None
    chamber: str = ""
    office: str = ""


class CommitteeResponse(BaseModel):
    """Committee info."""
    name: str
    chamber: str = ""


class BillSummary(BaseModel):
    """Brief bill info."""
    bill_id: str = ""
    title: str = ""
    status: str = ""
    congress: Optional[int] = None


class DonorResponse(BaseModel):
    """Donor info."""
    name: str = ""
    employer: str = ""
    occupation: str = ""
    total_amount: Optional[float] = None


class OfficialResponse(BaseModel):
    """Full official profile."""
    official: dict
    committees: list[dict] = []
    bills: list[dict] = []
    donors: list[dict] = []


class VoteRecord(BaseModel):
    """Single vote record."""
    position: str = ""
    vote: dict = {}
    bill: Optional[dict] = None


class BillResponse(BaseModel):
    """Full bill detail."""
    bill: dict
    sponsors: list[dict] = []
    cosponsors: list[dict] = []
    votes: list[dict] = []


class ContractResponse(BaseModel):
    """Contract info."""
    contract: dict
    awardee_org: Optional[str] = None
    agency_name: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Follow-the-money connection."""
    donor_name: str = ""
    donor_employer: str = ""
    donation_amount: Optional[float] = None
    organization: Optional[str] = None
    contracts: list[dict] = []


class GraphNode(BaseModel):
    """Node for graph visualization."""
    id: str
    label: str
    type: str
    properties: dict = {}


class GraphEdge(BaseModel):
    """Edge for graph visualization."""
    source: str
    target: str
    type: str
    properties: dict = {}


class GraphResponse(BaseModel):
    """Graph visualization response."""
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []


class SearchResult(BaseModel):
    """Single search result."""
    type: str
    id: str
    name: str
    detail: str = ""


class SearchResponse(BaseModel):
    """Search results."""
    query: str
    results: list[SearchResult] = []
    total: int = 0
