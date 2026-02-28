# Graph Schema

Pegboard stores civic data as a Neo4j knowledge graph. This document describes all node types and the relationships between them.

## Node Types

### Official
An elected or appointed government official.

| Property | Type | Description |
|----------|------|-------------|
| `bioguide_id` | string | Unique ID (federal officials) |
| `name` | string | Full name |
| `party` | string | Political party |
| `state` | string | State code |
| `district` | int | District number (House members) |
| `chamber` | string | Senate / House / City Council |
| `level` | string | federal / state / local |
| `office` | string | Position title |
| `term_start` | int | Start year |
| `term_end` | int | End year |

### Bill
A piece of legislation at any level.

| Property | Type | Description |
|----------|------|-------------|
| `source_id` | string | Unique identifier |
| `number` | string | Bill number (e.g., HR-1234) |
| `title` | string | Official title |
| `summary` | string | Plain-language summary |
| `status` | string | Current status |
| `congress` | int | Congress number (federal) |
| `introduced_date` | string | ISO date |
| `level` | string | federal / state / local |

### Vote / VotePosition
A roll call vote and individual positions.

### Committee
A legislative committee.

### Donor
An individual or organization that made campaign contributions.

| Property | Type | Description |
|----------|------|-------------|
| `source_id` | string | Unique identifier |
| `name` | string | Donor name |
| `employer` | string | Employer name |
| `occupation` | string | Occupation |

### Contribution
A single campaign contribution record.

### Contract
A government contract award.

| Property | Type | Description |
|----------|------|-------------|
| `source_id` | string | Unique identifier |
| `title` | string | Contract description |
| `amount` | float | Dollar amount |
| `agency` | string | Awarding agency |
| `state` | string | State |

### Agency / Organization / Lobbyist / Budget
Supporting nodes for government agencies, private organizations, lobbyists, and budget allocations.

## Relationships

```
(Donor)-[:DONATED_TO]->(Official)
(Donor)-[:EMPLOYED_BY]->(Organization)
(Organization)<-[:AWARDED_TO]-(Contract)

(Official)-[:SPONSORED]->(Bill)
(Official)-[:COSPONSORED]->(Bill)
(Official)-[:CAST_VOTE]->(VotePosition)-[:VOTE_ON]->(Vote)-[:VOTE_REGARDING]->(Bill)
(Official)-[:MEMBER_OF]->(Committee)

(Lobbyist)-[:LOBBIED_FOR]->(Bill)
(Budget)-[:FUNDED_BY]->(Agency)
```

### The Money Trail

The most powerful query pattern — connecting donations to contracts:

```
(Donor)-[:DONATED_TO]->(Official)
(Donor)-[:EMPLOYED_BY]->(Organization)<-[:AWARDED_TO]-(Contract)
```

This reveals when a donor's employer receives government contracts from the same officials they fund.

## Example Cypher Queries

**Find an official's top donors:**
```cypher
MATCH (d:Donor)-[r:DONATED_TO]->(o:Official {bioguide_id: "C001098"})
RETURN d.name, d.employer, r.total_amount
ORDER BY r.total_amount DESC LIMIT 10
```

**Follow the money — donor to contract chain:**
```cypher
MATCH (d:Donor)-[:DONATED_TO]->(o:Official),
      (d)-[:EMPLOYED_BY]->(org:Organization)<-[:AWARDED_TO]-(c:Contract)
WHERE o.state = "TX"
RETURN o.name, d.name, org.name, c.title, c.amount
ORDER BY c.amount DESC
```

**Officials who share donors:**
```cypher
MATCH (o1:Official)<-[:DONATED_TO]-(d:Donor)-[:DONATED_TO]->(o2:Official)
WHERE id(o1) < id(o2)
RETURN o1.name, o2.name, count(d) AS shared_donors
ORDER BY shared_donors DESC
```
