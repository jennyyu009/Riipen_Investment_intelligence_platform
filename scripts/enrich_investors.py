#!/usr/bin/env python
"""Local-only batch investor enrichment.

Run with:
ENABLE_HEAVY_PROCESSING=true ENABLE_CRAWL_ENRICHMENT=true ENABLE_EMBEDDING_MODEL=true python scripts/enrich_investors.py
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import require_heavy_processing
from backend.database import Base, SessionLocal, engine, ensure_database_schema
from backend.investor_enrichment import enrich_investor
from backend.models import Investor
from backend.seed_investors import ensure_investors_seeded


def main():
    require_heavy_processing("Investor enrichment")
    Base.metadata.create_all(bind=engine)
    ensure_database_schema()
    ensure_investors_seeded()

    db = SessionLocal()
    try:
        investors = db.query(Investor).all()
        for index, investor in enumerate(investors, start=1):
            print(f"[{index}/{len(investors)}] enriching {investor.entity_name}")
            enrich_investor(investor, force=True)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
