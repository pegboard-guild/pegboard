"""Load normalized JSON data into Neo4j graph database."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neo4j import Driver, GraphDatabase
from rich.console import Console

from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
from graph.schema import create_schema, drop_schema

console = Console()

BATCH_SIZE = 500


def _hash(data: Any) -> str:
    """Create a stable hash of data for provenance."""
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16]


def _load_json(path: Path) -> list[dict]:
    """Load a JSON file, returning empty list on failure."""
    try:
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    except Exception as e:
        console.print(f"[yellow]Skipping {path}: {e}[/yellow]")
        return []


def _batch(items: list, size: int = BATCH_SIZE):
    """Yield successive batches."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


class GraphLoader:
    """Loads normalized Pegboard data into Neo4j."""

    def __init__(self, driver: Driver):
        self.driver = driver
        self.stats: dict[str, int] = {}

    def _run_batch(self, cypher: str, items: list[dict], label: str) -> int:
        """Run a batched UNWIND query. Returns count of items processed."""
        total = 0
        for batch in _batch(items):
            with self.driver.session() as session:
                session.run(cypher, items=batch)
            total += len(batch)
        self.stats[label] = self.stats.get(label, 0) + total
        return total

    # ── Node loaders ──

    def load_officials(self, officials: list[dict]) -> int:
        """Load Official nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for o in officials:
            o["_source"] = o.get("source", "unknown")
            o["_ingested_at"] = now
            o["_raw_hash"] = _hash(o)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (o:Official {bioguide_id: item.bioguide_id})
            SET o.name = item.name,
                o.first_name = item.first_name,
                o.last_name = item.last_name,
                o.party = item.party,
                o.state = item.state,
                o.district = item.district,
                o.chamber = item.chamber,
                o.level = item.level,
                o.office = item.office,
                o.term_start = item.term_start,
                o.term_end = item.term_end,
                o.url = item.url,
                o._source = item._source,
                o._ingested_at = item._ingested_at,
                o._raw_hash = item._raw_hash
            """,
            officials,
            "officials",
        )

    def load_committees(self, officials: list[dict]) -> int:
        """Load Committee nodes and MEMBER_OF edges from official data."""
        now = datetime.now(timezone.utc).isoformat()
        rows: list[dict] = []
        for o in officials:
            for c in o.get("committees", []):
                rows.append({
                    "bioguide_id": o["bioguide_id"],
                    "committee_name": c.get("name", ""),
                    "chamber": c.get("chamber", ""),
                    "_source": o.get("source", "unknown"),
                    "_ingested_at": now,
                })
        if not rows:
            return 0
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (c:Committee {name: item.committee_name})
            SET c.chamber = item.chamber, c._source = item._source, c._ingested_at = item._ingested_at
            WITH c, item
            MATCH (o:Official {bioguide_id: item.bioguide_id})
            MERGE (o)-[:MEMBER_OF]->(c)
            """,
            rows,
            "committees",
        )

    def load_bills(self, bills: list[dict]) -> int:
        """Load Bill nodes and SPONSORED edges."""
        now = datetime.now(timezone.utc).isoformat()
        for b in bills:
            b["_source"] = b.get("source", "unknown")
            b["_ingested_at"] = now
            b["_raw_hash"] = _hash(b)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (b:Bill {source_id: item.source_id})
            SET b.bill_id = item.bill_id,
                b.congress = item.congress,
                b.bill_type = item.bill_type,
                b.number = item.number,
                b.title = item.title,
                b.introduced_date = item.introduced_date,
                b.status = item.status,
                b.status_date = item.status_date,
                b.level = item.level,
                b.summary = item.summary,
                b.policy_area = item.policy_area,
                b.url = item.url,
                b._source = item._source,
                b._ingested_at = item._ingested_at,
                b._raw_hash = item._raw_hash
            WITH b, item
            WHERE item.sponsor_bioguide IS NOT NULL AND item.sponsor_bioguide <> ''
            MATCH (o:Official {bioguide_id: item.sponsor_bioguide})
            MERGE (o)-[:SPONSORED]->(b)
            """,
            bills,
            "bills",
        )

    def load_votes(self, votes: list[dict]) -> int:
        """Load Vote nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for v in votes:
            v["_source"] = v.get("source", "unknown")
            v["_ingested_at"] = now
            v["_raw_hash"] = _hash(v)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (v:Vote {vote_id: item.vote_id})
            SET v.congress = item.congress,
                v.chamber = item.chamber,
                v.number = item.number,
                v.date = item.date,
                v.result = item.result,
                v.question = item.question,
                v.description = item.description,
                v.level = item.level,
                v.url = item.url,
                v._source = item._source,
                v._ingested_at = item._ingested_at,
                v._raw_hash = item._raw_hash
            """,
            votes,
            "votes",
        )

    def load_vote_positions(self, positions: list[dict]) -> int:
        """Load VotePosition nodes with CAST_VOTE and VOTE_ON edges."""
        now = datetime.now(timezone.utc).isoformat()
        for p in positions:
            p["_ingested_at"] = now
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (vp:VotePosition {position_id: item.position_id})
            SET vp.position = item.position,
                vp._ingested_at = item._ingested_at
            WITH vp, item
            MATCH (o:Official {bioguide_id: item.bioguide_id})
            MERGE (o)-[:CAST_VOTE]->(vp)
            WITH vp, item
            MATCH (v:Vote {vote_id: item.vote_id})
            MERGE (vp)-[:VOTE_ON]->(v)
            """,
            positions,
            "vote_positions",
        )

    def load_vote_bill_links(self, votes: list[dict]) -> int:
        """Create VOTE_REGARDING edges between Votes and Bills."""
        links = [v for v in votes if v.get("bill_source_id")]
        if not links:
            return 0
        return self._run_batch(
            """
            UNWIND $items AS item
            MATCH (v:Vote {vote_id: item.vote_id})
            MATCH (b:Bill {source_id: item.bill_source_id})
            MERGE (v)-[:VOTE_REGARDING]->(b)
            """,
            links,
            "vote_bill_links",
        )

    def load_donors(self, donors: list[dict]) -> int:
        """Load Donor nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for d in donors:
            d["_source"] = d.get("source", "unknown")
            d["_ingested_at"] = now
            d["_raw_hash"] = _hash(d)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (d:Donor {source_id: item.source_id})
            SET d.name = item.name,
                d.employer = item.employer,
                d.occupation = item.occupation,
                d.city = item.city,
                d.state = item.state,
                d._source = item._source,
                d._ingested_at = item._ingested_at,
                d._raw_hash = item._raw_hash
            """,
            donors,
            "donors",
        )

    def load_contributions(self, contributions: list[dict]) -> int:
        """Load Contribution nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for c in contributions:
            c["_source"] = c.get("source", "unknown")
            c["_ingested_at"] = now
            c["_raw_hash"] = _hash(c)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (c:Contribution {source_id: item.source_id})
            SET c.amount = item.amount,
                c.date = item.date,
                c.type = item.type,
                c.memo = item.memo,
                c._source = item._source,
                c._ingested_at = item._ingested_at,
                c._raw_hash = item._raw_hash
            """,
            contributions,
            "contributions",
        )

    def load_donation_edges(self, edges: list[dict]) -> int:
        """Load DONATED_TO edges from donor edge data."""
        return self._run_batch(
            """
            UNWIND $items AS item
            MATCH (d:Donor {source_id: item.donor_source_id})
            MATCH (o:Official {bioguide_id: item.official_bioguide_id})
            MERGE (d)-[r:DONATED_TO]->(o)
            SET r.total_amount = item.total_amount
            """,
            edges,
            "donation_edges",
        )

    def load_employer_edges(self, donors: list[dict]) -> int:
        """Create Organization nodes and EMPLOYED_BY edges from donor employer data."""
        rows = [
            {"donor_source_id": d["source_id"], "employer": d["employer"]}
            for d in donors
            if d.get("employer") and d["employer"].strip()
        ]
        if not rows:
            return 0
        now = datetime.now(timezone.utc).isoformat()
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (org:Organization {name: item.employer})
            SET org._ingested_at = $now
            WITH org, item
            MATCH (d:Donor {source_id: item.donor_source_id})
            MERGE (d)-[:EMPLOYED_BY]->(org)
            """.replace("$now", f"'{now}'"),
            rows,
            "employer_edges",
        )

    def load_contracts(self, contracts: list[dict]) -> int:
        """Load Contract nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for c in contracts:
            c["_source"] = c.get("source", "unknown")
            c["_ingested_at"] = now
            c["_raw_hash"] = _hash(c)
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (c:Contract {source_id: item.source_id})
            SET c.award_id = item.award_id,
                c.title = item.title,
                c.amount = item.amount,
                c.awardee = item.awardee,
                c.agency = item.agency,
                c.sub_agency = item.sub_agency,
                c.start_date = item.start_date,
                c.end_date = item.end_date,
                c.county = item.county,
                c.level = item.level,
                c._source = item._source,
                c._ingested_at = item._ingested_at,
                c._raw_hash = item._raw_hash
            """,
            contracts,
            "contracts",
        )

    def load_agencies(self, agencies: list[dict]) -> int:
        """Load Agency nodes."""
        now = datetime.now(timezone.utc).isoformat()
        for a in agencies:
            a["_source"] = a.get("source", "unknown")
            a["_ingested_at"] = now
        return self._run_batch(
            """
            UNWIND $items AS item
            MERGE (a:Agency {source_id: item.source_id})
            SET a.name = item.name,
                a.level = item.level,
                a._source = item._source,
                a._ingested_at = item._ingested_at
            """,
            agencies,
            "agencies",
        )

    def load_contract_edges(self, contracts: list[dict]) -> int:
        """Create AWARDED_TO and FUNDED_BY edges for contracts."""
        # AWARDED_TO: Contract → Organization (awardee)
        awardee_rows = [
            {"contract_source_id": c["source_id"], "awardee": c["awardee"]}
            for c in contracts
            if c.get("awardee") and c["awardee"].strip()
        ]
        count = 0
        if awardee_rows:
            count += self._run_batch(
                """
                UNWIND $items AS item
                MERGE (org:Organization {name: item.awardee})
                WITH org, item
                MATCH (c:Contract {source_id: item.contract_source_id})
                MERGE (c)-[:AWARDED_TO]->(org)
                """,
                awardee_rows,
                "awarded_to_edges",
            )
        # FUNDED_BY: Contract → Agency
        funded_rows = [
            {"contract_source_id": c["source_id"], "agency_source_id": c.get("agency", "").replace(" ", "_").lower()}
            for c in contracts
            if c.get("agency")
        ]
        if funded_rows:
            count += self._run_batch(
                """
                UNWIND $items AS item
                MATCH (c:Contract {source_id: item.contract_source_id})
                MATCH (a:Agency {source_id: item.agency_source_id})
                MERGE (c)-[:FUNDED_BY]->(a)
                """,
                funded_rows,
                "funded_by_edges",
            )
        return count

    # ── Main load orchestration ──

    def load_all(self, data_dir: Path) -> dict[str, int]:
        """Load all normalized data from data_dir into Neo4j.

        Args:
            data_dir: Root data directory containing ingestor subdirectories.

        Returns:
            Dict of label → count loaded.
        """
        console.print(f"[bold blue]Loading data from {data_dir}[/bold blue]")

        # Congress members
        members_file = data_dir / "congress_members" / "normalized" / "tx_members.json"
        officials = _load_json(members_file)
        if officials:
            console.print(f"  Officials: {self.load_officials(officials)}")
            console.print(f"  Committees: {self.load_committees(officials)}")

        # Congress bills
        bills_dir = data_dir / "congress_bills" / "normalized"
        if bills_dir.exists():
            for f in sorted(bills_dir.glob("bills*.json")):
                bills = _load_json(f)
                if bills:
                    console.print(f"  Bills ({f.name}): {self.load_bills(bills)}")

            for f in sorted(bills_dir.glob("votes*.json")):
                votes = _load_json(f)
                if votes:
                    console.print(f"  Votes ({f.name}): {self.load_votes(votes)}")
                    self.load_vote_bill_links(votes)

            for f in sorted(bills_dir.glob("vote_positions*.json")):
                positions = _load_json(f)
                if positions:
                    console.print(f"  VotePositions ({f.name}): {self.load_vote_positions(positions)}")

        # FEC contributions
        fec_dir = data_dir / "fec_contributions" / "normalized"
        donors = _load_json(fec_dir / "donors.json")
        if donors:
            console.print(f"  Donors: {self.load_donors(donors)}")
            console.print(f"  Employer edges: {self.load_employer_edges(donors)}")

        contributions = _load_json(fec_dir / "contributions.json")
        if contributions:
            console.print(f"  Contributions: {self.load_contributions(contributions)}")

        edges = _load_json(fec_dir / "edges_donated_to.json")
        if edges:
            console.print(f"  Donation edges: {self.load_donation_edges(edges)}")

        # USAspending
        usa_dir = data_dir / "usaspending" / "normalized"
        if usa_dir.exists():
            agencies = _load_json(usa_dir / "agencies.json")
            if agencies:
                console.print(f"  Agencies: {self.load_agencies(agencies)}")

            for f in sorted(usa_dir.glob("contracts*.json")):
                contracts = _load_json(f)
                if contracts:
                    console.print(f"  Contracts ({f.name}): {self.load_contracts(contracts)}")
                    self.load_contract_edges(contracts)

        console.print(f"\n[bold green]Load complete:[/bold green] {self.stats}")
        return self.stats


def main() -> None:
    """CLI entry point for graph loader."""
    parser = argparse.ArgumentParser(description="Load Pegboard data into Neo4j")
    parser.add_argument("--data-dir", type=str, default="data", help="Root data directory")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate schema before loading")
    parser.add_argument("--uri", type=str, default=NEO4J_URI)
    parser.add_argument("--user", type=str, default=NEO4J_USER)
    parser.add_argument("--password", type=str, default=NEO4J_PASSWORD)
    args = parser.parse_args()

    driver = GraphDatabase.driver(args.uri, auth=(args.user, args.password))
    try:
        driver.verify_connectivity()
        console.print("[green]Connected to Neo4j[/green]")

        if args.reset:
            console.print("[yellow]Resetting schema...[/yellow]")
            drop_schema(driver)
            create_schema(driver)
        else:
            create_schema(driver)

        loader = GraphLoader(driver)
        loader.load_all(Path(args.data_dir))
    finally:
        driver.close()


if __name__ == "__main__":
    main()
