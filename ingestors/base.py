"""Base ingestor class for Pegboard data sources."""
import httpx
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from rich.console import Console

console = Console()

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


class BaseIngestor:
    """Base class for all Pegboard data ingestors."""

    name: str = "base"
    source_url: str = ""

    def __init__(self):
        self.client = httpx.Client(timeout=30.0, follow_redirects=True)
        self.run_dir = DATA_DIR / self.name
        self.run_dir.mkdir(exist_ok=True)
        self.stats = {"fetched": 0, "new": 0, "updated": 0, "errors": 0}

    def fetch(self, url: str, params: dict = None) -> dict | list | None:
        """Fetch JSON from a URL with error handling."""
        try:
            resp = self.client.get(url, params=params)
            resp.raise_for_status()
            self.stats["fetched"] += 1
            return resp.json()
        except httpx.HTTPStatusError as e:
            console.print(f"[red]HTTP {e.response.status_code}: {url}[/red]")
            self.stats["errors"] += 1
            return None
        except Exception as e:
            console.print(f"[red]Error fetching {url}: {e}[/red]")
            self.stats["errors"] += 1
            return None

    def save_raw(self, filename: str, data: dict | list):
        """Save raw API response for audit trail."""
        raw_dir = self.run_dir / "raw"
        raw_dir.mkdir(exist_ok=True)
        filepath = raw_dir / f"{filename}.json"
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_normalized(self, filename: str, data: list[dict]):
        """Save normalized data ready for graph loading."""
        norm_dir = self.run_dir / "normalized"
        norm_dir.mkdir(exist_ok=True)
        filepath = norm_dir / f"{filename}.json"
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2, default=str)
        return filepath

    def log_run(self):
        """Log ingestor run stats."""
        timestamp = datetime.now(timezone.utc).isoformat()
        log_entry = {
            "ingestor": self.name,
            "timestamp": timestamp,
            "stats": self.stats,
        }
        log_file = self.run_dir / "run_log.jsonl"
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
        console.print(
            f"[green]{self.name}[/green]: "
            f"fetched={self.stats['fetched']} "
            f"new={self.stats['new']} "
            f"updated={self.stats['updated']} "
            f"errors={self.stats['errors']}"
        )

    def run(self):
        """Override in subclass. Main ingestor logic."""
        raise NotImplementedError

    def __del__(self):
        if hasattr(self, "client"):
            self.client.close()
