import json
import logging

try:
    from .config import ENRICHED_INVESTORS_PATH
    from .json_fields import serialize_investor_json_fields
    from .models import Investor
except ImportError:
    from config import ENRICHED_INVESTORS_PATH
    from json_fields import serialize_investor_json_fields
    from models import Investor


logger = logging.getLogger("uvicorn.error")
INVESTOR_FIELDS = {
    column.name
    for column in Investor.__table__.columns
    if column.name not in {"id", "created_at"}
}


def load_enriched_investors(path=ENRICHED_INVESTORS_PATH):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, list) else data.get("investors", [])


def seed_enriched_investors(db, replace=False):
    records = load_enriched_investors()
    if not records:
        logger.warning("No pre-enriched investor records found at %s", ENRICHED_INVESTORS_PATH)
        return db.query(Investor).count()

    existing_count = db.query(Investor).count()
    if existing_count and not replace:
        return existing_count
    if replace:
        db.query(Investor).delete()

    for record in records:
        values = {key: value for key, value in record.items() if key in INVESTOR_FIELDS}
        values = serialize_investor_json_fields(values)
        db.add(Investor(**values))
    db.commit()
    return len(records)


def sync_enriched_investors(db):
    records = load_enriched_investors()
    if not records:
        logger.warning("No pre-enriched investor records found at %s", ENRICHED_INVESTORS_PATH)
        return db.query(Investor).count()

    existing = {
        investor.entity_name: investor
        for investor in db.query(Investor).all()
        if investor.entity_name
    }
    for record in records:
        values = {key: value for key, value in record.items() if key in INVESTOR_FIELDS}
        values = serialize_investor_json_fields(values)
        entity_name = values.get("entity_name")
        investor = existing.get(entity_name)
        if investor:
            for key, value in values.items():
                setattr(investor, key, value)
        else:
            db.add(Investor(**values))
    db.commit()
    return db.query(Investor).count()
