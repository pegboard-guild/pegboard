# Repository Setup

## GitHub Topics

Add these topics in **Settings → General → Topics**:

```
civic-tech, open-government, transparency, knowledge-graph, neo4j, python, government-data, open-data, campaign-finance, follow-the-money
```

## Branch Protection

Enable on `main`:
- Require PR reviews (1 reviewer)
- Require status checks (CI)
- Require branches to be up to date

## Secrets

Add these repository secrets for the ingest workflow:
- `CONGRESS_API_KEY` — from https://api.congress.gov/sign-up/
- `FEC_API_KEY` — from https://api.open.fec.gov/developers/
