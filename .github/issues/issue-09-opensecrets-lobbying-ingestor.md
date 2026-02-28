# OpenSecrets lobbying data ingestor

**Labels:** good first issue, ingestor, federal

**Description:**

Build an ingestor for lobbying data from OpenSecrets (Center for Responsive Politics).

Lobbying disclosure connects corporations and interest groups to specific bills and officials. This is critical "follow the money" data for the Pegboard graph.

**Data sources:**
- OpenSecrets API: https://www.opensecrets.org/api
- Relevant endpoints: `getLobbyists`, `lobbying` sector/industry data
- API key required (free for non-commercial use): https://www.opensecrets.org/api/admin/index.php?function=signup
- Bulk data (more complete): https://www.opensecrets.org/open-data/bulk-data

**Implementation:**
1. Create `ingestors/opensecrets_lobbying.py` extending `BaseIngestor`
2. Fetch lobbying records by industry/sector or by specific bill
3. Extract: registrant (firm), client, issue area, bills lobbied on, amount, year
4. Normalize to graph schema (Lobbyists, Organizations, `lobbied_for` edges to Bills)
5. Write to `data/opensecrets_lobbying/`

**Notes:**
- The API has rate limits and data access tiers. Start with the free API; document what's available vs. what requires bulk data access.
- API key should be loaded from env var `OPENSECRETS_API_KEY`

**Acceptance criteria:**
- [ ] Ingestor runs with a valid API key
- [ ] Produces Lobbyists, Organizations nodes and lobbied_for edges
- [ ] Rate limiting respected
- [ ] Tests with mocked responses
- [ ] README updated with setup instructions for API key
