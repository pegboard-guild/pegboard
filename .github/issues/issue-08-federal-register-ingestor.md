# Federal Register — executive orders and regulations ingestor

**Labels:** good first issue, ingestor, federal

**Description:**

Build an ingestor for the Federal Register API to pull executive orders, proposed rules, and final rules.

The Federal Register is the daily journal of the US government. Its API is well-documented and freely accessible. This data connects the executive branch to the legislative graph — executive orders reference statutes, agencies implement laws passed by Congress.

**Data sources:**
- Federal Register API: https://www.federalregister.gov/developers/documentation/api/v1
- Endpoints: `/documents`, `/agencies`
- Document types: `PRESDOCU` (presidential), `RULE`, `PRORULE`, `NOTICE`

**Implementation:**
1. Create `ingestors/federal_register.py` extending `BaseIngestor`
2. Fetch executive orders (`type=PRESDOCU`, `presidential_document_type=executive_order`)
3. Fetch significant final rules (`type=RULE`, `significant=1`)
4. Extract: title, document number, signing date, agency, CFR references, abstract
5. Normalize to graph schema (new node type: ExecutiveOrder / Regulation)
6. Write to `data/federal_register/`

**Acceptance criteria:**
- [ ] Ingestor runs: `python -m ingestors.federal_register`
- [ ] Fetches executive orders and significant rules
- [ ] Pagination handled (API uses `page` and `per_page`)
- [ ] Valid JSON output
- [ ] Tests with mocked API responses
- [ ] README updated
