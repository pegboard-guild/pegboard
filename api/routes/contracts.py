"""Contract endpoints."""
from typing import Optional

from fastapi import APIRouter, Request, Query

router = APIRouter()


def _driver(request: Request):
    return request.app.state.neo4j_driver


@router.get("")
async def list_contracts(
    request: Request,
    state: Optional[str] = Query(None),
    district: Optional[int] = Query(None),
    agency: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
) -> list[dict]:
    """List contracts with optional filters."""
    driver = _driver(request)
    filters = []
    params: dict = {}
    if state:
        filters.append("c.state = $state")
        params["state"] = state
    if district is not None:
        filters.append("c.district = $district")
        params["district"] = district
    if agency:
        filters.append("c.agency CONTAINS $agency")
        params["agency"] = agency
    if min_amount is not None:
        filters.append("c.amount >= $min_amount")
        params["min_amount"] = min_amount
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    cypher = f"""
        MATCH (c:Contract) {where}
        OPTIONAL MATCH (c)-[:AWARDED_TO]->(org:Organization)
        OPTIONAL MATCH (c)-[:FUNDED_BY]->(a:Agency)
        RETURN c {{.*}} AS contract, org.name AS awardee_org, a.name AS agency_name
        ORDER BY c.amount DESC LIMIT 200
    """
    with driver.session() as session:
        result = session.run(cypher, **params)
        return [r.data() for r in result]


@router.get("/by-donor/{donor_name}")
async def contracts_by_donor(request: Request, donor_name: str) -> list[dict]:
    """Get contracts awarded to a donor's employer."""
    driver = _driver(request)
    cypher = """
        MATCH (d:Donor)-[:EMPLOYED_BY]->(org:Organization)<-[:AWARDED_TO]-(c:Contract)
        WHERE d.name CONTAINS $name
        RETURN d.name AS donor, org.name AS organization,
               c {.title, .amount, .agency, .source_id} AS contract
        ORDER BY c.amount DESC
        LIMIT 100
    """
    with driver.session() as session:
        result = session.run(cypher, name=donor_name)
        return [r.data() for r in result]
