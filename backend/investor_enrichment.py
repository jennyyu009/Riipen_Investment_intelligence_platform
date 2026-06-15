import re
from datetime import datetime, timezone
from urllib.parse import urlparse

try:
    from .embedding_utils import cosine_similarity
    from .seed_investors import (
        infer_focus_geographies,
        infer_focus_industries,
        infer_focus_stages,
    )
    from .website_utils import crawl_website
except ImportError:
    from embedding_utils import cosine_similarity
    from seed_investors import (
        infer_focus_geographies,
        infer_focus_industries,
        infer_focus_stages,
    )
    from website_utils import crawl_website


URL_PATTERN = re.compile(r"https?://[^\s)\]}>\"']+", re.IGNORECASE)
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
SOCIAL_DOMAINS = {
    "linkedin": ("linkedin.com/",),
    "twitter": ("twitter.com/", "x.com/"),
    "crunchbase": ("crunchbase.com/",),
}
COUNTRIES = [
    "Canada", "United States", "United Kingdom", "France", "Germany", "Spain",
    "Italy", "Netherlands", "Sweden", "Norway", "Denmark", "Finland",
    "Australia", "Singapore", "Japan", "India", "Israel", "Brazil",
    "Mexico", "South Africa", "Nigeria", "Kenya", "United Arab Emirates",
]
CITY_COUNTRY = {
    "Toronto": "Canada", "Vancouver": "Canada", "Montreal": "Canada",
    "Waterloo": "Canada", "Ottawa": "Canada", "Calgary": "Canada",
    "New York": "United States", "San Francisco": "United States",
    "Boston": "United States", "Austin": "United States", "Seattle": "United States",
    "London": "United Kingdom", "Paris": "France", "Berlin": "Germany",
    "Amsterdam": "Netherlands", "Stockholm": "Sweden", "Sydney": "Australia",
    "Melbourne": "Australia", "Singapore": "Singapore", "Tel Aviv": "Israel",
}
INDUSTRY_TAXONOMY = {
    "fintech": "financial technology payments banking lending insurance wealth management",
    "enterprise saas": "business software enterprise cloud software as a service",
    "ai": "artificial intelligence machine learning data infrastructure",
    "healthtech": "healthcare medical biotechnology digital health",
    "climatetech": "climate energy sustainability clean technology",
    "consumer": "consumer products commerce marketplaces media",
}


def clean_url(url):
    return (url or "").rstrip(".,;:")


def first_matching_url(text, domains):
    for raw_url in URL_PATTERN.findall(text or ""):
        url = clean_url(raw_url)
        if any(domain in url.lower() for domain in domains):
            return url
    return ""


def useful_email(text, website):
    website_host = urlparse(website or "").netloc.lower().removeprefix("www.")
    candidates = [
        email
        for email in EMAIL_PATTERN.findall(text or "")
        if not email.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg"))
    ]
    if website_host:
        same_domain = [email for email in candidates if email.lower().endswith(f"@{website_host}")]
        if same_domain:
            return same_domain[0]
    return candidates[0] if candidates else ""


def useful_description(text, entity_name):
    candidate_lines = [
        re.sub(r"\s+", " ", line).strip(" #*-\t")
        for line in (text or "").splitlines()
    ]
    candidate_lines = [
        line for line in candidate_lines
        if 50 <= len(line) <= 420
        and not line.lower().startswith(("http", "copyright", "cookie"))
    ]
    lines = [line for line in candidate_lines if entity_name.lower() in line.lower()]
    if lines:
        return lines[0]
    descriptive_lines = [
        line for line in candidate_lines
        if any(term in line.lower() for term in ("invest", "venture", "capital", "fund", "partner"))
    ]
    return descriptive_lines[0] if descriptive_lines else ""


def mentioned_values(text, values, limit=3):
    normalized = (text or "").lower()
    return [value for value in values if value.lower() in normalized][:limit]


def infer_investor_type(text):
    normalized = (text or "").lower()
    types = [
        ("Venture Capital", ["venture capital", "vc firm", "venture fund"]),
        ("Angel Group", ["angel group", "angel network", "angel investor"]),
        ("Corporate Venture Capital", ["corporate venture", "strategic investment"]),
        ("Accelerator", ["accelerator", "startup program"]),
        ("Family Office", ["family office"]),
        ("Government Office", ["government fund", "government agency"]),
    ]
    for investor_type, terms in types:
        if any(term in normalized for term in terms):
            return investor_type
    return ""


def infer_semantic_industries(text):
    source = (text or "")[:6000]
    if not source:
        return ""
    scores = [
        (label, cosine_similarity(source, description))
        for label, description in INDUSTRY_TAXONOMY.items()
    ]
    matches = [label for label, score in sorted(scores, key=lambda item: item[1], reverse=True) if score >= 0.45]
    return ",".join(matches[:3])


def infer_region(country, city, text):
    location_text = " ".join([country or "", city or "", text[:3000] if text else ""]).lower()
    regions = [
        ("North America", ["canada", "united states", "usa", "mexico"]),
        ("Europe", ["united kingdom", "france", "germany", "spain", "italy", "netherlands", "europe"]),
        ("Asia Pacific", ["australia", "singapore", "japan", "india", "asia pacific", "apac"]),
        ("Middle East", ["united arab emirates", "israel", "saudi arabia", "middle east"]),
        ("Latin America", ["brazil", "argentina", "chile", "latin america"]),
        ("Africa", ["south africa", "nigeria", "kenya", "africa"]),
    ]
    for region, terms in regions:
        if any(term in location_text for term in terms):
            return region
    return ""


def enrich_investor(investor, force=False):
    if investor.enrichment_status == "complete" and not force:
        return investor

    stored_text = investor.description or ""
    investor.investor_type = investor.investor_type or infer_investor_type(stored_text)
    investor.focus_industries = investor.focus_industries or infer_focus_industries(stored_text) or infer_semantic_industries(stored_text)
    investor.focus_stages = investor.focus_stages or infer_focus_stages(stored_text)
    investor.focus_geographies = investor.focus_geographies or infer_focus_geographies(
        investor.hq_country, investor.location_city,
    )
    investor.region = investor.region or infer_region(investor.hq_country, investor.location_city, stored_text)

    source_url = investor.website or investor.company_linkedin or investor.contact_1_linkedin
    if not source_url:
        investor.enrichment_status = "no_source"
        investor.enriched_at = datetime.now(timezone.utc)
        return investor

    text = crawl_website(source_url)
    if not text:
        investor.enrichment_status = "crawl_failed"
        investor.enriched_at = datetime.now(timezone.utc)
        return investor

    investor.description = investor.description or useful_description(text, investor.entity_name or "")
    investor.investor_type = investor.investor_type or infer_investor_type(text)
    investor.focus_industries = investor.focus_industries or infer_focus_industries(text) or infer_semantic_industries(text)
    investor.focus_stages = investor.focus_stages or infer_focus_stages(text)
    mentioned_countries = mentioned_values(text, COUNTRIES)
    mentioned_cities = mentioned_values(text, CITY_COUNTRY.keys())
    investor.location_city = investor.location_city or (mentioned_cities[0] if mentioned_cities else "")
    investor.hq_country = investor.hq_country or (
        CITY_COUNTRY.get(investor.location_city)
        or (mentioned_countries[0] if mentioned_countries else "")
    )
    investor.focus_geographies = investor.focus_geographies or ",".join(mentioned_countries) or infer_focus_geographies(
        investor.hq_country, investor.location_city,
    )
    investor.contact_1_email = investor.contact_1_email or useful_email(text, investor.website)
    investor.company_linkedin = investor.company_linkedin or first_matching_url(text, SOCIAL_DOMAINS["linkedin"])
    investor.twitter_url = investor.twitter_url or first_matching_url(text, SOCIAL_DOMAINS["twitter"])
    investor.crunchbase_url = investor.crunchbase_url or first_matching_url(text, SOCIAL_DOMAINS["crunchbase"])
    investor.region = investor.region or infer_region(investor.hq_country, investor.location_city, text)
    linkedin_urls = [
        investor.company_linkedin,
        investor.contact_1_linkedin,
        investor.contact_2_linkedin,
    ]
    linkedin_profiles = [
        crawl_website(url)
        for url in linkedin_urls
        if url
    ]
    investor.linkedin_profile_text = getattr(investor, "linkedin_profile_text", "") or "\n\n".join(
        profile for profile in linkedin_profiles if profile
    )
    investor.enrichment_status = "complete"
    investor.enriched_at = datetime.now(timezone.utc)
    return investor


def investor_data(investor):
    return {
        "investor_id": investor.id,
        "entity_name": investor.entity_name,
        "description": investor.description,
        "investor_type": investor.investor_type,
        "hq_country": investor.hq_country,
        "location_city": investor.location_city,
        "region": investor.region,
        "focus_industries": investor.focus_industries,
        "focus_stages": investor.focus_stages,
        "focus_geographies": investor.focus_geographies,
        "website": investor.website,
        "company_linkedin": investor.company_linkedin,
        "twitter_url": investor.twitter_url,
        "crunchbase_url": investor.crunchbase_url,
        "contact_1_name": investor.contact_1_name,
        "contact_1_designation": investor.contact_1_designation,
        "contact_1_email": investor.contact_1_email,
        "contact_1_linkedin": investor.contact_1_linkedin,
        "contact_2_name": investor.contact_2_name,
        "contact_2_designation": investor.contact_2_designation,
        "contact_2_email": investor.contact_2_email,
        "contact_2_linkedin": investor.contact_2_linkedin,
        "enrichment_status": investor.enrichment_status,
        "linkedin_profile_text": getattr(investor, "linkedin_profile_text", ""),
    }
