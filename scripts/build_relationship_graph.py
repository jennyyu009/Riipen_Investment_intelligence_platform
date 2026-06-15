#!/usr/bin/env python
"""Local-only relationship graph preprocessing.

This script computes warm paths from local LinkedIn/message exports and writes
data/precomputed_warm_paths.json for production lookup.
"""

from argparse import ArgumentParser
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import PRECOMPUTED_WARM_PATHS_PATH, require_heavy_processing
from backend.enriched_data import load_enriched_investors
from backend.relationship_intelligence.relationship_intelligence import run_relationship_intelligence


def main():
    require_heavy_processing("Relationship graph preprocessing")
    parser = ArgumentParser()
    parser.add_argument("--founder-name", required=True)
    parser.add_argument("--connections-csv", required=True)
    parser.add_argument("--messages-csv")
    args = parser.parse_args()

    investors = load_enriched_investors()
    top_investors = [
        {
            **investor,
            "investor_name": investor.get("entity_name"),
            "matching_score": investor.get("final_score"),
        }
        for investor in investors
    ]
    result = run_relationship_intelligence(
        founder_data={"name": args.founder_name},
        top_investors=top_investors,
        connections_csv_path=args.connections_csv,
        messages_csv_path=args.messages_csv,
        neo4j_uri=None,
    )

    founder_key = args.founder_name.strip().lower()
    paths_by_investor = {
        entry["investor_name"]: entry.get("paths", [])
        for entry in result.get("results", [])
        if entry.get("paths")
    }
    output = {"founders": {founder_key: paths_by_investor}, "investors": {}}
    PRECOMPUTED_WARM_PATHS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PRECOMPUTED_WARM_PATHS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"Exported warm paths for {len(paths_by_investor)} investors to {PRECOMPUTED_WARM_PATHS_PATH}")


if __name__ == "__main__":
    main()
