"""Common graph queries for Pegboard."""
from typing import Any, Optional
from neo4j import Driver


def _run(driver: Driver, cypher: str, **params: Any) -> list[dict]:
    """Execute a read query and return list of record dicts."""
    with driver.session() as session:
        result = session.run(cypher, **params)
        return [record.data() for record in result]


def get_official(driver: Driver, bioguide_id: str) -> Optional[dict]:
    """Get full official profile with committees, sponsored bills, and top donors.

    Args:
        driver: Neo4j driver instance.
        bioguide_id: Official's bioguide identifier.

    Returns:
        Dict with official properties, committees, bills, and donors, or None.
    """
    rows = _run(
        driver,
        """
        MATCH (o:Official {bioguide_id: $id})
        OPTIONAL MATCH (o)-[:MEMBER_OF]->(c:Committee)
        OPTIONAL MATCH (o)-[:SPONSORED]->(b:Bill)
        OPTIONAL MATCH (d:Donor)-[r:DONATED_TO]->(o)
        RETURN o {.*} AS official,
               collect(DISTINCT c {.*}) AS committees,
               collect(DISTINCT b {.bill_id, .title, .status, .congress}) AS bills,
               collect(DISTINCT {name: d.name, employer: d.employer, total: r.total_amount}) AS donors
        """,
        id=bioguide_id,
    )
    return rows[0] if rows else None


def get_official_voting_record(driver: Driver, bioguide_id: str) -> list[dict]:
    """Get all votes cast by an official with bill info.

    Args:
        driver: Neo4j driver instance.
        bioguide_id: Official's bioguide identifier.

    Returns:
        List of vote records with position, date, result, and bill info.
    """
    return _run(
        driver,
        """
        MATCH (o:Official {bioguide_id: $id})-[:CAST_VOTE]->(vp:VotePosition)-[:VOTE_ON]->(v:Vote)
        OPTIONAL MATCH (v)-[:VOTE_REGARDING]->(b:Bill)
        RETURN vp.position AS position,
               v {.vote_id, .date, .result, .question, .chamber} AS vote,
               b {.bill_id, .title, .congress} AS bill
        ORDER BY v.date DESC
        """,
        id=bioguide_id,
    )


def get_bill(driver: Driver, bill_number: str, congress: int) -> Optional[dict]:
    """Get bill details with sponsors, cosponsors, and vote results.

    Args:
        driver: Neo4j driver instance.
        bill_number: Bill number (e.g., 'HR1234').
        congress: Congress number (e.g., 119).

    Returns:
        Dict with bill properties, sponsors, cosponsors, and votes.
    """
    rows = _run(
        driver,
        """
        MATCH (b:Bill {number: $number, congress: $congress})
        OPTIONAL MATCH (sponsor:Official)-[:SPONSORED]->(b)
        OPTIONAL MATCH (cosponsor:Official)-[:COSPONSORED]->(b)
        OPTIONAL MATCH (v:Vote)-[:VOTE_REGARDING]->(b)
        RETURN b {.*} AS bill,
               collect(DISTINCT sponsor {.bioguide_id, .name, .party}) AS sponsors,
               collect(DISTINCT cosponsor {.bioguide_id, .name, .party}) AS cosponsors,
               collect(DISTINCT v {.vote_id, .date, .result, .chamber}) AS votes
        """,
        number=bill_number,
        congress=congress,
    )
    return rows[0] if rows else None


def get_top_donors(driver: Driver, bioguide_id: str, limit: int = 20) -> list[dict]:
    """Get top campaign contributors for an official.

    Args:
        driver: Neo4j driver instance.
        bioguide_id: Official's bioguide identifier.
        limit: Maximum number of donors to return.

    Returns:
        List of donor dicts with name, employer, and total amount.
    """
    return _run(
        driver,
        """
        MATCH (d:Donor)-[r:DONATED_TO]->(o:Official {bioguide_id: $id})
        RETURN d.name AS name, d.employer AS employer, d.occupation AS occupation,
               r.total_amount AS total_amount
        ORDER BY r.total_amount DESC
        LIMIT $limit
        """,
        id=bioguide_id,
        limit=limit,
    )


def get_contracts_by_district(driver: Driver, state: str, district: Optional[int] = None, limit: int = 50) -> list[dict]:
    """Get federal contracts in a congressional district.

    Args:
        driver: Neo4j driver instance.
        state: Two-letter state code.
        district: Congressional district number (optional).
        limit: Maximum results.

    Returns:
        List of contract dicts.
    """
    if district is not None:
        return _run(
            driver,
            """
            MATCH (c:Contract)
            WHERE c.state = $state AND c.district = $district
            OPTIONAL MATCH (c)-[:AWARDED_TO]->(org:Organization)
            OPTIONAL MATCH (c)-[:FUNDED_BY]->(a:Agency)
            RETURN c {.*} AS contract, org.name AS awardee_org, a.name AS agency_name
            ORDER BY c.amount DESC
            LIMIT $limit
            """,
            state=state,
            district=district,
            limit=limit,
        )
    return _run(
        driver,
        """
        MATCH (c:Contract)
        WHERE c.county IS NOT NULL
        OPTIONAL MATCH (c)-[:AWARDED_TO]->(org:Organization)
        OPTIONAL MATCH (c)-[:FUNDED_BY]->(a:Agency)
        RETURN c {.*} AS contract, org.name AS awardee_org, a.name AS agency_name
        ORDER BY c.amount DESC
        LIMIT $limit
        """,
        limit=limit,
    )


def search_officials(driver: Driver, query: str) -> list[dict]:
    """Fuzzy search officials by name.

    Args:
        driver: Neo4j driver instance.
        query: Search string.

    Returns:
        List of matching official dicts.
    """
    return _run(
        driver,
        """
        MATCH (o:Official)
        WHERE o.name CONTAINS $query OR toLower(o.name) CONTAINS toLower($query)
        RETURN o {.*} AS official
        ORDER BY o.name
        LIMIT 25
        """,
        query=query,
    )


def get_connections(driver: Driver, bioguide_id: str) -> list[dict]:
    """Follow-the-money: donors → official → donors' employers → contracts.

    Args:
        driver: Neo4j driver instance.
        bioguide_id: Official's bioguide identifier.

    Returns:
        List of connection chains showing money flow.
    """
    return _run(
        driver,
        """
        MATCH (d:Donor)-[donated:DONATED_TO]->(o:Official {bioguide_id: $id})
        OPTIONAL MATCH (d)-[:EMPLOYED_BY]->(org:Organization)
        OPTIONAL MATCH (c:Contract)-[:AWARDED_TO]->(org)
        RETURN d.name AS donor_name,
               d.employer AS donor_employer,
               donated.total_amount AS donation_amount,
               org.name AS organization,
               collect(DISTINCT c {.title, .amount, .agency, .source_id}) AS contracts
        ORDER BY donated.total_amount DESC
        """,
        id=bioguide_id,
    )


def get_voting_alignment(driver: Driver, bioguide_id_1: str, bioguide_id_2: str) -> dict:
    """Calculate voting alignment percentage between two officials.

    Args:
        driver: Neo4j driver instance.
        bioguide_id_1: First official's bioguide ID.
        bioguide_id_2: Second official's bioguide ID.

    Returns:
        Dict with total_votes, agreed, alignment_pct.
    """
    rows = _run(
        driver,
        """
        MATCH (o1:Official {bioguide_id: $id1})-[:CAST_VOTE]->(vp1:VotePosition)-[:VOTE_ON]->(v:Vote)
        MATCH (o2:Official {bioguide_id: $id2})-[:CAST_VOTE]->(vp2:VotePosition)-[:VOTE_ON]->(v)
        WITH count(v) AS total,
             sum(CASE WHEN vp1.position = vp2.position THEN 1 ELSE 0 END) AS agreed
        RETURN total AS total_votes, agreed,
               CASE WHEN total > 0 THEN round(100.0 * agreed / total, 1) ELSE 0 END AS alignment_pct
        """,
        id1=bioguide_id_1,
        id2=bioguide_id_2,
    )
    return rows[0] if rows else {"total_votes": 0, "agreed": 0, "alignment_pct": 0}
