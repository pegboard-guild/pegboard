"""Ingestor for USAspending.gov federal contracts & grants in Texas.

Uses POST-based search API (no key required).
Source: https://api.usaspending.gov/api/v2
Docs: https://api.usaspending.gov/docs/endpoints
"""
import time
from typing import Any

import httpx

from .base import BaseIngestor, console
from config import USASPENDING_API_BASE


# DFW-area counties for filtering
DFW_COUNTIES = [
    "DALLAS", "TARRANT", "COLLIN", "DENTON", "ELLIS", "JOHNSON",
    "KAUFMAN", "PARKER", "ROCKWALL", "WISE", "HUNT",
]


class USASpendingIngestor(BaseIngestor):
    """Fetches federal contracts and grants awarded in Texas / DFW area."""

    name = "usaspending"
    source_url = "https://api.usaspending.gov/api/v2"

    def _post(self, endpoint: str, payload: dict) -> dict | None:
        """POST to USAspending API."""
        url = f"{USASPENDING_API_BASE}{endpoint}"
        try:
            resp = self.client.post(url, json=payload, timeout=30.0)
            resp.raise_for_status()
            self.stats["fetched"] += 1
            return resp.json()
        except Exception as e:
            console.print(f"[red]Error POST {url}: {e}[/red]")
            self.stats["errors"] += 1
            return None

    def _fetch_awards(self, award_type: str, page: int = 1, limit: int = 100) -> dict | None:
        """Fetch awards by type (contracts or grants) in Texas.

        Args:
            award_type: 'contracts' or 'grants'
        """
        type_codes = ["A", "B", "C", "D"] if award_type == "contracts" else ["02", "03", "04", "05"]

        payload = {
            "filters": {
                "time_period": [
                    {"start_date": "2024-10-01", "end_date": "2025-09-30"},  # FY2025
                    {"start_date": "2023-10-01", "end_date": "2024-09-30"},  # FY2024
                ],
                "place_of_performance_locations": [
                    {"country": "USA", "state": "TX"}
                ],
                "award_type_codes": type_codes,
            },
            "fields": [
                "Award ID", "Recipient Name", "Description",
                "Start Date", "End Date", "Award Amount",
                "Awarding Agency", "Awarding Sub Agency",
                "Place of Performance City Code",
                "Place of Performance State Code",
                "Place of Performance County Name",
                "generated_internal_id",
            ],
            "page": page,
            "limit": limit,
            "sort": "Award Amount",
            "order": "desc",
        }

        return self._post("/search/spending_by_award/", payload)

    def _normalize_contract(self, raw: dict) -> dict:
        """Normalize a contract/grant award."""
        return {
            "node_type": "Contract",
            "award_id": raw.get("Award ID", ""),
            "internal_id": raw.get("generated_internal_id", ""),
            "title": raw.get("Description", ""),
            "amount": raw.get("Award Amount", 0),
            "awardee": raw.get("Recipient Name", ""),
            "agency": raw.get("Awarding Agency", ""),
            "sub_agency": raw.get("Awarding Sub Agency", ""),
            "start_date": raw.get("Start Date", ""),
            "end_date": raw.get("End Date", ""),
            "county": raw.get("Place of Performance County Name", ""),
            "level": "federal",
            "source": "usaspending.gov",
            "source_id": raw.get("generated_internal_id", raw.get("Award ID", "")),
        }

    def _normalize_agency(self, name: str) -> dict:
        """Create an Agency node."""
        return {
            "node_type": "Agency",
            "name": name,
            "level": "federal",
            "source": "usaspending.gov",
            "source_id": name.replace(" ", "_").lower(),
        }

    def _is_dfw(self, raw: dict) -> bool:
        """Check if award is in DFW area."""
        county = (raw.get("Place of Performance County Name") or "").upper()
        return county in DFW_COUNTIES

    def run(self) -> dict:
        """Main ingestor: fetch TX contracts and grants."""
        console.print("[bold blue]═══ USAspending Ingestor ═══[/bold blue]")

        all_contracts: list[dict] = []
        all_agencies: list[dict] = []
        edges_awarded: list[dict] = []
        edges_funded: list[dict] = []
        agency_seen: set[str] = set()

        for award_type in ["contracts", "grants"]:
            console.print(f"[blue]Fetching {award_type}...[/blue]")
            raw_awards: list[dict] = []

            for page in range(1, 6):  # Up to 5 pages (500 awards)
                data = self._post_awards(award_type, page)
                time.sleep(0.5)
                if not data:
                    break

                results = data.get("results", [])
                if not results:
                    break
                raw_awards.extend(results)

                if not data.get("page_metadata", {}).get("hasNext", False):
                    break

            self.save_raw(f"{award_type}_raw", raw_awards)

            # Filter for DFW where possible, normalize all
            for raw in raw_awards:
                contract = self._normalize_contract(raw)
                contract["award_type"] = award_type
                contract["is_dfw"] = self._is_dfw(raw)
                all_contracts.append(contract)
                self.stats["new"] += 1

                # Awarded-to edge
                edges_awarded.append({
                    "edge_type": "AWARDED_TO",
                    "from_type": "Contract",
                    "from_id": contract["source_id"],
                    "to_type": "Organization",
                    "to_id": contract["awardee"],
                })

                # Agency node + funded-by edge
                agency_name = contract["agency"]
                if agency_name and agency_name not in agency_seen:
                    all_agencies.append(self._normalize_agency(agency_name))
                    agency_seen.add(agency_name)

                edges_funded.append({
                    "edge_type": "FUNDED_BY",
                    "from_type": "Contract",
                    "from_id": contract["source_id"],
                    "to_type": "Agency",
                    "to_id": agency_name,
                })

            console.print(f"[green]  {len(raw_awards)} {award_type} fetched[/green]")

        # Save normalized
        self.save_normalized("contracts", all_contracts)
        self.save_normalized("agencies", all_agencies)
        self.save_normalized("edges_awarded_to", edges_awarded)
        self.save_normalized("edges_funded_by", edges_funded)

        dfw_count = sum(1 for c in all_contracts if c.get("is_dfw"))
        console.print(
            f"[green]Saved {len(all_contracts)} awards ({dfw_count} DFW), "
            f"{len(all_agencies)} agencies[/green]"
        )

        self.log_run()
        return {
            "contracts": all_contracts,
            "agencies": all_agencies,
            "edges_awarded_to": edges_awarded,
            "edges_funded_by": edges_funded,
        }

    def _post_awards(self, award_type: str, page: int = 1) -> dict | None:
        """Wrapper matching the interface used in run()."""
        return self._fetch_awards(award_type, page=page)


if __name__ == "__main__":
    ingestor = USASpendingIngestor()
    result = ingestor.run()

    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  Total awards: {len(result['contracts'])}")
    console.print(f"  Agencies: {len(result['agencies'])}")

    dfw = [c for c in result["contracts"] if c.get("is_dfw")]
    console.print(f"  DFW-area awards: {len(dfw)}")

    # Top agencies
    from collections import Counter
    agency_counts = Counter(c["agency"] for c in result["contracts"])
    console.print(f"\n[bold]Top agencies:[/bold]")
    for agency, count in agency_counts.most_common(10):
        console.print(f"  {agency}: {count}")
