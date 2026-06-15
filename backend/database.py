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
    if "investor_matches" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("investor_matches")
    }
    required_columns = {
        "stage_score": "FLOAT",
        "team_score": "FLOAT",
        "fundraising_score": "FLOAT",
        "linkedin_score": "FLOAT",
        "linkedin_matched_count": "INTEGER",
        "linkedin_contribution": "FLOAT",
        "linkedin_matches": "TEXT",
    }
    missing_columns = {
        column: sql_type
        for column, sql_type in required_columns.items()
        if column not in existing_columns
    }

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column, sql_type in missing_columns.items():
            connection.execute(
                text(f"ALTER TABLE investor_matches ADD COLUMN {column} {sql_type}")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
