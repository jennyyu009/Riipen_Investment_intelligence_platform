import re
from functools import lru_cache

try:
    from .website_utils import crawl_website
except ImportError:
    from website_utils import crawl_website


SECTION_HEADINGS = {
    "education": {"education"},
    "experience": {"experience", "work experience"},
}
DEGREE_TERMS = (
    "associate",
    "bachelor",
    "bsc",
    "ba ",
    "master",
    "msc",
    "mba",
    "phd",
    "doctor",
    "degree",
    "diploma",
    "certificate",
)
EMPLOYER_NOISE = (
    "experience",
    "present",
    "year",
    "month",
    "full-time",
    "part-time",
    "education",
    "skills",
    "followers",
    "connections",
)
LOCATION_PATTERN = re.compile(
    r"\b(?:"
    r"canada|united states|usa|uk|united kingdom|australia|germany|france|india|china|"
    r"toronto|vancouver|montreal|calgary|ottawa|new york|san francisco|boston|"
    r"seattle|los angeles|london|waterloo|chicago|austin"
    r")\b",
    re.IGNORECASE,
)


def _clean_lines(text):
    lines = []
    for raw_line in (text or "").splitlines():
        line = re.sub(r"^[#>*\-\s]+", "", raw_line).strip()
        line = re.sub(r"\s+", " ", line)
        if line and line not in lines:
            lines.append(line)
    return lines


def _section_lines(text, section):
    lines = _clean_lines(text)
    headings = SECTION_HEADINGS[section]
    start = None

    for index, line in enumerate(lines):
        if line.lower().rstrip(":") in headings:
            start = index + 1
            break

    if start is None:
        return lines

    section_lines = []
    all_headings = set().union(*SECTION_HEADINGS.values()) | {
        "about",
        "activity",
        "licenses & certifications",
        "skills",
        "recommendations",
        "interests",
    }
    for line in lines[start:]:
        if line.lower().rstrip(":") in all_headings:
            break
        section_lines.append(line)
    return section_lines


@lru_cache(maxsize=512)
def crawl_linkedin_profile(url, allow_online=True):
    """Crawl a LinkedIn URL using the same failure-tolerant Crawl4AI pipeline as websites."""
    if not url or "linkedin.com" not in url.lower():
        return ""
    try:
        return crawl_website(url, allow_online=allow_online, timeout_seconds=15)
    except Exception:
        return ""


def extract_education(profile_text):
    lines = _section_lines(profile_text, "education")
    education = []
    current = None

    for line in lines:
        lowered = line.lower()
        if any(term in lowered for term in ("university", "college", "school", "institute", "polytechnic")):
            current = {"university": line, "degree": ""}
            education.append(current)
        elif current and any(term in lowered for term in DEGREE_TERMS):
            current["degree"] = line

    return education


def extract_experience(profile_text):
    return _section_lines(profile_text, "experience")


def extract_locations(profile_text):
    locations = []
    for line in _clean_lines(profile_text):
        if len(line) > 120:
            continue
        for match in LOCATION_PATTERN.finditer(line):
            location = match.group(0)
            if location.lower() not in {item.lower() for item in locations}:
                locations.append(location)
    return locations


def extract_employers(profile_text):
    employers = []
    for line in extract_experience(profile_text):
        lowered = line.lower()
        if (
            2 < len(line) <= 100
            and not any(noise in lowered for noise in EMPLOYER_NOISE)
            and not LOCATION_PATTERN.search(line)
            and not re.search(r"\b(?:19|20)\d{2}\b", line)
            and line not in employers
        ):
            employers.append(line)
    return employers
