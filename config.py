"""Pegboard configuration."""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
CONGRESS_API_KEY = os.getenv("CONGRESS_API_KEY", "DEMO_KEY")
FEC_API_KEY = os.getenv("FEC_API_KEY", "DEMO_KEY")
OPENSTATES_API_KEY = os.getenv("OPENSTATES_API_KEY", "")
GOOGLE_CIVIC_API_KEY = os.getenv("GOOGLE_CIVIC_API_KEY", "")

# Congress.gov API
CONGRESS_API_BASE = "https://api.congress.gov/v3"

# FEC API
FEC_API_BASE = "https://api.open.fec.gov/v1"

# USAspending API (no key required)
USASPENDING_API_BASE = "https://api.usaspending.gov/api/v2"

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "pegboard")

# Texas
TX_LEGISLATURE_BASE = "https://capitol.texas.gov"

# Dallas
DALLAS_COUNCIL_BASE = "https://dallascityhall.com"

# Ingestor settings
DEFAULT_CONGRESS = 119  # Current congress
TX_DFW_DISTRICTS_HOUSE = [3, 5, 6, 12, 24, 25, 26, 30, 32, 33, 34]  # DFW-area US House districts
TX_SENATORS = ["Cruz", "Allred"]  # Current TX senators
