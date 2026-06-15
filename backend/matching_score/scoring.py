import re

try:
    from ..config import ENABLE_HEAVY_PROCESSING
    from ..website_utils import crawl_website
    from ..embedding_utils import cosine_similarity
    from ..linkedin_utils import (
        crawl_linkedin_profile,
        extract_education,
        extract_employers,
        extract_experience,
        extract_locations,
    )
except ImportError:
    from config import ENABLE_HEAVY_PROCESSING
    from website_utils import crawl_website
    from embedding_utils import cosine_similarity
    from linkedin_utils import (
        crawl_linkedin_profile,
        extract_education,
        extract_employers,
        extract_experience,
        extract_locations,
    )

DEFAULT_MATCHING_WEIGHTS = {
    "industry": 35,
    "stage": 30,
    "fundraising": 25,
    "location": 10,
}

LINKEDIN_MATCHING_WEIGHTS = {
    "industry": 30,
    "stage": 30,
    "fundraising": 25,
    "location": 10,
    "linkedin": 5,
}

GENERIC_FUNDRAISING_TERMS = [
    "automatic",
    "auto",
    "general",
    "flexible",
    "any",
    "open",
    "not specified",
    "no specific description",
    "sector agnostic",
    "stage agnostic",
]

STAGE_SYNONYMS = {
    "pre-seed": ["pre-seed", "preseed", "pre seed", "idea"],
    "seed": ["seed"],
    "series a": ["series a", "seriesa", "a round", "series-a"],
    "growth": ["growth", "late stage", "later stage"],
    "scale": ["scale", "scaling", "scale-up", "scaleup"],
}

industry_keywords = {
    "fintech": ["fintech", "finance", "financial", "payments", "banking", "insurtech", "wealth", "lending"],
    "ai": ["ai", "artificial intelligence", "machine learning", "ml", "llm", "data"],
    "enterprise saas": ["saas", "software", "enterprise", "b2b", "cloud"],
    "healthtech": ["health", "healthcare", "medical", "biotech", "digital health"],
    "climatetech": ["climate", "energy", "sustainability", "carbon"],
    "cybersecurity": ["cybersecurity", "security", "privacy", "risk"],
    "legaltech": ["legal", "law", "compliance"],
    "marketplace": ["marketplace", "platform"],
    "consumer": ["consumer", "brand", "retail"],
}


def normalize(value):
    return (value or "").lower().strip()


def tokenize(text):
    return [tok for tok in re.findall(r"\b[\w\-]+\b", normalize(text)) if len(tok) > 2]


def canonical_stage(stage):
    stage = normalize(stage)
    for canonical, aliases in STAGE_SYNONYMS.items():
        if any(alias in stage for alias in aliases):
            return canonical
    return stage


def normalize_list(value):
    return [item.strip() for item in normalize(value).split(",") if item.strip()]


def any_text_contains(keywords, text):
    text = normalize(text)
    return any(keyword in text for keyword in keywords if keyword)


def contains_term(text, terms):
    text = normalize(text)
    return any(re.search(rf"\b{re.escape(normalize(term))}\b", text) for term in terms)


def text_values_overlap(left_values, right_values):
    for left in left_values:
        left_normalized = normalize(left)
        if len(left_normalized) < 3:
            continue
        for right in right_values:
            right_normalized = normalize(right)
            if len(right_normalized) < 3:
                continue
            if left_normalized in right_normalized or right_normalized in left_normalized:
                return True
    return False


def linkedin_match_summary(founder, investor, investor_focus_industries):
    empty_summary = {
        "alumni": False,
        "alumni_partial": False,
        "industry_experience": False,
        "geography": False,
        "employer": False,
    }
    founder_url = normalize(getattr(founder, "linkedin_url", "")) if founder else ""
    if not founder_url:
        return empty_summary

    founder_profile = crawl_linkedin_profile(founder_url)
    investor_urls = [
        normalize(getattr(investor, "company_linkedin", "")),
        normalize(getattr(investor, "contact_1_linkedin", "")),
        normalize(getattr(investor, "contact_2_linkedin", "")),
    ]
    if ENABLE_HEAVY_PROCESSING:
        investor_profiles = [
            profile
            for profile in (crawl_linkedin_profile(url) for url in investor_urls if url)
            if profile
        ]
    else:
        precomputed_profile = getattr(investor, "linkedin_profile_text", "")
        investor_profiles = [precomputed_profile] if precomputed_profile else []

    # LinkedIn blocks are treated as no match and never affect the base rubric.
    if not founder_profile or not investor_profiles:
        return empty_summary

    founder_education = extract_education(founder_profile)
    investor_education = [
        education
        for profile in investor_profiles
        for education in extract_education(profile)
    ]

    same_university = False
    same_degree = False
    for founder_school in founder_education:
        for investor_school in investor_education:
            if text_values_overlap(
                [founder_school.get("university", "")],
                [investor_school.get("university", "")],
            ):
                same_university = True
                if text_values_overlap(
                    [founder_school.get("degree", "")],
                    [investor_school.get("degree", "")],
                ):
                    same_degree = True

    founder_experience = extract_experience(founder_profile)
    focus_terms = []
    for focus in investor_focus_industries:
        focus_terms.extend(industry_keywords.get(focus, [focus]))

    founder_locations = extract_locations(founder_profile)
    investor_locations = [
        location
        for profile in investor_profiles
        for location in extract_locations(profile)
    ]
    founder_employers = extract_employers(founder_profile)
    investor_employers = [
        employer
        for profile in investor_profiles
        for employer in extract_employers(profile)
    ]

    return {
        "alumni": same_university and same_degree,
        "alumni_partial": same_university and not same_degree,
        "industry_experience": any_text_contains(focus_terms, " ".join(founder_experience)),
        "geography": text_values_overlap(founder_locations, investor_locations),
        "employer": text_values_overlap(founder_employers, investor_employers),
    }


def calculate_investor_score(startup, investor, founder=None, connections=None, weights=None):
    investor_description = normalize(getattr(investor, "description", ""))
    investor_website = normalize(getattr(investor, "website", ""))
    investor_country = normalize(getattr(investor, "hq_country", ""))
    investor_city = normalize(getattr(investor, "location_city", ""))
    investor_focus_industries = normalize_list(getattr(investor, "focus_industries", ""))
    investor_focus_stages = [canonical_stage(stage) for stage in normalize_list(getattr(investor, "focus_stages", ""))]
    investor_focus_geographies = normalize_list(getattr(investor, "focus_geographies", ""))

    startup_industry = normalize(getattr(startup, "industry", ""))
    startup_stage = canonical_stage(getattr(startup, "stage", ""))
    startup_preference = normalize(getattr(startup, "fundraising_preference", ""))
    founder_location = normalize(getattr(founder, "location", "")) if founder else ""

    investor_website_text = crawl_website(investor_website) if ENABLE_HEAVY_PROCESSING else ""
    investor_full_text = " ".join([
        investor_description,
        investor_website_text,
        " ".join(investor_focus_industries),
    ]).strip()

    STAGE_ORDER = ["pre-seed", "seed", "series a", "growth", "scale"]

    def industry_match_score():
        general_terms = [
            "sector agnostic",
            "technology",
            "software",
            "startup",
            "venture",
            "b2b software",
            "innovation",
            "early-stage tech",
        ]

        if not startup_industry:
            return 0

        # exact / containment match
        for inv_focus in investor_focus_industries:
            if (
                startup_industry == inv_focus
                or startup_industry in inv_focus
                or inv_focus in startup_industry
            ):
                return 100

        # keyword match from investor text
        if any_text_contains(
            industry_keywords.get(startup_industry, [startup_industry]),
            investor_full_text,
        ):
            return 100

        # general fit = full score
        if any_text_contains(general_terms, investor_full_text):
            return 100

        return 0

    def stage_match_score():
        if startup_stage and startup_stage in investor_focus_stages:
            return 100

        if startup_stage and investor_focus_stages:
            try:
                startup_index = STAGE_ORDER.index(startup_stage)
            except ValueError:
                startup_index = None

            investor_indices = [STAGE_ORDER.index(stage) for stage in investor_focus_stages if stage in STAGE_ORDER]
            if startup_index is not None and investor_indices:
                closest_distance = min(abs(startup_index - idx) for idx in investor_indices)
                if closest_distance == 1:
                    return 80
                if closest_distance == 2:
                    return 50

        if any_text_contains(["venture", "startup", "early stage", "growth stage"], investor_full_text):
            return 50

        return 0

    def fundraising_match_score():
        if contains_term(startup_preference, GENERIC_FUNDRAISING_TERMS) or contains_term(
            investor_description,
            GENERIC_FUNDRAISING_TERMS,
        ):
            return 100

        similarity = cosine_similarity(
            startup_preference,
            investor_full_text,
        )

        if similarity >= 0.80:
            return 100

        if similarity >= 0.70:
            return 85

        if similarity >= 0.60:
            return 70

        if similarity >= 0.50:
            return 50

        return 0

    def location_match_score():
        investor_geographies = investor_focus_geographies + [investor_country, investor_city]
        normalized_geographies = " ".join(investor_geographies)
        founder_location_parts = normalize_list(founder_location)

        # Full score for explicit city/country matches in either the investor HQ or focus locations.
        if founder_location and any(
            text_values_overlap(founder_location_parts or [founder_location], [geography])
            for geography in investor_geographies
            if geography
        ):
            return 100

        canada_terms = [
            "canada",
            "toronto",
            "vancouver",
            "montreal",
            "calgary",
            "ottawa",
        ]

        usa_terms = [
            "united states",
            "usa",
            "new york",
            "san francisco",
            "boston",
            "seattle",
            "los angeles",
        ]

        founder_in_canada = any_text_contains(
            canada_terms,
            founder_location,
        )

        investor_in_canada = any_text_contains(
            canada_terms,
            normalized_geographies,
        )

        founder_in_usa = any_text_contains(
            usa_terms,
            founder_location,
        )

        investor_in_usa = any_text_contains(
            usa_terms,
            normalized_geographies,
        )

        if founder_in_canada and investor_in_canada:
            return 100

        if founder_in_usa and investor_in_usa:
            return 100

        return 0

    linkedin_summary = linkedin_match_summary(founder, investor, investor_focus_industries)
    linkedin_matched_count = sum(
        1
        for condition in ("alumni", "industry_experience", "geography", "employer")
        if linkedin_summary[condition] or (condition == "alumni" and linkedin_summary["alumni_partial"])
    )
    active_weights = weights or (
        LINKEDIN_MATCHING_WEIGHTS if linkedin_matched_count else DEFAULT_MATCHING_WEIGHTS
    )
    raw_scores = {
        "industry": industry_match_score(),
        "stage": stage_match_score(),
        "fundraising": fundraising_match_score(),
        "location": location_match_score(),
    }
    scores = {
        "industry_score": raw_scores["industry"],
        "stage_score": raw_scores["stage"],
        "fundraising_score": raw_scores["fundraising"],
        "location_score": raw_scores["location"],
        "linkedin_matched_count": linkedin_matched_count,
        "linkedin_score": linkedin_matched_count * 25 if linkedin_matched_count else None,
        "linkedin_contribution": linkedin_matched_count * 1.25,
        "linkedin_matches": linkedin_summary,
        "rubric": "linkedin_enabled" if linkedin_matched_count else "original",
    }
    weighted_contributions = {
        key: raw_scores[key] / 100 * active_weights[key]
        for key in raw_scores
    }
    if linkedin_matched_count:
        weighted_contributions["linkedin"] = linkedin_matched_count * 1.25

    provided = {
        "industry": bool(startup_industry),
        "stage": bool(startup_stage),
        "fundraising": bool(startup_preference),
        "location": bool(founder_location),
    }
    final_score_raw = sum(
        contribution
        for key, contribution in weighted_contributions.items()
        if key == "linkedin" or provided.get(key)
    )
    original_score_raw = sum(
        raw_scores[key] / 100 * DEFAULT_MATCHING_WEIGHTS[key]
        for key, is_provided in provided.items()
        if is_provided
    )
    linkedin_floor_applied = bool(
        linkedin_matched_count and final_score_raw < original_score_raw
    )
    if linkedin_floor_applied:
        final_score_raw = original_score_raw

    scores["weighted_contributions"] = weighted_contributions
    scores["original_rubric_score"] = round(original_score_raw, 2)
    scores["linkedin_floor_applied"] = linkedin_floor_applied
    scores["final_score_raw"] = round(final_score_raw, 2)
    scores["final_score"] = max(0, min(round(final_score_raw), 100))

    return scores
