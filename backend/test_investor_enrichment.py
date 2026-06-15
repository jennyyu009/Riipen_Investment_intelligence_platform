from types import SimpleNamespace
from unittest.mock import patch

from backend.investor_enrichment import enrich_investor, investor_data


def investor(**overrides):
    defaults = {
        "id": 1,
        "entity_name": "Example Ventures",
        "description": "",
        "investor_type": "",
        "hq_country": "",
        "location_city": "",
        "focus_industries": "",
        "focus_stages": "",
        "focus_geographies": "",
        "company_linkedin": "",
        "website": "https://example.com",
        "twitter_url": "",
        "crunchbase_url": "",
        "region": "",
        "enrichment_status": "",
        "enriched_at": None,
        "contact_1_name": "",
        "contact_1_designation": "",
        "contact_1_email": "",
        "contact_1_linkedin": "",
        "contact_2_name": "",
        "contact_2_designation": "",
        "contact_2_email": "",
        "contact_2_linkedin": "",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_enrichment_extracts_and_preserves_investor_data():
    profile = investor(description="Stored description")
    markdown = """
    Example Ventures is a venture capital fund investing in seed fintech companies in Toronto, Canada.
    Contact us at hello@example.com.
    https://linkedin.com/company/example-ventures
    https://x.com/exampleventures
    https://www.crunchbase.com/organization/example-ventures
    """

    with patch("backend.investor_enrichment.crawl_website", return_value=markdown):
        enrich_investor(profile)

    assert profile.description == "Stored description"
    assert profile.investor_type == "Venture Capital"
    assert profile.contact_1_email == "hello@example.com"
    assert profile.hq_country == "Canada"
    assert profile.location_city == "Toronto"
    assert profile.region == "North America"
    assert profile.twitter_url == "https://x.com/exampleventures"
    assert investor_data(profile)["crunchbase_url"]


def test_completed_enrichment_uses_cache():
    profile = investor(enrichment_status="complete")
    with patch("backend.investor_enrichment.crawl_website") as crawl:
        enrich_investor(profile)
    crawl.assert_not_called()


def test_existing_location_enriches_region_without_a_crawl_source():
    profile = investor(website="", hq_country="Canada", location_city="Toronto")
    with patch("backend.investor_enrichment.crawl_website") as crawl:
        enrich_investor(profile)
    crawl.assert_not_called()
    assert profile.region == "North America"
    assert profile.focus_geographies == "canada,toronto"
    assert profile.enrichment_status == "no_source"
