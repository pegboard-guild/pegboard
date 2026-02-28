"""Bill endpoints."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from graph import queries as q

router = APIRouter()


def _driver(request: Request):
    return request.app.state.neo4j_driver


@router.get("")
async def list_bills(
    request: Request,
    congress: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sponsor: Optional[str] = Query(None, description="Sponsor bioguide_id"),
) -> list[dict]:
    """List bills with optional filters."""
    driver = _driver(request)
    filters = []
    params: dict = {}
    if congress:
        filters.append("b.congress = $congress")
        params["congress"] = congress
    if status:
        filters.append("b.status CONTAINS $status")
        params["status"] = status
    if sponsor:
        filters.append("EXISTS { MATCH (o:Official {bioguide_id: $sponsor})-[:SPONSORED]->(b) }")
        params["sponsor"] = sponsor
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    cypher = f"MATCH (b:Bill) {where} RETURN b {{.*}} AS bill ORDER BY b.introduced_date DESC LIMIT 200"
    with driver.session() as session:
        result = session.run(cypher, **params)
        return [r.data() for r in result]


@router.get("/{congress}/{number}")
async def get_bill(request: Request, congress: int, number: str) -> dict:
    """Get bill detail with sponsors and votes."""
    data = q.get_bill(_driver(request), number, congress)
    if not data:
        raise HTTPException(404, "Bill not found")
    return data
