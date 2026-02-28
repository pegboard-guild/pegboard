"""Ingestor for Congress.gov Members API.

Pulls current members of Congress, focusing on Texas delegation.
Source: https://api.congress.gov/v3/member
Docs: https://github.com/LibraryOfCongress/api.congress.gov
"""
import time
from .base import BaseIngestor, console
from config import CONGRESS_API_BASE, CONGRESS_API_KEY, DEFAULT_CONGRESS


class CongressMembersIngestor(BaseIngestor):
    name = "congress_members"
    source_url = "https://api.congress.gov/v3/member"

    def _get_members(self, state: str = "TX", congress: int = DEFAULT_CONGRESS) -> list[dict]:
        """Fetch all members for a state in a given congress."""
        members = []
        offset = 0
        limit = 250

        url = f"{CONGRESS_API_BASE}/member"
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json",
            "currentMember": "true",
            "limit": limit,
            "offset": offset,
        }

        console.print(f"[blue]Fetching current members from Congress.gov...[/blue]")
        data = self.fetch(url, params)
        if not data:
            return []

        all_members = data.get("members", [])

        # Handle pagination
        while data.get("pagination", {}).get("next"):
            time.sleep(1)  # Rate limit: be respectful
            offset += limit
            params["offset"] = offset
            data = self.fetch(url, params)
            if data:
                all_members.extend(data.get("members", []))
            else:
                break

        # Filter for Texas
        for m in all_members:
            if m.get("state") == state:
                members.append(m)

        console.print(f"[green]Found {len(members)} TX members out of {len(all_members)} total[/green]")
        return members

    def _get_member_detail(self, bioguide_id: str) -> dict | None:
        """Fetch detailed info for a specific member."""
        url = f"{CONGRESS_API_BASE}/member/{bioguide_id}"
        params = {"api_key": CONGRESS_API_KEY, "format": "json"}
        time.sleep(0.5)  # Rate limit
        data = self.fetch(url, params)
        if data:
            return data.get("member", {})
        return None

    def _normalize_member(self, raw: dict, detail: dict | None = None) -> dict:
        """Normalize a member record for the graph."""
        terms = raw.get("terms", {}).get("item", [])
        current_term = terms[0] if terms else {}

        member = {
            "node_type": "Official",
            "bioguide_id": raw.get("bioguideId", ""),
            "name": raw.get("name", ""),
            "first_name": raw.get("firstName", ""),
            "last_name": raw.get("lastName", ""),
            "party": raw.get("partyName", ""),
            "state": raw.get("state", ""),
            "district": raw.get("district"),
            "chamber": current_term.get("chamber", ""),
            "level": "federal",
            "office": f"US {'Senator' if current_term.get('chamber') == 'Senate' else 'Representative'}",
            "term_start": current_term.get("startYear"),
            "term_end": current_term.get("endYear"),
            "url": raw.get("url", ""),
            "source": "congress.gov",
            "source_id": raw.get("bioguideId", ""),
        }

        # Add detail fields if available
        if detail:
            member["birth_year"] = detail.get("birthYear")
            member["official_url"] = detail.get("officialWebsiteUrl", "")
            member["phone"] = detail.get("addressInformation", {}).get("phoneNumber", "")

            # Get committee memberships
            committees = []
            for assignment in detail.get("committees", {}).get("item", []):
                committees.append({
                    "name": assignment.get("name", ""),
                    "chamber": assignment.get("chamber", ""),
                    "url": assignment.get("url", ""),
                })
            member["committees"] = committees

            # Get sponsored legislation count
            sponsored = detail.get("sponsoredLegislation", {})
            member["bills_sponsored"] = sponsored.get("count", 0)

            cosponsored = detail.get("cosponsoredLegislation", {})
            member["bills_cosponsored"] = cosponsored.get("count", 0)

        return member

    def run(self):
        """Main ingestor: fetch TX members and their details."""
        console.print("[bold blue]═══ Congress Members Ingestor ═══[/bold blue]")

        # Get all TX members
        raw_members = self._get_members(state="TX")
        self.save_raw("tx_members_list", raw_members)

        # Get details for each
        normalized = []
        for i, raw in enumerate(raw_members):
            bioguide = raw.get("bioguideId", "")
            console.print(f"  [{i+1}/{len(raw_members)}] {raw.get('name', 'Unknown')} ({bioguide})")

            detail = self._get_member_detail(bioguide)
            if detail:
                self.save_raw(f"member_{bioguide}", detail)

            member = self._normalize_member(raw, detail)
            normalized.append(member)
            self.stats["new"] += 1

        # Save normalized
        filepath = self.save_normalized("tx_members", normalized)
        console.print(f"[green]Saved {len(normalized)} members to {filepath}[/green]")

        self.log_run()
        return normalized


if __name__ == "__main__":
    ingestor = CongressMembersIngestor()
    members = ingestor.run()

    # Print summary
    console.print("\n[bold]Texas Congressional Delegation:[/bold]")
    senators = [m for m in members if m["chamber"] == "Senate"]
    reps = [m for m in members if m["chamber"] == "House of Representatives"]

    console.print(f"\n[bold]Senators ({len(senators)}):[/bold]")
    for s in senators:
        console.print(f"  {s['name']} ({s['party']})")

    console.print(f"\n[bold]Representatives ({len(reps)}):[/bold]")
    for r in sorted(reps, key=lambda x: x.get("district") or 0):
        console.print(f"  District {r.get('district', '?')}: {r['name']} ({r['party']})")
