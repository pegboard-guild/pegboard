# Add NYC City Council ingestor

**Labels:** good first issue, ingestor, city

**Description:**

Build an ingestor for New York City Council data using NYC OpenData and the Legistar API.

NYC is the largest city government in the US. Their council data includes legislation, votes, committee hearings, and member info — all publicly accessible.

**Data sources:**
- NYC OpenData: https://opendata.cityofnewyork.us/
- NYC Council legislation: https://legistar.council.nyc.gov/
- Legistar OData API: https://webapi.legistar.com/Help (client: nyccouncil)
- NYC Council API (unofficial): https://council.nyc.gov/

**Implementation:**
1. Create `ingestors/nyc_council.py` extending `BaseIngestor`
2. Fetch council member roster (name, district, borough, committees)
3. Fetch legislation (intros, resolutions, local laws — title, sponsors, status)
4. Fetch roll-call votes
5. Normalize to graph schema
6. Write to `data/nyc_council/`

**Acceptance criteria:**
- [ ] Ingestor runs: `python -m ingestors.nyc_council`
- [ ] Produces Officials, Bills, Votes nodes as valid JSON
- [ ] Pagination handled
- [ ] Rate limiting in place
- [ ] Tests in `tests/`
- [ ] README updated
