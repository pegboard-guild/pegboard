# Hacker News Post

**Title:** Show HN: Pegboard – Open-source civic transparency platform (government data → knowledge graph)

**Body:**

Pegboard is an open-source platform that pulls public government data — votes, bills, campaign finance, budgets, lobbying records — and loads it into a Neo4j knowledge graph. The goal: make it trivially easy to answer questions like "who funded this representative?" or "how did my council member vote on the budget?"

The data is public. The problem is it's scattered across dozens of incompatible APIs, buried in PDFs, and formatted for compliance rather than comprehension. The FEC publishes campaign finance data, Congress.gov has votes and bills, cities publish council records on Legistar — none of it talks to each other. Pegboard connects it.

What's built so far: a Python ingestor framework with working scrapers for Congress members, bills, and FEC campaign contributions. A graph schema that models the relationships between officials, legislation, donors, and committees. The architecture is three layers: ingestors (Python, scheduled), the graph (Neo4j), and a visual frontend (Svelte, in progress) for navigating the data.

The project is modular by design. Each city is its own ingestor — a single Python file extending a base class. We have 9 city and federal ingestors specced out as good-first-issues. If your city publishes council data (most do), you can add it.

Licensed AGPL-3.0. Built in public. Your city is next.

GitHub: [link]
