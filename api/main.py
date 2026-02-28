"""FastAPI application for Pegboard civic transparency API."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase

from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
from api.routes import officials, bills, contracts, search, graph


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage Neo4j driver lifecycle."""
    app.state.neo4j_driver = GraphDatabase.driver(
        NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
    )
    app.state.neo4j_driver.verify_connectivity()
    yield
    app.state.neo4j_driver.close()


app = FastAPI(
    title="Pegboard",
    description="Civic transparency API — officials, bills, votes, contracts, campaign finance",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(officials.router, prefix="/officials", tags=["officials"])
app.include_router(bills.router, prefix="/bills", tags=["bills"])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    try:
        app.state.neo4j_driver.verify_connectivity()
        return {"status": "ok", "neo4j": "connected"}
    except Exception as e:
        return {"status": "degraded", "neo4j": str(e)}
