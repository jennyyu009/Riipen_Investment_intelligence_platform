import re

try:
    from ..website_utils import crawl_website
    from ..embedding_utils import cosine_similarity
except ImportError:
    from website_utils import crawl_website
    from embedding_utils import cosine_similarity

DEFAULT_MATCHING_WEIGHTS = {
    "industry": 35,
    "stage": 30,
    "description": 25,
    "location": 10,
}

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


def calculate_investor_score(startup, investor, founder=None, connections=None, weights=None):
    weights = weights or DEFAULT_MATCHING_WEIGHTS

    investor_description = normalize(getattr(investor, "description", ""))
    investor_website = normalize(getattr(investor, "website", ""))
    investor_country = normalize(getattr(investor, "hq_country", ""))
    investor_city = normalize(getattr(investor, "location_city", ""))
    investor_focus_industries = normalize_list(getattr(investor, "focus_industries", ""))
    investor_focus_stages = [canonical_stage(stage) for stage in normalize_list(getattr(investor, "focus_stages", ""))]
    investor_focus_geographies = normalize_list(getattr(investor, "focus_geographies", ""))

    startup_industry = normalize(getattr(startup, "industry", ""))
    startup_stage = canonical_stage(getattr(startup, "stage", ""))
    startup_description = normalize(getattr(startup, "one_sentence_description", ""))
    startup_website = normalize(getattr(startup, "website_url", ""))
    startup_preference = normalize(getattr(startup, "fundraising_preference", ""))
    founder_location = normalize(getattr(founder, "location", "")) if founder else ""

    startup_website_text = crawl_website(startup_website)
    investor_website_text = crawl_website(investor_website)
    investor_full_text = " ".join([
        investor_description,
        investor_website_text,
        " ".join(investor_focus_industries),
    ]).strip()

    scores = {
        "industry_score": 0,
        "stage_score": 0,
        "description_score": 0,
        "location_score": 0,
    }

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
                return weights["industry"]

        # keyword match from investor text
        if any_text_contains(
            industry_keywords.get(startup_industry, [startup_industry]),
            investor_full_text,
        ):
            return weights["industry"]

        # general fit = full score
        if any_text_contains(general_terms, investor_full_text):
            return weights["industry"]

        return 0

    def stage_match_score():
        if startup_stage and startup_stage in investor_focus_stages:
            return weights["stage"]

        if startup_stage and investor_focus_stages:
            try:
                startup_index = STAGE_ORDER.index(startup_stage)
            except ValueError:
                startup_index = None

            investor_indices = [STAGE_ORDER.index(stage) for stage in investor_focus_stages if stage in STAGE_ORDER]
            if startup_index is not None and investor_indices:
                closest_distance = min(abs(startup_index - idx) for idx in investor_indices)
                if closest_distance == 1:
                    return int(weights["stage"] * 0.8)
                if closest_distance == 2:
                    return int(weights["stage"] * 0.5)

        if any_text_contains(["venture", "startup", "early stage", "growth stage"], investor_full_text):
            return int(weights["stage"] * 0.5)

        return 0

    def description_match_score():
        founder_full_text = " ".join([
            startup_industry,
            startup_stage,
            startup_description,
            startup_website_text,
        ]).strip()

        investor_text = investor_full_text

        similarity = cosine_similarity(
            founder_full_text,
            investor_text,
        )

        if similarity >= 0.80:
            return weights["description"]

        if similarity >= 0.70:
            return int(weights["description"] * 0.85)

        if similarity >= 0.60:
            return int(weights["description"] * 0.70)

        if similarity >= 0.50:
            return int(weights["description"] * 0.50)

        return 0

    def location_match_score():
        normalized_geographies = " ".join(
            investor_focus_geographies
            + [investor_country, investor_city]
        )

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

        # city match
        if founder_location and (
            founder_location == investor_city
            or founder_location in normalized_geographies
            or investor_city in founder_location
        ):
            return weights["location"]

        if founder_in_canada and investor_in_canada:
            return weights["location"]

        if founder_in_usa and investor_in_usa:
            return weights["location"]

        if (
            (founder_in_canada or founder_in_usa)
            and (investor_in_canada or investor_in_usa)
        ):
            return int(weights["location"] * 0.5)

        return 0

    scores["industry_score"] = industry_match_score()
    scores["stage_score"] = stage_match_score()
    scores["description_score"] = description_match_score()
    scores["location_score"] = location_match_score()

    final_score_raw = sum(
        scores[k]
        for k in [
            "industry_score",
            "stage_score",
            "description_score",
            "location_score",
        ]
    )

    provided = {
        "industry": bool(startup_industry),
        "stage": bool(startup_stage),
        "description": bool(startup_description),
        "location": bool(founder_location),
    }

    available_weight = sum(
        weights[key]
        for key, ok in provided.items()
        if ok
    )

    if available_weight <= 0:
        final_score = 0
    else:
        final_score = (
            final_score_raw
            / available_weight
            * 100
        )

    scores["final_score_raw"] = final_score_raw
    scores["final_score"] = max(
        0,
        min(round(final_score), 100)
    )

    return scores
