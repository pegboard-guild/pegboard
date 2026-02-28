# FEC campaign finance — handle pagination edge cases

**Labels:** good first issue, ingestor, bug

**Description:**

The existing `ingestors/fec_contributions.py` ingestor works for basic queries but doesn't handle several FEC API pagination edge cases that cause data loss on large result sets.

**Known issues:**
1. The FEC API uses keyset pagination (`last_index` + `last_contribution_receipt_date`), not offset-based. If the ingestor falls back to offset pagination, it may miss or duplicate records.
2. Result sets larger than 100 pages (10,000 records per `candidate_id`) may silently truncate.
3. API rate limits (1,000 requests/hour with a key) aren't tracked across multiple candidate fetches in a single run.
4. Timeout/retry logic doesn't handle the FEC API's occasional 500 errors gracefully.

**FEC API docs:** https://api.open.fec.gov/developers/

**Implementation:**
1. Audit current pagination logic in `fec_contributions.py`
2. Switch to keyset pagination using `last_index` and `last_*_date` cursors
3. Add a request counter that pauses/sleeps when approaching rate limits
4. Add retry with exponential backoff for 5xx errors
5. Log total records fetched vs. `pagination.count` to detect truncation

**Acceptance criteria:**
- [ ] Large candidate queries (e.g., presidential candidates) fetch all pages without truncation
- [ ] Rate limiting prevents 429 errors
- [ ] 5xx errors retry gracefully (3 attempts, exponential backoff)
- [ ] Stats output shows fetched vs. expected count
- [ ] Tests cover pagination edge cases with mocked responses
