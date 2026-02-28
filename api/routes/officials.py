"""Official endpoints."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from graph import queries as q

router = APIRouter()


def _driver(request: Request):
    return request.app.state.neo4j_driver


@router.get("")
async def list_officials(
    request: Request,
    state: Optional[str] = Query(None),
    party: Optional[str] = Query(None),
    chamber: Optional[str] = Query(None),
) -> list[dict]:
    """List all officials with optional filters."""
    driver = _driver(request)
    filters = []
    params: dict = {}
    if state:
        filters.append("o.state = $state")
        params["state"] = state
    if party:
        filters.append("o.party = $party")
        params["party"] = party
    if chamber:
        filters.append("o.chamber = $chamber")
        params["chamber"] = chamber
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    cypher = f"MATCH (o:Official) {where} RETURN o {{.*}} AS official ORDER BY o.name LIMIT 200"
    with driver.session() as session:
        result = session.run(cypher, **params)
        return [r.data() for r in result]


@router.get("/{bioguide_id}")
async def get_official(request: Request, bioguide_id: str) -> dict:
    """Get full official profile."""
    data = q.get_official(_driver(request), bioguide_id)
    if not data:
        raise HTTPException(404, "Official not found")
    return data


@router.get("/{bioguide_id}/votes")
async def get_votes(request: Request, bioguide_id: str) -> list[dict]:
    """Get official's voting record."""
    return q.get_official_voting_record(_driver(request), bioguide_id)


@router.get("/{bioguide_id}/donors")
async def get_donors(
    request: Request, bioguide_id: str, limit: int = Query(20, ge=1, le=100)
) -> list[dict]:
    """Get top donors for an official."""
    return q.get_top_donors(_driver(request), bioguide_id, limit)


@router.get("/{bioguide_id}/connections")
async def get_connections(request: Request, bioguide_id: str) -> list[dict]:
    """Follow-the-money connections for an official."""
    return q.get_connections(_driver(request), bioguide_id)
