"""Ingestor for FEC Campaign Finance data.

Pulls itemized contributions (>$200) for TX congressional candidates.
Source: https://api.open.fec.gov/v1
Docs: https://api.open.fec.gov/developers/
"""
import time
from typing import Any

from .base import BaseIngestor, console
from config import FEC_API_BASE, FEC_API_KEY


class FECContributionsIngestor(BaseIngestor):
    """Fetches FEC campaign contribution data for TX delegation."""

    name = "fec_contributions"
    source_url = "https://api.open.fec.gov/v1"

    def _api_params(self, **extra) -> dict:
        """Standard API params with key."""
        params = {"api_key": FEC_API_KEY, "per_page": 100}
        params.update(extra)
        return params

    def _fetch_candidates(self) -> list[dict]:
        """Fetch TX House and Senate candidates."""
        candidates: list[dict] = []

        for office in ["H", "S"]:
            console.print(f"[blue]Fetching TX {office} candidates...[/blue]")
            page = 1
            while True:
                params = self._api_params(
                    state="TX", office=office, is_active_candidate="true",
                    sort="name", page=page,
                )
                data = self.fetch(f"{FEC_API_BASE}/candidates/search/", params)
                if not data:
                    break

                results = data.get("results", [])
                candidates.extend(results)

                pagination = data.get("pagination", {})
                if page >= pagination.get("pages", 1):
                    break
                page += 1
                time.sleep(0.5)

        console.print(f"[green]Found {len(candidates)} TX candidates[/green]")
        return candidates

    def _fetch_candidate_committees(self, candidate_id: str) -> list[str]:
        """Get principal campaign committee IDs for a candidate."""
        url = f"{FEC_API_BASE}/candidate/{candidate_id}/committees/"
        data = self.fetch(url, self._api_params(designation="P"))
        time.sleep(0.5)
        if not data:
            return []
        return [c["committee_id"] for c in data.get("results", []) if c.get("committee_id")]

    def _fetch_contributions(
        self, committee_id: str, max_pages: int = 5
    ) -> list[dict]:
        """Fetch itemized contributions (Schedule A) for a committee.

        Uses cursor-based pagination via last_index / last_contribution_receipt_date.
        """
        contributions: list[dict] = []
        params = self._api_params(
            committee_id=committee_id,
            sort="-contribution_receipt_date",
            min_amount=200.01,  # Itemized only
            per_page=100,
        )

        for page_num in range(max_pages):
            data = self.fetch(f"{FEC_API_BASE}/schedules/schedule_a/", params)
            time.sleep(0.5)
            if not data:
                break

            results = data.get("results", [])
            contributions.extend(results)

            # Cursor-based pagination
            pagination = data.get("pagination", {})
            last_indexes = pagination.get("last_indexes", {})
            if not last_indexes or not last_indexes.get("last_index"):
                break

            params["last_index"] = last_indexes["last_index"]
            if last_indexes.get("last_contribution_receipt_date"):
                params["last_contribution_receipt_date"] = last_indexes[
                    "last_contribution_receipt_date"
                ]

        return contributions

    def _normalize_contribution(self, raw: dict, candidate: dict) -> tuple[dict, dict, dict]:
        """Normalize a contribution into Donor node, Contribution node, and edge.

        Returns: (donor_node, contribution_node, edge)
        """
        donor_name = raw.get("contributor_name", "Unknown")
        donor_node: dict[str, Any] = {
            "node_type": "Donor",
            "name": donor_name,
            "employer": raw.get("contributor_employer", ""),
            "occupation": raw.get("contributor_occupation", ""),
            "city": raw.get("contributor_city", ""),
            "state": raw.get("contributor_state", ""),
            "zip": raw.get("contributor_zip", ""),
            "source": "fec.gov",
            "source_id": donor_name.replace(" ", "_").lower(),
        }

        contrib_node: dict[str, Any] = {
            "node_type": "Contribution",
            "amount": raw.get("contribution_receipt_amount", 0),
            "date": raw.get("contribution_receipt_date", ""),
            "type": raw.get("receipt_type_full", raw.get("receipt_type", "")),
            "memo": raw.get("memo_text", ""),
            "fec_id": raw.get("sub_id", ""),
            "committee_id": raw.get("committee_id", ""),
            "source": "fec.gov",
            "source_id": str(raw.get("sub_id", "")),
        }

        edge: dict[str, Any] = {
            "edge_type": "DONATED_TO",
            "from_type": "Donor",
            "from_id": donor_node["source_id"],
            "to_type": "Official",
            "to_id": candidate.get("candidate_id", ""),
            "amount": raw.get("contribution_receipt_amount", 0),
            "date": raw.get("contribution_receipt_date", ""),
        }

        return donor_node, contrib_node, edge

    def run(self) -> dict:
        """Main ingestor: fetch TX candidate contributions."""
        console.print("[bold blue]═══ FEC Contributions Ingestor ═══[/bold blue]")

        candidates = self._fetch_candidates()
        self.save_raw("tx_candidates", candidates)

        all_donors: list[dict] = []
        all_contributions: list[dict] = []
        all_edges: list[dict] = []
        donor_seen: set[str] = set()

        for i, cand in enumerate(candidates):
            cand_id = cand.get("candidate_id", "")
            name = cand.get("name", "Unknown")
            console.print(f"  [{i+1}/{len(candidates)}] {name} ({cand_id})")

            committees = self._fetch_candidate_committees(cand_id)
            if not committees:
                continue

            for comm_id in committees[:1]:  # Primary committee only
                raw_contribs = self._fetch_contributions(comm_id)
                if raw_contribs:
                    self.save_raw(f"contributions_{comm_id}", raw_contribs)

                for raw in raw_contribs:
                    donor, contrib, edge = self._normalize_contribution(raw, cand)
                    all_contributions.append(contrib)
                    all_edges.append(edge)
                    self.stats["new"] += 1

                    if donor["source_id"] not in donor_seen:
                        all_donors.append(donor)
                        donor_seen.add(donor["source_id"])

        self.save_normalized("donors", all_donors)
        self.save_normalized("contributions", all_contributions)
        self.save_normalized("edges_donated_to", all_edges)

        console.print(
            f"[green]Saved {len(all_donors)} donors, "
            f"{len(all_contributions)} contributions, "
            f"{len(all_edges)} edges[/green]"
        )

        self.log_run()
        return {
            "donors": all_donors,
            "contributions": all_contributions,
            "edges_donated_to": all_edges,
        }


if __name__ == "__main__":
    ingestor = FECContributionsIngestor()
    result = ingestor.run()

    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  Unique donors: {len(result['donors'])}")
    console.print(f"  Contributions: {len(result['contributions'])}")
    console.print(f"  Donor→Official edges: {len(result['edges_donated_to'])}")

    # Top donors by frequency
    from collections import Counter
    donor_counts = Counter(e["from_id"] for e in result["edges_donated_to"])
    console.print(f"\n[bold]Top 10 donors by # contributions:[/bold]")
    for donor_id, count in donor_counts.most_common(10):
        console.print(f"  {donor_id}: {count}")
