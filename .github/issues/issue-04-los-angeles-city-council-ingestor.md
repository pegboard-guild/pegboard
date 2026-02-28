# Add Los Angeles City Council ingestor

**Labels:** good first issue, ingestor, city

**Description:**

Build an ingestor for Los Angeles City Council data.

LA publishes council files, motions, and votes through their City Clerk system. The data is less cleanly structured than Chicago or NYC, which makes this a slightly more challenging but valuable ingestor.

**Data sources:**
- LA City Clerk Council File Management System: https://cityclerk.lacity.org/lacityclerkconnect/
- LA Open Data: https://data.lacity.org/
- LA Legistar: https://lacity.legistar.com/
- Legistar OData API: https://webapi.legistar.com/Help (client: lacity)

**Implementation:**
1. Create `ingestors/la_council.py` extending `BaseIngestor`
2. Fetch council member roster (name, district, committees)
3. Fetch council files / motions (title, movers, status)
4. Fetch vote records
5. Normalize to graph schema
6. Write to `data/la_council/`

**Acceptance criteria:**
- [ ] Ingestor runs: `python -m ingestors.la_council`
- [ ] Valid JSON output matching schema
- [ ] Pagination and rate limiting
- [ ] Tests in `tests/`
- [ ] README updated
