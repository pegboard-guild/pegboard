# Texas Ethics Commission campaign finance bulk download ingestor

**Labels:** good first issue, ingestor, state

**Description:**

Build an ingestor for Texas state-level campaign finance data from the Texas Ethics Commission (TEC).

The TEC publishes bulk CSV downloads of campaign finance reports, expenditures, and donor data for all Texas state-level candidates and PACs. This is one of the richest state-level campaign finance datasets available.

**Data sources:**
- TEC bulk download page: https://www.ethics.state.tx.us/data/search/cf/CFS-ReadMe.txt
- Bulk CSV files: https://www.ethics.state.tx.us/data/search/cf/
- File format docs: the ReadMe.txt above describes all columns

**Implementation:**
1. Create `ingestors/texas_ethics.py` extending `BaseIngestor`
2. Download the bulk ZIP files (contributions, expenditures, filers)
3. Parse CSVs and extract: donor name, amount, date, recipient candidate/PAC
4. Normalize to graph schema (Donors, Officials, Contributions edges)
5. Write to `data/texas_ethics/`

**Notes:**
- Files are large (100MB+). Download and process incrementally if possible.
- Entity resolution between TEC filer names and Pegboard Officials is a stretch goal — for v1, just ingest the raw data with TEC filer IDs.

**Acceptance criteria:**
- [ ] Ingestor downloads and parses TEC bulk CSVs
- [ ] Produces valid JSON (Donors, Contributions nodes/edges)
- [ ] Handles large files without excessive memory usage
- [ ] Tests with sample CSV data
- [ ] README updated
