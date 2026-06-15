import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'latte_backend.db'}")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def ensure_database_schema():
    """Apply small compatibility migrations for databases created before migrations existed."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    required_by_table = {
        "investor_matches": {
            "stage_score": "FLOAT",
            "team_score": "FLOAT",
            "fundraising_score": "FLOAT",
            "linkedin_score": "FLOAT",
            "linkedin_matched_count": "INTEGER",
            "linkedin_contribution": "FLOAT",
            "linkedin_matches": "TEXT",
        },
        "investors": {
            "twitter_url": "TEXT",
            "crunchbase_url": "TEXT",
            "region": "VARCHAR",
            "enrichment_status": "VARCHAR",
            "enriched_at": "TIMESTAMP",
            "linkedin_profile_text": "TEXT",
            "top_industry_match": "VARCHAR",
            "top_stage_match": "VARCHAR",
            "top_country_match": "VARCHAR",
            "top_3_industries": "TEXT",
            "top_3_stages": "TEXT",
            "top_3_countries": "TEXT",
            "portfolio_companies": "TEXT",
        },
    }

    with engine.begin() as connection:
        for table, required_columns in required_by_table.items():
            if table not in tables:
                continue
            existing_columns = {
                column["name"]
                for column in inspector.get_columns(table)
            }
            for column, sql_type in required_columns.items():
                if column not in existing_columns:
                    connection.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}")
                    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
