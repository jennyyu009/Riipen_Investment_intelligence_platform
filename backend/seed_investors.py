from pathlib import Path
import logging

import pandas as pd

try:
    from .database import SessionLocal
    from .models import Investor
except ImportError:
    from database import SessionLocal
    from models import Investor

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "data" / "investor_test_data.csv"
logger = logging.getLogger("uvicorn.error")

column_map = {
    "Entity Name": "entity_name",
    "Description": "description",
    "Investor Type": "investor_type",
    "Investor HQ - Country": "hq_country",
    "Investor Locations - City": "location_city",
    "LinkedIn": "company_linkedin",
    "Website": "website",
    "Name (1)": "contact_1_name",
    "Designation (1)": "contact_1_designation",
    "Email (1)": "contact_1_email",
    "LinkedIn (1)": "contact_1_linkedin",
    "Name (2)": "contact_2_name",
    "Designation (2)": "contact_2_designation",
    "Email (2)": "contact_2_email",
    "LinkedIn (2)": "contact_2_linkedin"
}

def clean_value(value):
    if pd.isna(value):
        return ""
    return str(value).strip()


def infer_focus_industries(description):
    text = (description or "").lower()
    industries = []

    if any(k in text for k in ["fintech", "financial", "payments", "banking", "lending", "wealth", "insurance"]):
        industries.append("fintech")
    if any(k in text for k in ["ai", "artificial intelligence", "machine learning", "data", "llm"]):
        industries.append("ai")
    if any(k in text for k in ["saas", "software", "enterprise", "b2b", "cloud"]):
        industries.append("enterprise saas")
    if any(k in text for k in ["health", "medical", "biotech"]):
        industries.append("healthtech")
    if not industries and any(k in text for k in ["technology", "startup", "venture"]):
        industries.append("sector agnostic")

    return ",".join(industries)


def infer_focus_stages(description):
    text = (description or "").lower()
    stages = []

    if "pre-seed" in text or "preseed" in text:
        stages.append("pre-seed")
    if "seed" in text:
        stages.append("seed")
    if "early stage" in text or "early-stage" in text or "startup" in text:
        stages.extend(["pre-seed", "seed"])
    if "series a" in text:
        stages.append("series a")
    if "growth" in text or "late stage" in text:
        stages.append("growth")

    return ",".join(sorted(set(stages)))


def infer_focus_geographies(country, city):
    country = (country or "").lower()
    city = (city or "").lower()
    geos = []

    if "canada" in country:
        geos.append("canada")
    if city:
        geos.append(city)
    if "united states" in country or "usa" in country:
        geos.append("united states")

    return ",".join(geos)


def load_investor_dataframe():
    preview = pd.read_csv(CSV_PATH, header=None, nrows=10)
    header_row = preview[
        preview.apply(lambda row: row.astype(str).str.strip().eq("Entity Name").any(), axis=1)
    ].index[0]

    df = pd.read_csv(CSV_PATH, header=header_row)
    df = df.dropna(how="all")
    df = df.loc[:, ~df.columns.str.contains("^Unnamed: 0")]
    df.columns = df.columns.str.strip()
    return df.rename(columns=column_map)


def seed_investors(db, replace=False):
    existing_count = db.query(Investor).count()
    if existing_count and not replace:
        logger.info("Investor seed skipped; %s investors already loaded", existing_count)
        return existing_count

    if replace:
        db.query(Investor).delete()

    imported_count = 0
    for _, row in load_investor_dataframe().iterrows():
        if pd.isna(row.get("entity_name")):
            continue

        description = clean_value(row.get("description"))
        investor = Investor(
            entity_name=clean_value(row.get("entity_name")),
            description=description,
            investor_type=clean_value(row.get("investor_type")),
            hq_country=clean_value(row.get("hq_country")),
            location_city=clean_value(row.get("location_city")),
            company_linkedin=clean_value(row.get("company_linkedin")),
            website=clean_value(row.get("website")),
            focus_industries=infer_focus_industries(description),
            focus_stages=infer_focus_stages(description),
            focus_geographies=infer_focus_geographies(
                clean_value(row.get("hq_country")),
                clean_value(row.get("location_city")),
            ),
            contact_1_name=clean_value(row.get("contact_1_name")),
            contact_1_designation=clean_value(row.get("contact_1_designation")),
            contact_1_email=clean_value(row.get("contact_1_email")),
            contact_1_linkedin=clean_value(row.get("contact_1_linkedin")),
            contact_2_name=clean_value(row.get("contact_2_name")),
            contact_2_designation=clean_value(row.get("contact_2_designation")),
            contact_2_email=clean_value(row.get("contact_2_email")),
            contact_2_linkedin=clean_value(row.get("contact_2_linkedin")),
        )
        db.add(investor)
        imported_count += 1

    db.commit()
    logger.info("Investor seed imported %s investors", imported_count)
    return imported_count


def ensure_investors_seeded():
    db = SessionLocal()
    try:
        return seed_investors(db)
    finally:
        db.close()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        count = seed_investors(db, replace=True)
        print(f"Investor data imported successfully: {count} investors.")
    finally:
        db.close()
