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
    missing_float_columns = [
        column
        for column in ("stage_score", "team_score")
        if column not in existing_columns
    ]

    if not missing_float_columns:
        return

    with engine.begin() as connection:
        for column in missing_float_columns:
            connection.execute(
                text(f"ALTER TABLE investor_matches ADD COLUMN {column} FLOAT")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
