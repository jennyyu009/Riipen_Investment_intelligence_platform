import logging
import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..matching import calculate_investor_score
    from ..models import Founder, Investor, InvestorMatch, Startup
except ImportError:
    from database import get_db
    from matching import calculate_investor_score
    from models import Founder, Investor, InvestorMatch, Startup

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


@router.post("/match-investors/{startup_id}")
def match_investors(startup_id: int, db: Session = Depends(get_db)):
    startup = db.query(Startup).filter(Startup.id == startup_id).first()

    if not startup:
        return {"error": "Startup not found"}

    investors = db.query(Investor).all()
    logger.info(
        "Matching startup_id=%s against %s investors",
        startup_id,
        len(investors),
    )
    results = []
    founder = db.query(Founder).filter(Founder.id == startup.founder_id).first()

    for investor in investors:
        score_result = calculate_investor_score(startup, investor, founder=founder)
        score_raw = score_result.get("final_score_raw", score_result.get("final_score", 0))

        reason = (
            f"Matched with {investor.entity_name} based on "
            f"industry relevance, geographic fit and thesis alignment."
        )

        match = InvestorMatch(
            founder_id=startup.founder_id,
            startup_id=startup.id,
            investor_id=investor.id,
            final_score=score_result["final_score"],
            industry_score=score_result["industry_score"],
            stage_score=score_result.get("stage_score", 0),
            location_score=score_result["location_score"],
            fundraising_score=score_result["fundraising_score"],
            linkedin_score=score_result["linkedin_score"],
            linkedin_matched_count=score_result["linkedin_matched_count"],
            linkedin_contribution=score_result["linkedin_contribution"],
            linkedin_matches=json.dumps(score_result["linkedin_matches"]),
            team_score=0,
            match_reason=reason,
        )

        db.add(match)

        results.append({
            "investor_id": investor.id,
            "entity_name": investor.entity_name,
            "investor_type": investor.investor_type,
            "hq_country": investor.hq_country,
            "location_city": investor.location_city,
            "website": investor.website,
            "company_linkedin": investor.company_linkedin,
            "contact_1_name": investor.contact_1_name,
            "contact_1_designation": investor.contact_1_designation,
            "contact_1_linkedin": investor.contact_1_linkedin,
            "contact_2_name": investor.contact_2_name,
            "contact_2_designation": investor.contact_2_designation,
            "contact_2_linkedin": investor.contact_2_linkedin,
            "final_score_raw": score_raw,
            "final_score": score_result["final_score"],
            "industry_score": score_result["industry_score"],
            "stage_score": score_result.get("stage_score", 0),
            "location_score": score_result["location_score"],
            "fundraising_score": score_result["fundraising_score"],
            "linkedin_score": score_result["linkedin_score"],
            "linkedin_matched_count": score_result["linkedin_matched_count"],
            "linkedin_contribution": score_result["linkedin_contribution"],
            "linkedin_matches": score_result["linkedin_matches"],
            "rubric": score_result["rubric"],
            "weighted_contributions": score_result["weighted_contributions"],
            "original_rubric_score": score_result["original_rubric_score"],
            "linkedin_floor_applied": score_result["linkedin_floor_applied"],
            "match_reason": reason,
        })

    db.commit()

    results = sorted(results, key=lambda x: x["final_score"], reverse=True)

    top = results[:15]

    logger.info(
        "Matching startup_id=%s returned %s top investors",
        startup_id,
        len(top),
    )

    return {
        "startup_id": startup.id,
        "startup_name": startup.startup_name,
        "industry": startup.industry,
        "top_investors": top,
    }
