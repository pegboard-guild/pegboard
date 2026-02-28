"""Neo4j schema definitions: constraints and indexes for Pegboard."""
from neo4j import Driver


CONSTRAINTS = [
    # Officials
    "CREATE CONSTRAINT official_bioguide IF NOT EXISTS FOR (o:Official) REQUIRE o.bioguide_id IS UNIQUE",
    # Bills
    "CREATE CONSTRAINT bill_source_id IF NOT EXISTS FOR (b:Bill) REQUIRE b.source_id IS UNIQUE",
    # Votes
    "CREATE CONSTRAINT vote_id IF NOT EXISTS FOR (v:Vote) REQUIRE v.vote_id IS UNIQUE",
    # VotePositions
    "CREATE CONSTRAINT voteposition_id IF NOT EXISTS FOR (vp:VotePosition) REQUIRE vp.position_id IS UNIQUE",
    # Committees
    "CREATE CONSTRAINT committee_name IF NOT EXISTS FOR (c:Committee) REQUIRE c.name IS UNIQUE",
    # Contracts
    "CREATE CONSTRAINT contract_source_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.source_id IS UNIQUE",
    # Donors
    "CREATE CONSTRAINT donor_source_id IF NOT EXISTS FOR (d:Donor) REQUIRE d.source_id IS UNIQUE",
    # Contributions
    "CREATE CONSTRAINT contribution_source_id IF NOT EXISTS FOR (c:Contribution) REQUIRE c.source_id IS UNIQUE",
    # Agencies
    "CREATE CONSTRAINT agency_source_id IF NOT EXISTS FOR (a:Agency) REQUIRE a.source_id IS UNIQUE",
    # Organizations
    "CREATE CONSTRAINT org_name IF NOT EXISTS FOR (o:Organization) REQUIRE o.name IS UNIQUE",
    # Lobbyists
    "CREATE CONSTRAINT lobbyist_source_id IF NOT EXISTS FOR (l:Lobbyist) REQUIRE l.source_id IS UNIQUE",
    # Budgets
    "CREATE CONSTRAINT budget_source_id IF NOT EXISTS FOR (b:Budget) REQUIRE b.source_id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX official_name IF NOT EXISTS FOR (o:Official) ON (o.name)",
    "CREATE INDEX official_state IF NOT EXISTS FOR (o:Official) ON (o.state)",
    "CREATE INDEX official_party IF NOT EXISTS FOR (o:Official) ON (o.party)",
    "CREATE INDEX official_chamber IF NOT EXISTS FOR (o:Official) ON (o.chamber)",
    "CREATE INDEX bill_congress IF NOT EXISTS FOR (b:Bill) ON (b.congress)",
    "CREATE INDEX bill_number IF NOT EXISTS FOR (b:Bill) ON (b.number)",
    "CREATE INDEX bill_status IF NOT EXISTS FOR (b:Bill) ON (b.status)",
    "CREATE INDEX vote_date IF NOT EXISTS FOR (v:Vote) ON (v.date)",
    "CREATE INDEX contract_agency IF NOT EXISTS FOR (c:Contract) ON (c.agency)",
    "CREATE INDEX contract_amount IF NOT EXISTS FOR (c:Contract) ON (c.amount)",
    "CREATE INDEX donor_name IF NOT EXISTS FOR (d:Donor) ON (d.name)",
    "CREATE INDEX donor_employer IF NOT EXISTS FOR (d:Donor) ON (d.employer)",
    "CREATE TEXT INDEX official_name_text IF NOT EXISTS FOR (o:Official) ON (o.name)",
    "CREATE TEXT INDEX donor_name_text IF NOT EXISTS FOR (d:Donor) ON (d.name)",
    "CREATE TEXT INDEX bill_title_text IF NOT EXISTS FOR (b:Bill) ON (b.title)",
    "CREATE TEXT INDEX contract_title_text IF NOT EXISTS FOR (c:Contract) ON (c.title)",
]

DROP_ALL = "MATCH (n) DETACH DELETE n"


def create_schema(driver: Driver) -> None:
    """Create all constraints and indexes in Neo4j."""
    with driver.session() as session:
        for stmt in CONSTRAINTS:
            session.run(stmt)
        for stmt in INDEXES:
            session.run(stmt)


def drop_schema(driver: Driver) -> None:
    """Drop all constraints, indexes, and data."""
    with driver.session() as session:
        # Drop constraints
        result = session.run("SHOW CONSTRAINTS YIELD name RETURN name")
        for record in result:
            session.run(f"DROP CONSTRAINT {record['name']} IF EXISTS")
        # Drop indexes
        result = session.run("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name")
        for record in result:
            session.run(f"DROP INDEX {record['name']} IF EXISTS")
        # Delete all data
        session.run(DROP_ALL)
