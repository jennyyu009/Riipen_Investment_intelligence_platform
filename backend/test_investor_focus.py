from types import SimpleNamespace
from unittest.mock import patch

from backend.investor_focus import (
    analyze_investor_focus,
    discover_portfolio_urls,
    extract_portfolio_companies,
    enrich_focus_from_website,
)


def test_portfolio_link_discovery_uses_homepage_links_and_known_paths():
    links = '<a href="/companies">Companies</a><a href="/about">About</a>'
    urls = discover_portfolio_urls("https://fund.example", links)

    assert urls[0] == "https://fund.example/companies"
    assert "https://fund.example/portfolio" in urls
    assert "https://fund.example/investments" in urls


def test_portfolio_company_extraction_and_weighted_focus():
    portfolio_text = """
    Wealthsimple
    Canadian fintech platform for wealth, banking and payments.
    MedCloud
    Cloud software for clinical teams.
    """
    companies = extract_portfolio_companies(portfolio_text)
    result = analyze_investor_focus(
        {
            "description": "growth-stage venture investing across North America",
            "investor_type": "VC",
            "hq_country": "Canada",
            "location_city": "Toronto",
        },
        homepage_text="We invest in enterprise workflow and SaaS companies.",
        portfolio_text=portfolio_text,
        portfolio_companies=companies,
    )

    assert companies
    assert result["top_industry_match"] in {"FinTech", "SaaS", "Enterprise Software"}
    assert result["top_stage_match"] == "Growth"
    assert result["top_country_match"] == "Canada"
    assert result["top_3_industries"]
    assert result["top_3_stages"]
    assert result["top_3_countries"]


def test_global_country_fallback_when_no_country_signal_exists():
    result = analyze_investor_focus({"description": "", "investor_type": "", "hq_country": "", "location_city": ""})
    assert result["top_country_match"] == "Global"
    assert result["top_3_countries"] == ["Global"]


def test_enrich_focus_crawls_portfolio_page_when_found():
    investor = SimpleNamespace(
        website="https://fund.example",
        description="seed venture fund",
        investor_type="VC",
        hq_country="Canada",
        location_city="Toronto",
        focus_industries="",
        focus_stages="",
        focus_geographies="",
    )

    def fake_crawl(url):
        if url == "https://fund.example":
            return '<a href="/portfolio">Portfolio</a>'
        if url == "https://fund.example/portfolio":
            return "Wealthsimple\nCanadian fintech platform for wealth management."
        return ""

    with patch("backend.investor_focus.crawl_website", side_effect=fake_crawl):
        result = enrich_focus_from_website(investor)

    assert result["portfolio_companies"]
    assert result["top_industry_match"] == "FinTech"
