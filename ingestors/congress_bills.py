"""Ingestor for Congress.gov Bills & Votes API.

Pulls bills sponsored by TX members and roll call votes.
Source: https://api.congress.gov/v3/bill
"""
import time
from typing import Any

from .base import BaseIngestor, console
from config import (
    CONGRESS_API_BASE,
    CONGRESS_API_KEY,
    DEFAULT_CONGRESS,
    TX_DFW_DISTRICTS_HOUSE,
)


class CongressBillsIngestor(BaseIngestor):
    """Fetches bills sponsored by TX members and associated votes."""

    name = "congress_bills"
    source_url = "https://api.congress.gov/v3/bill"

    def _api_params(self, **extra) -> dict:
        """Standard API params."""
        params = {"api_key": CONGRESS_API_KEY, "format": "json", "limit": 250}
        params.update(extra)
        return params

    def _fetch_bills(self, congress: int = DEFAULT_CONGRESS) -> list[dict]:
        """Fetch bills from the current congress, filtering for TX sponsors."""
        all_bills: list[dict] = []
        offset = 0

        console.print(f"[blue]Fetching bills for congress {congress}...[/blue]")
        while True:
            params = self._api_params(offset=offset)
            url = f"{CONGRESS_API_BASE}/bill/{congress}"
            data = self.fetch(url, params)
            if not data:
                break

            bills = data.get("bills", [])
            if not bills:
                break

            all_bills.extend(bills)
            offset += 250
            time.sleep(0.5)

            # Stop after a reasonable amount (API can have thousands)
            if offset >= 1000:
                break

            if not data.get("pagination", {}).get("next"):
                break

        console.print(f"[green]Fetched {len(all_bills)} bills total[/green]")
        return all_bills

    def _fetch_bill_detail(self, congress: int, bill_type: str, bill_number: str) -> dict | None:
        """Fetch detailed info for a specific bill."""
        url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_number}"
        time.sleep(0.5)
        data = self.fetch(url, self._api_params())
        if data:
            return data.get("bill", {})
        return None

    def _fetch_cosponsors(self, congress: int, bill_type: str, bill_number: str) -> list[dict]:
        """Fetch cosponsors for a bill."""
        url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_number}/cosponsors"
        time.sleep(0.5)
        data = self.fetch(url, self._api_params())
        if data:
            return data.get("cosponsors", [])
        return []

    def _fetch_actions(self, congress: int, bill_type: str, bill_number: str) -> list[dict]:
        """Fetch actions for a bill."""
        url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_number}/actions"
        time.sleep(0.5)
        data = self.fetch(url, self._api_params())
        if data:
            return data.get("actions", [])
        return []

    def _fetch_votes(self, congress: int, chamber: str) -> list[dict]:
        """Fetch roll call votes for a chamber."""
        url = f"{CONGRESS_API_BASE}/vote/{congress}/{chamber}"
        time.sleep(0.5)
        data = self.fetch(url, self._api_params())
        if data:
            return data.get("votes", [])
        return []

    def _is_tx_sponsor(self, bill: dict) -> bool:
        """Check if a bill's sponsor is from Texas."""
        sponsors = bill.get("sponsors", [])
        if not sponsors:
            # Check latestAction or other fields for state info
            return False
        for s in sponsors:
            if s.get("state") == "TX":
                return True
        return False

    def _normalize_bill(self, bill: dict, detail: dict | None = None) -> dict:
        """Normalize a bill record for the graph."""
        sponsors = bill.get("sponsors", [])
        sponsor = sponsors[0] if sponsors else {}

        node: dict[str, Any] = {
            "node_type": "Bill",
            "bill_id": f"{bill.get('type', '')}{bill.get('number', '')}",
            "congress": bill.get("congress", DEFAULT_CONGRESS),
            "bill_type": bill.get("type", ""),
            "number": bill.get("number", ""),
            "title": bill.get("title", ""),
            "introduced_date": bill.get("introducedDate", ""),
            "status": bill.get("latestAction", {}).get("text", ""),
            "status_date": bill.get("latestAction", {}).get("actionDate", ""),
            "level": "federal",
            "url": bill.get("url", ""),
            "source": "congress.gov",
            "source_id": f"{bill.get('congress', '')}-{bill.get('type', '')}{bill.get('number', '')}",
            "sponsor_bioguide": sponsor.get("bioguideId", ""),
            "sponsor_name": sponsor.get("fullName", sponsor.get("name", "")),
            "sponsor_state": sponsor.get("state", ""),
        }

        if detail:
            node["summary"] = (detail.get("summaries", [{}])[0].get("text", "")
                               if detail.get("summaries") else "")
            node["policy_area"] = detail.get("policyArea", {}).get("name", "")

        return node

    def _normalize_vote(self, vote: dict) -> dict:
        """Normalize a vote record."""
        return {
            "node_type": "Vote",
            "vote_id": f"{vote.get('congress', '')}-{vote.get('chamber', '')}-{vote.get('number', '')}",
            "congress": vote.get("congress", DEFAULT_CONGRESS),
            "chamber": vote.get("chamber", ""),
            "number": vote.get("number", ""),
            "date": vote.get("date", ""),
            "result": vote.get("result", ""),
            "question": vote.get("question", ""),
            "description": vote.get("description", ""),
            "level": "federal",
            "url": vote.get("url", ""),
            "source": "congress.gov",
            "source_id": f"{vote.get('congress', '')}-{vote.get('chamber', '')}-{vote.get('number', '')}",
        }

    def run(self) -> dict:
        """Main ingestor: fetch TX-sponsored bills and votes."""
        console.print("[bold blue]═══ Congress Bills & Votes Ingestor ═══[/bold blue]")

        # --- Bills ---
        raw_bills = self._fetch_bills()
        self.save_raw("all_bills_raw", raw_bills)

        tx_bills = [b for b in raw_bills if self._is_tx_sponsor(b)]
        console.print(f"[green]Found {len(tx_bills)} TX-sponsored bills[/green]")

        normalized_bills: list[dict] = []
        edges_sponsored: list[dict] = []
        edges_cosponsored: list[dict] = []

        for i, bill in enumerate(tx_bills):
            bill_type = bill.get("type", "").lower()
            bill_number = bill.get("number", "")
            bill_id = f"{bill.get('type', '')}{bill_number}"
            console.print(f"  [{i+1}/{len(tx_bills)}] {bill_id}: {bill.get('title', '')[:60]}")

            # Fetch detail
            detail = self._fetch_bill_detail(
                bill.get("congress", DEFAULT_CONGRESS), bill_type, bill_number
            )
            if detail:
                self.save_raw(f"bill_{bill_id}", detail)

            normalized = self._normalize_bill(bill, detail)
            normalized_bills.append(normalized)
            self.stats["new"] += 1

            # Sponsor edge
            sponsors = bill.get("sponsors", [])
            for s in sponsors:
                edges_sponsored.append({
                    "edge_type": "SPONSORED",
                    "from_type": "Official",
                    "from_id": s.get("bioguideId", ""),
                    "to_type": "Bill",
                    "to_id": bill_id,
                })

            # Cosponsors
            cosponsors = self._fetch_cosponsors(
                bill.get("congress", DEFAULT_CONGRESS), bill_type, bill_number
            )
            for cs in cosponsors:
                edges_cosponsored.append({
                    "edge_type": "COSPONSORED",
                    "from_type": "Official",
                    "from_id": cs.get("bioguideId", ""),
                    "to_type": "Bill",
                    "to_id": bill_id,
                })

        self.save_normalized("tx_bills", normalized_bills)
        self.save_normalized("edges_sponsored", edges_sponsored)
        self.save_normalized("edges_cosponsored", edges_cosponsored)

        # --- Votes ---
        console.print("[blue]Fetching roll call votes...[/blue]")
        all_votes_raw: list[dict] = []
        normalized_votes: list[dict] = []
        edges_vote_regarding: list[dict] = []

        for chamber in ["house", "senate"]:
            votes = self._fetch_votes(DEFAULT_CONGRESS, chamber)
            all_votes_raw.extend(votes)
            for v in votes:
                nv = self._normalize_vote(v)
                normalized_votes.append(nv)

                # Link to bill if available
                bill_ref = v.get("bill", {})
                if bill_ref:
                    ref_id = f"{bill_ref.get('type', '')}{bill_ref.get('number', '')}"
                    edges_vote_regarding.append({
                        "edge_type": "VOTE_REGARDING",
                        "from_type": "Vote",
                        "from_id": nv["vote_id"],
                        "to_type": "Bill",
                        "to_id": ref_id,
                    })

        self.save_raw("votes_raw", all_votes_raw)
        self.save_normalized("votes", normalized_votes)
        self.save_normalized("edges_vote_regarding", edges_vote_regarding)

        console.print(
            f"[green]Saved {len(normalized_bills)} bills, "
            f"{len(normalized_votes)} votes, "
            f"{len(edges_sponsored)} sponsor edges, "
            f"{len(edges_cosponsored)} cosponsor edges[/green]"
        )

        self.log_run()
        return {
            "bills": normalized_bills,
            "votes": normalized_votes,
            "edges_sponsored": edges_sponsored,
            "edges_cosponsored": edges_cosponsored,
            "edges_vote_regarding": edges_vote_regarding,
        }


if __name__ == "__main__":
    ingestor = CongressBillsIngestor()
    result = ingestor.run()

    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  Bills: {len(result['bills'])}")
    console.print(f"  Votes: {len(result['votes'])}")
    console.print(f"  Sponsor edges: {len(result['edges_sponsored'])}")
    console.print(f"  Cosponsor edges: {len(result['edges_cosponsored'])}")
