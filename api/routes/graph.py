"""Graph visualization endpoints."""
from fastapi import APIRouter, Request

from api.models import GraphResponse, GraphNode, GraphEdge

router = APIRouter()


@router.get("/connections/{bioguide_id}", response_model=GraphResponse)
async def graph_connections(request: Request, bioguide_id: str) -> GraphResponse:
    """Get nodes+edges JSON for frontend graph visualization of an official's connections."""
    driver = request.app.state.neo4j_driver
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    seen_nodes: set[str] = set()

    with driver.session() as session:
        result = session.run(
            """
            MATCH (o:Official {bioguide_id: $id})
            OPTIONAL MATCH (d:Donor)-[donated:DONATED_TO]->(o)
            OPTIONAL MATCH (d)-[:EMPLOYED_BY]->(org:Organization)
            OPTIONAL MATCH (c:Contract)-[:AWARDED_TO]->(org)
            OPTIONAL MATCH (o)-[:MEMBER_OF]->(com:Committee)
            RETURN o, d, donated, org, c, com
            """,
            id=bioguide_id,
        )
        for record in result:
            o = record["o"]
            if o and o["bioguide_id"] not in seen_nodes:
                seen_nodes.add(o["bioguide_id"])
                nodes.append(GraphNode(id=o["bioguide_id"], label=o.get("name", ""), type="Official", properties=dict(o)))

            d = record["d"]
            if d and d.get("source_id") and d["source_id"] not in seen_nodes:
                seen_nodes.add(d["source_id"])
                nodes.append(GraphNode(id=d["source_id"], label=d.get("name", ""), type="Donor", properties=dict(d)))
                edges.append(GraphEdge(source=d["source_id"], target=o["bioguide_id"], type="DONATED_TO"))

            org = record["org"]
            if org and org.get("name") and org["name"] not in seen_nodes:
                seen_nodes.add(org["name"])
                nodes.append(GraphNode(id=org["name"], label=org["name"], type="Organization"))
                if d and d.get("source_id"):
                    edges.append(GraphEdge(source=d["source_id"], target=org["name"], type="EMPLOYED_BY"))

            c = record["c"]
            if c and c.get("source_id") and c["source_id"] not in seen_nodes:
                seen_nodes.add(c["source_id"])
                nodes.append(GraphNode(id=c["source_id"], label=c.get("title", ""), type="Contract", properties=dict(c)))
                if org and org.get("name"):
                    edges.append(GraphEdge(source=c["source_id"], target=org["name"], type="AWARDED_TO"))

            com = record["com"]
            if com and com.get("name") and com["name"] not in seen_nodes:
                seen_nodes.add(com["name"])
                nodes.append(GraphNode(id=com["name"], label=com["name"], type="Committee"))
                edges.append(GraphEdge(source=o["bioguide_id"], target=com["name"], type="MEMBER_OF"))

    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/money-flow/{bioguide_id}", response_model=GraphResponse)
async def money_flow(request: Request, bioguide_id: str) -> GraphResponse:
    """Donor → Official → Contract chain visualization."""
    driver = request.app.state.neo4j_driver
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    seen: set[str] = set()

    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Donor)-[donated:DONATED_TO]->(o:Official {bioguide_id: $id})
            OPTIONAL MATCH (d)-[:EMPLOYED_BY]->(org:Organization)<-[:AWARDED_TO]-(c:Contract)
            RETURN d.source_id AS did, d.name AS dname, d.employer AS demp,
                   donated.total_amount AS amount,
                   org.name AS org_name,
                   c.source_id AS cid, c.title AS ctitle, c.amount AS camount
            ORDER BY donated.total_amount DESC
            LIMIT 100
            """,
            id=bioguide_id,
        )

        # Add official node
        nodes.append(GraphNode(id=bioguide_id, label=bioguide_id, type="Official"))
        seen.add(bioguide_id)

        for r in result:
            did = r["did"] or ""
            if did and did not in seen:
                seen.add(did)
                nodes.append(GraphNode(id=did, label=r["dname"] or "", type="Donor"))
                edges.append(GraphEdge(source=did, target=bioguide_id, type="DONATED_TO",
                                       properties={"amount": r["amount"]}))

            org = r["org_name"] or ""
            if org and org not in seen:
                seen.add(org)
                nodes.append(GraphNode(id=org, label=org, type="Organization"))
            if did and org:
                edges.append(GraphEdge(source=did, target=org, type="EMPLOYED_BY"))

            cid = r["cid"] or ""
            if cid and cid not in seen:
                seen.add(cid)
                nodes.append(GraphNode(id=cid, label=r["ctitle"] or "", type="Contract",
                                       properties={"amount": r["camount"]}))
            if cid and org:
                edges.append(GraphEdge(source=cid, target=org, type="AWARDED_TO"))

    return GraphResponse(nodes=nodes, edges=edges)
