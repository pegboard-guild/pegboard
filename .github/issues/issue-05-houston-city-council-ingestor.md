# Add Houston City Council ingestor

**Labels:** good first issue, ingestor, city

**Description:**

Build an ingestor for Houston City Council data.

Houston is the 4th largest US city. Their council agenda and meeting data is available through the city's public records, though the data infrastructure is less mature than Chicago or NYC.

**Data sources:**
- Houston Open Data: https://data.houstontx.gov/ (Socrata-based)
- Houston City Council agendas: https://houston.novusagenda.com/agendapublic/
- Legistar (if available): https://houston.legistar.com/

**Implementation:**
1. Create `ingestors/houston_council.py` extending `BaseIngestor`
2. Fetch council member roster (name, district, at-large positions)
3. Fetch agenda items, ordinances, resolutions
4. Fetch vote records (may require scraping agenda PDFs — document limitations)
5. Normalize to graph schema
6. Write to `data/houston_council/`

**Notes:**
- Houston's data may be less API-friendly. If vote data requires PDF parsing, document this as a follow-up issue and focus on what's available via structured APIs first.

**Acceptance criteria:**
- [ ] Ingestor runs: `python -m ingestors.houston_council`
- [ ] Valid JSON output (Officials at minimum; Bills/Votes if available via API)
- [ ] Handles pagination and rate limiting
- [ ] Tests in `tests/`
- [ ] README updated
