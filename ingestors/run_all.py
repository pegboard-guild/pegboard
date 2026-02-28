#!/usr/bin/env python3
"""Run all Pegboard ingestors in sequence."""
import sys
import time
from pathlib import Path

# Add parent to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))

from rich.console import Console
from rich.table import Table

from ingestors import ALL_INGESTORS

console = Console()


def main():
    """Run all ingestors and print summary."""
    console.print("[bold magenta]╔══════════════════════════════════╗[/bold magenta]")
    console.print("[bold magenta]║   Pegboard — Run All Ingestors   ║[/bold magenta]")
    console.print("[bold magenta]╚══════════════════════════════════╝[/bold magenta]\n")

    results = {}
    start = time.time()

    for cls in ALL_INGESTORS:
        ingestor = cls()
        name = ingestor.name
        console.print(f"\n[bold]▶ Running: {name}[/bold]")
        try:
            result = ingestor.run()
            results[name] = {"status": "✅", "stats": ingestor.stats}
        except Exception as e:
            console.print(f"[red]FAILED: {e}[/red]")
            results[name] = {"status": "❌", "stats": ingestor.stats, "error": str(e)}

    elapsed = time.time() - start

    # Summary table
    console.print(f"\n[bold]{'═' * 50}[/bold]")
    table = Table(title="Ingestor Results")
    table.add_column("Ingestor", style="cyan")
    table.add_column("Status")
    table.add_column("Fetched", justify="right")
    table.add_column("New", justify="right")
    table.add_column("Errors", justify="right")

    for name, info in results.items():
        s = info["stats"]
        table.add_row(
            name, info["status"],
            str(s["fetched"]), str(s["new"]), str(s["errors"]),
        )

    console.print(table)
    console.print(f"\n[bold]Total time: {elapsed:.1f}s[/bold]")


if __name__ == "__main__":
    main()
