#!/usr/bin/env python
"""Export the pre-enriched investor records consumed by production."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import ENRICHED_INVESTORS_PATH, require_heavy_processing
from backend.database import Base, SessionLocal, engine, ensure_database_schema
from backend.investor_enrichment import investor_data
from backend.models import Investor
from backend.seed_investors import ensure_investors_seeded


def main():
    require_heavy_processing("Export enriched investor data")
    Base.metadata.create_all(bind=engine)
    ensure_database_schema()
    ensure_investors_seeded()
    ENRICHED_INVESTORS_PATH.parent.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        investors = db.query(Investor).order_by(Investor.id.asc()).all()
        records = [investor_data(investor) for investor in investors]
    finally:
        db.close()

    with ENRICHED_INVESTORS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(records, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"Exported {len(records)} investors to {ENRICHED_INVESTORS_PATH}")


if __name__ == "__main__":
    main()
