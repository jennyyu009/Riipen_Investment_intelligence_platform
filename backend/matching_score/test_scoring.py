from types import SimpleNamespace
from unittest.mock import patch

from backend.matching_score.scoring import calculate_investor_score, linkedin_match_summary


def startup(**overrides):
    values = {
        "industry": "fintech",
        "stage": "seed",
        "fundraising_preference": "seed fintech investor",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def investor(**overrides):
    values = {
        "description": "seed fintech investor",
        "website": "",
        "hq_country": "Germany",
        "location_city": "Berlin",
        "focus_industries": "fintech",
        "focus_stages": "seed",
        "focus_geographies": "Germany,Berlin",
        "company_linkedin": "",
        "contact_1_linkedin": "",
        "contact_2_linkedin": "",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def founder(**overrides):
    values = {"location": "Munich, Germany", "linkedin_url": ""}
    values.update(overrides)
    return SimpleNamespace(**values)


def test_generic_fundraising_bypasses_similarity():
    with patch("backend.matching_score.scoring.cosine_similarity", side_effect=AssertionError):
        result = calculate_investor_score(
            startup(fundraising_preference="Open to any investor"),
            investor(),
            founder=founder(),
        )

    assert result["fundraising_score"] == 100


def test_country_match_gets_full_geography_fit():
    result = calculate_investor_score(startup(), investor(), founder=founder())
    assert result["location_score"] == 100


def test_clearly_unrelated_geography_gets_zero_fit():
    result = calculate_investor_score(
        startup(),
        investor(hq_country="United States", location_city="New York", focus_geographies="United States,New York"),
        founder=founder(),
    )
    assert result["location_score"] == 0


def test_zero_linkedin_matches_uses_original_rubric():
    result = calculate_investor_score(startup(), investor(), founder=founder())
    assert result["rubric"] == "original"
    assert result["linkedin_score"] is None
    assert result["weighted_contributions"]["industry"] == 35


def test_linkedin_match_uses_enabled_rubric_and_contribution():
    summary = {
        "alumni": True,
        "alumni_partial": False,
        "industry_experience": False,
        "geography": False,
        "employer": False,
    }
    with patch("backend.matching_score.scoring.linkedin_match_summary", return_value=summary):
        result = calculate_investor_score(startup(), investor(), founder=founder())

    assert result["rubric"] == "linkedin_enabled"
    assert result["linkedin_matched_count"] == 1
    assert result["linkedin_score"] == 25
    assert result["linkedin_contribution"] == 1.25
    assert result["weighted_contributions"]["industry"] == 30
    assert result["final_score"] >= result["original_rubric_score"]


def test_linkedin_profile_conditions():
    founder_profile = """
    ## Experience
    Northstar Bank
    Toronto, Canada
    Fintech product leader
    ## Education
    University of Toronto
    Bachelor of Commerce
    """
    investor_profile = """
    ## Experience
    Northstar Bank
    Vancouver, Canada
    ## Education
    University of Toronto
    Bachelor of Commerce
    """
    profiles = {
        "https://linkedin.com/in/founder": founder_profile,
        "https://linkedin.com/in/investor": investor_profile,
    }
    with patch(
        "backend.matching_score.scoring.crawl_linkedin_profile",
        side_effect=lambda url: profiles.get(url, ""),
    ):
        result = linkedin_match_summary(
            founder(linkedin_url="https://linkedin.com/in/founder"),
            investor(contact_1_linkedin="https://linkedin.com/in/investor"),
            ["fintech"],
        )

    assert result == {
        "alumni": True,
        "alumni_partial": False,
        "industry_experience": True,
        "geography": True,
        "employer": True,
    }


def test_linkedin_crawl_failure_returns_no_match():
    with patch("backend.matching_score.scoring.crawl_linkedin_profile", return_value=""):
        result = linkedin_match_summary(
            founder(linkedin_url="https://linkedin.com/in/founder"),
            investor(contact_1_linkedin="https://linkedin.com/in/investor"),
            ["fintech"],
        )

    assert not any(result.values())
