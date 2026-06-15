from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.enriched_data import sync_enriched_investors
from backend.investor_enrichment import investor_data
from backend.json_fields import from_json_text, parse_list_field, to_json_text
from backend.models import Base, Investor


def test_json_text_helpers_handle_lists_and_csv_strings():
    assert to_json_text(["General Technology"]) == '["General Technology"]'
    assert from_json_text('["Seed"]') == ["Seed"]
    assert parse_list_field("General Technology, SaaS, FinTech") == [
        "General Technology",
        "SaaS",
        "FinTech",
    ]


def test_enriched_sync_serializes_lists_before_sqlite_insert():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        count = sync_enriched_investors(db)
        assert count > 0
        investor = db.query(Investor).first()
        assert isinstance(investor.top_3_industries, str)
        assert isinstance(investor.top_3_stages, str)
        assert isinstance(investor.top_3_countries, str)
        assert isinstance(investor.portfolio_companies, str)
        payload = investor_data(investor)
        assert isinstance(payload["top_3_industries"], list)
        assert isinstance(payload["top_3_stages"], list)
        assert isinstance(payload["top_3_countries"], list)
        assert isinstance(payload["portfolio_companies"], list)
    finally:
        db.close()
