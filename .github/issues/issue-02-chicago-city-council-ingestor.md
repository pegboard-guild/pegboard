# Add Chicago City Council ingestor

**Labels:** good first issue, ingestor, city

**Description:**

Build an ingestor for Chicago City Council data. Chicago has one of the best municipal open data programs in the country — this should be a rich data source.

**Data sources:**
- Chicago Data Portal: https://data.cityofchicago.org/
- Legislation & ordinances: https://chicago.legistar.com/
- Chicago City Clerk: council votes, ordinances, resolutions
- Socrata API: https://dev.socrata.com/

**Implementation:**
1. Create `ingestors/chicago_council.py` extending `BaseIngestor`
2. Fetch alderperson roster (name, ward, committee assignments)
3. Fetch ordinances and resolutions (title, sponsors, status, dates)
4. Fetch roll-call votes per ordinance
5. Normalize to Pegboard graph schema (Officials, Bills, Votes nodes)
6. Write normalized JSON to `data/chicago_council/`

**Notes:**
- Chicago uses Legistar for legislative tracking — the Legistar OData API may be useful: https://webapi.legistar.com/Help
- The Socrata portal has supplementary datasets (budget, contracts) that could be added later

**Acceptance criteria:**
- [ ] Ingestor runs: `python -m ingestors.chicago_council`
- [ ] Produces valid JSON with Officials, Bills, and Votes nodes
- [ ] Handles pagination
- [ ] Rate-limited requests
- [ ] Test file in `tests/`
- [ ] README updated
