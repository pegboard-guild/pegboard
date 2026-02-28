# r/civictech Post

**Title:** Pegboard: turning buried government data into a navigable knowledge graph — open source, any city can be added

**Body:**

How much time have you spent trying to find out how your representative voted on something? Or who their top donors are? The data exists — it's public — but it's scattered across the FEC, Congress.gov, Legistar, city clerk websites, and state ethics commissions. Some of it is in PDFs. None of it connects to each other.

Pegboard is an open-source project that pulls all of this public data together into a single knowledge graph. Officials are connected to their votes, their donors, the bills they sponsored, the committees they sit on, and the lobbyists who contacted them. All sourced from public records, all verifiable.

**How it works:**
- Python ingestors pull from public APIs (FEC, Congress.gov, city open data portals)
- Data is normalized and loaded into a Neo4j graph database
- A Svelte frontend (in development) makes the graph navigable — representative profile cards, budget treemaps, vote timelines

**The key design decision: any city can be added.** Each city is a single Python ingestor file. If your city publishes council data through Legistar, Socrata, or any public API, it can be on Pegboard. We have ingestors specced out for Austin, Chicago, NYC, LA, and Houston — each one is a good-first-issue on GitHub.

The project is AGPL-licensed and built to be community-driven. The ingestor framework is working, federal data is flowing, and we need people to add their cities.

If you've worked with your city's open data and know where the bodies are buried (metaphorically — which APIs work, which are broken, where the PDFs are), we'd love your help.

GitHub: [link]
