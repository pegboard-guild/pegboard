"""Search endpoint."""
from fastapi import APIRouter, Request, Query

from api.models import SearchResult, SearchResponse

router = APIRouter()


@router.get("", response_model=SearchResponse)
async def search(request: Request, q: str = Query(..., min_length=1)) -> SearchResponse:
    """Search across officials, bills, donors, and contracts."""
    driver = request.app.state.neo4j_driver
    results: list[SearchResult] = []

    with driver.session() as session:
        # Officials
        for r in session.run(
            "MATCH (o:Official) WHERE toLower(o.name) CONTAINS toLower($q) "
            "RETURN o.bioguide_id AS id, o.name AS name, o.office AS detail LIMIT 10",
            q=q,
        ):
            results.append(SearchResult(type="official", id=r["id"] or "", name=r["name"] or "", detail=r["detail"] or ""))

        # Bills
        for r in session.run(
            "MATCH (b:Bill) WHERE toLower(b.title) CONTAINS toLower($q) "
            "RETURN b.source_id AS id, b.title AS name, b.status AS detail LIMIT 10",
            q=q,
        ):
            results.append(SearchResult(type="bill", id=r["id"] or "", name=r["name"] or "", detail=r["detail"] or ""))

        # Donors
        for r in session.run(
            "MATCH (d:Donor) WHERE toLower(d.name) CONTAINS toLower($q) "
            "RETURN d.source_id AS id, d.name AS name, d.employer AS detail LIMIT 10",
            q=q,
        ):
            results.append(SearchResult(type="donor", id=r["id"] or "", name=r["name"] or "", detail=r["detail"] or ""))

        # Contracts
        for r in session.run(
            "MATCH (c:Contract) WHERE toLower(c.title) CONTAINS toLower($q) "
            "RETURN c.source_id AS id, c.title AS name, c.agency AS detail LIMIT 10",
            q=q,
        ):
            results.append(SearchResult(type="contract", id=r["id"] or "", name=r["name"] or "", detail=r["detail"] or ""))

    return SearchResponse(query=q, results=results, total=len(results))
