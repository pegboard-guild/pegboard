# Add Austin City Council ingestor

**Labels:** good first issue, ingestor, city

**Description:**

Build an ingestor for Austin City Council data using the City of Austin Open Data Portal.

Austin publishes council meeting agendas, minutes, ordinances, and resolutions via their Socrata-based open data portal. This ingestor should pull council member info, agenda items, and voting records into Pegboard's normalized JSON format.

**Data sources:**
- Austin Open Data Portal: https://data.austintexas.gov/
- Council agenda/minutes: search for "council" datasets on the portal
- Socrata API docs: https://dev.socrata.com/

**Implementation:**
1. Create `ingestors/austin_council.py` extending `BaseIngestor`
2. Fetch council member roster (name, district, term dates)
3. Fetch agenda items and resolutions
4. Fetch voting records if available (Austin may publish these separately)
5. Normalize output to match the graph schema in `ARCHITECTURE.md`
6. Write normalized JSON to `data/austin_council/`

**Acceptance criteria:**
- [ ] Ingestor runs without errors: `python -m ingestors.austin_council`
- [ ] Produces valid JSON matching the schema (Officials, Bills/Resolutions nodes)
- [ ] Handles API pagination correctly
- [ ] Includes rate limiting / polite fetching
- [ ] Basic test in `tests/test_austin_council.py`
- [ ] Updates README with the new data source
