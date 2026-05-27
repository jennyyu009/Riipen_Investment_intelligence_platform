from datetime import datetime, timezone
from typing import Optional

def _normalize(value: float, cap: float) -> float:
    if cap <= 0:
        return 0.0
    return max(0.0, min(1.0, value / cap)) * 100.0

def compute_frequency(messages_between: int, cap: int = 20) -> float:
    return _normalize(messages_between, cap)

def compute_recency(last_contact: Optional[datetime], days_cap: int = 365) -> float:
    if last_contact is None:
        return 0.0
    if last_contact.tzinfo is None:
        last_contact = last_contact.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - last_contact).days
    score = max(0.0, 1.0 - (days / days_cap))
    return score * 100.0

def compute_mutual_connections(mutual_count: int, cap: int = 10) -> float:
    return _normalize(mutual_count, cap)

def compute_seniority(seniority_value: Optional[float], title: Optional[str] = None) -> float:
    if seniority_value is not None:
        return max(0.0, min(100.0, seniority_value))
    if not title:
        return 50.0
    title = title.lower()
    if any(x in title for x in ("ceo", "founder", "partner", "director")):
        return 90.0
    if any(x in title for x in ("vp", "head", "chief", "lead")):
        return 75.0
    if any(x in title for x in ("manager", "principal")):
        return 60.0
    return 40.0

def relationship_strength(frequency: float, recency: float, mutual: float, seniority: float) -> float:
    # Weights as specified: 0.3, 0.3, 0.2, 0.2
    return (0.3 * frequency) + (0.3 * recency) + (0.2 * mutual) + (0.2 * seniority)
