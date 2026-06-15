import re
from collections import defaultdict
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

try:
    from .website_utils import crawl_website
except ImportError:
    from website_utils import crawl_website


PORTFOLIO_PATHS = (
    "/portfolio",
    "/companies",
    "/investments",
    "/our-companies",
    "/case-studies",
    "/founders",
    "/backed-companies",
)
PORTFOLIO_LINK_TERMS = (
    "portfolio",
    "companies",
    "investments",
    "our companies",
    "case studies",
    "founders",
    "backed companies",
)

INDUSTRY_KEYWORDS = {
    "AI / Machine Learning": ("ai", "artificial intelligence", "machine learning", " llm", "agent", "automation", "data science"),
    "FinTech": ("financial", "banking", "payments", "insurance", "wealth", "lending", "fintech", "credit", "bank"),
    "HealthTech": ("health", "medical", "clinical", "patient", "hospital", "healthcare", "digital health"),
    "Enterprise Software": ("enterprise", "workflow", "productivity", "b2b software", "business software"),
    "SaaS": ("saas", "cloud software", "subscription software", "software as a service"),
    "Cybersecurity": ("cybersecurity", "security", "privacy", "threat", "risk management"),
    "ClimateTech": ("climate", "carbon", "sustainability", "clean energy", "cleantech", "renewable"),
    "Consumer": ("consumer", "retail", "brand", "lifestyle", "mobile app"),
    "Marketplace": ("marketplace", "platform connecting", "network of buyers", "network of sellers"),
    "E-commerce": ("e-commerce", "ecommerce", "commerce", "online store", "shopify"),
    "Real Estate / PropTech": ("real estate", "proptech", "property", "mortgage", "housing"),
    "DeepTech": ("deeptech", "deep tech", "quantum", "robotics", "advanced technology"),
    "Hardware": ("hardware", "device", "semiconductor", "sensor", "iot"),
    "Biotech": ("biotech", "biology", "therapeutics", "pharma", "genomics"),
    "Education": ("education", "edtech", "learning", "school", "student"),
    "Future of Work": ("future of work", "hr", "human resources", "recruiting", "talent"),
    "Supply Chain / Logistics": ("supply chain", "logistics", "shipping", "freight", "warehouse"),
    "Media / Entertainment": ("media", "entertainment", "gaming", "music", "creator"),
    "Web3 / Blockchain": ("web3", "blockchain", "crypto", "defi", "token"),
    "General Technology": ("technology", "software", "startup", "digital", "innovation", "venture"),
}
STAGE_KEYWORDS = {
    "Pre-Seed": ("pre-seed", "preseed", "pre seed"),
    "Seed": ("seed",),
    "Series A": ("series a", "series-a", "a round"),
    "Series B": ("series b", "series-b", "b round"),
    "Growth": ("growth-stage", "growth stage", "growth equity", "growth"),
    "Late Stage": ("late-stage", "late stage", "later stage", "mid-later", "mid later"),
    "Buyout": ("buyout", "private equity", "control investment"),
    "Debt": ("venture debt", "credit", "debt"),
    "General / Multi-stage": ("multi-stage", "multistage", "all stages", "stage agnostic"),
}
COUNTRY_KEYWORDS = {
    "Canada": ("canada", "toronto", "vancouver", "montreal", "waterloo", "ottawa", "calgary"),
    "United States": ("united states", "usa", "u.s.", "san francisco", "new york", "boston", "seattle", "austin"),
    "United Kingdom": ("united kingdom", "uk", "london"),
    "France": ("france", "paris"),
    "Germany": ("germany", "berlin"),
    "Netherlands": ("netherlands", "amsterdam"),
    "Australia": ("australia", "sydney", "melbourne"),
    "Singapore": ("singapore",),
    "Israel": ("israel", "tel aviv"),
    "India": ("india", "bengaluru", "bangalore"),
    "North America": ("north america", "north american"),
    "Europe": ("europe", "european"),
    "Asia Pacific": ("asia pacific", "apac"),
}


def _clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _contains(text, keywords):
    normalized = f" {str(text or '').lower()} "
    return any(keyword in normalized for keyword in keywords)


def _score_keywords(text, taxonomy, weight, scores):
    if not text:
        return
    matched_specific = [
        label for label, keywords in taxonomy.items()
        if label != "General Technology" and _contains(text, keywords)
    ]
    for label, keywords in taxonomy.items():
        if _contains(text, keywords):
            if label == "General Technology" and matched_specific:
                continue
            scores[label] += weight


class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        attrs = dict(attrs)
        self._href = attrs.get("href")
        self._text = []

    def handle_data(self, data):
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href:
            self.links.append((self._href, _clean(" ".join(self._text))))
            self._href = None
            self._text = []


def discover_portfolio_urls(website, homepage_text=""):
    if not website:
        return []
    parsed = urlparse(website)
    base = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else website.rstrip("/")
    candidates = []
    extractor = LinkExtractor()
    try:
        extractor.feed(homepage_text or "")
    except Exception:
        pass

    for href, text in extractor.links:
        combined = f"{href} {text}".lower()
        if any(term in combined for term in PORTFOLIO_LINK_TERMS):
            candidates.append(urljoin(base, href))

    for match in re.findall(r"\[([^\]]+)\]\(([^)]+)\)", homepage_text or ""):
        text, href = match
        combined = f"{href} {text}".lower()
        if any(term in combined for term in PORTFOLIO_LINK_TERMS):
            candidates.append(urljoin(base, href))

    lower_homepage = (homepage_text or "").lower()
    for path in PORTFOLIO_PATHS:
        if path.strip("/") in lower_homepage:
            candidates.append(urljoin(base, path))
        candidates.append(urljoin(base, path))

    deduped = []
    for url in candidates:
        if url not in deduped:
            deduped.append(url)
    return deduped


def extract_portfolio_companies(portfolio_text):
    lines = [_clean(line.strip(" -*#|")) for line in (portfolio_text or "").splitlines()]
    lines = [line for line in lines if 3 <= len(line) <= 280]
    companies = []
    seen = set()
    for index, line in enumerate(lines):
        if line.lower() in seen:
            continue
        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        looks_like_name = (
            len(line.split()) <= 5
            and re.search(r"[A-Z]", line)
            and not line.endswith((".", ":", ";"))
            and not _contains(line, ("portfolio", "companies", "investments", "contact", "about"))
        )
        descriptive_text = " ".join([line, next_line])
        has_classifiable_context = any(_contains(descriptive_text, keywords) for keywords in INDUSTRY_KEYWORDS.values())
        if looks_like_name and has_classifiable_context:
            country = next((country for country, keywords in COUNTRY_KEYWORDS.items() if _contains(descriptive_text, keywords)), "")
            tags = [
                industry
                for industry, keywords in INDUSTRY_KEYWORDS.items()
                if _contains(descriptive_text, keywords)
            ][:4]
            companies.append({
                "company_name": line,
                "description": next_line if next_line != line else "",
                "company_url": "",
                "company_country": country,
                "company_tags": tags,
            })
            seen.add(line.lower())
    return companies[:200]


def _rank(scores, limit=3):
    return [
        label
        for label, score in sorted(scores.items(), key=lambda item: (-item[1], item[0]))
        if score > 0
    ][:limit]


def _normalize_list(value):
    if isinstance(value, list):
        return [_clean(item) for item in value if _clean(item)]
    return [_clean(item) for item in re.split(r"[,;|]", str(value or "")) if _clean(item)]


def analyze_investor_focus(investor, homepage_text="", portfolio_text="", portfolio_companies=None):
    portfolio_companies = portfolio_companies or []
    industry_scores = defaultdict(int)
    stage_scores = defaultdict(int)
    country_scores = defaultdict(int)

    description = _clean(investor.get("description") if isinstance(investor, dict) else getattr(investor, "description", ""))
    investor_type = _clean(investor.get("investor_type") if isinstance(investor, dict) else getattr(investor, "investor_type", ""))
    hq_country = _clean(investor.get("hq_country") if isinstance(investor, dict) else getattr(investor, "hq_country", ""))
    city = _clean(investor.get("location_city") if isinstance(investor, dict) else getattr(investor, "location_city", ""))
    focus_industries = _normalize_list(investor.get("focus_industries") if isinstance(investor, dict) else getattr(investor, "focus_industries", ""))
    focus_stages = _normalize_list(investor.get("focus_stages") if isinstance(investor, dict) else getattr(investor, "focus_stages", ""))
    focus_geographies = _normalize_list(investor.get("focus_geographies") if isinstance(investor, dict) else getattr(investor, "focus_geographies", ""))

    for company in portfolio_companies:
        company_text = " ".join([
            company.get("company_name", ""),
            company.get("description", ""),
            company.get("company_country", ""),
            " ".join(company.get("company_tags", []) or []),
        ])
        _score_keywords(company_text, INDUSTRY_KEYWORDS, 3, industry_scores)
        _score_keywords(company_text, STAGE_KEYWORDS, 2, stage_scores)
        _score_keywords(company_text, COUNTRY_KEYWORDS, 2, country_scores)
        for tag in company.get("company_tags", []) or []:
            _score_keywords(tag, INDUSTRY_KEYWORDS, 4, industry_scores)

    _score_keywords(homepage_text, INDUSTRY_KEYWORDS, 2, industry_scores)
    _score_keywords(description, INDUSTRY_KEYWORDS, 2, industry_scores)
    _score_keywords(investor_type, INDUSTRY_KEYWORDS, 1, industry_scores)
    for focus in focus_industries:
        _score_keywords(focus, INDUSTRY_KEYWORDS, 2, industry_scores)

    _score_keywords(portfolio_text, STAGE_KEYWORDS, 5, stage_scores)
    _score_keywords(homepage_text, STAGE_KEYWORDS, 5, stage_scores)
    _score_keywords(description, STAGE_KEYWORDS, 4, stage_scores)
    _score_keywords(portfolio_text, STAGE_KEYWORDS, 2, stage_scores)
    _score_keywords(investor_type, STAGE_KEYWORDS, 1, stage_scores)
    for focus in focus_stages:
        _score_keywords(focus, STAGE_KEYWORDS, 4, stage_scores)

    _score_keywords(homepage_text, COUNTRY_KEYWORDS, 5, country_scores)
    _score_keywords(portfolio_text, COUNTRY_KEYWORDS, 5, country_scores)
    _score_keywords(" ".join([hq_country, city]), COUNTRY_KEYWORDS, 3, country_scores)
    for focus in focus_geographies:
        _score_keywords(focus, COUNTRY_KEYWORDS, 5, country_scores)
    _score_keywords(description, COUNTRY_KEYWORDS, 1, country_scores)

    if not industry_scores:
        industry_scores["General Technology"] += 1
    if not stage_scores:
        stage_scores["General / Multi-stage"] += 1
    if not country_scores and hq_country:
        country_scores[hq_country] += 3
    if not country_scores:
        country_scores["Global"] += 1

    top_3_industries = _rank(industry_scores)
    top_3_stages = _rank(stage_scores)
    top_3_countries = _rank(country_scores)
    return {
        "top_industry_match": top_3_industries[0] if top_3_industries else "",
        "top_stage_match": top_3_stages[0] if top_3_stages else "",
        "top_country_match": top_3_countries[0] if top_3_countries else "",
        "top_3_industries": top_3_industries,
        "top_3_stages": top_3_stages,
        "top_3_countries": top_3_countries,
        "portfolio_companies": portfolio_companies,
    }


def enrich_focus_from_website(investor):
    website = getattr(investor, "website", "") or ""
    homepage_text = crawl_website(website) if website else ""
    portfolio_text = ""
    for portfolio_url in discover_portfolio_urls(website, homepage_text):
        portfolio_text = crawl_website(portfolio_url)
        if portfolio_text:
            break
    if not portfolio_text:
        portfolio_text = homepage_text or getattr(investor, "description", "") or ""
    companies = extract_portfolio_companies(portfolio_text)
    return analyze_investor_focus(investor, homepage_text, portfolio_text, companies)
