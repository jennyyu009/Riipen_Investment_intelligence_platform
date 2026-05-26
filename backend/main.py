from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

try:
    from .database import Base, engine, get_db
    from .models import Founder, Startup, Investor, InvestorMatch
    from .schemas import FounderStartupCreate
    from .matching import calculate_investor_score
except ImportError:
    from database import Base, engine, get_db
    from models import Founder, Startup, Investor, InvestorMatch
    from schemas import FounderStartupCreate
    from matching import calculate_investor_score

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Latte Backend")


@app.get("/")
def home():
    return {"message": "Latte backend is running"}


@app.post("/submit-founder")
def submit_founder(data: FounderStartupCreate, db: Session = Depends(get_db)):
    founder = Founder(**data.founder.dict())
    db.add(founder)
    db.commit()
    db.refresh(founder)

    startup = Startup(
        founder_id=founder.id,
        **data.startup.dict()
    )
    db.add(startup)
    db.commit()
    db.refresh(startup)

    return {
        "message": "Founder and startup saved successfully",
        "founder_id": founder.id,
        "startup_id": startup.id
    }


@app.get("/investors")
def get_investors(db: Session = Depends(get_db)):
    return db.query(Investor).all()


@app.post("/match-investors/{startup_id}")
def match_investors(startup_id: int, db: Session = Depends(get_db)):
    startup = db.query(Startup).filter(Startup.id == startup_id).first()

    if not startup:
        return {"error": "Startup not found"}

    investors = db.query(Investor).all()
    results = []
    founder = db.query(Founder).filter(Founder.id == startup.founder_id).first()

    for investor in investors:
        score_result = calculate_investor_score(startup, investor, founder=founder)
        final_score = score_result["final_score"]

        reason = (
            f"Matched with {investor.entity_name} based on "
            f"industry relevance, geographic fit and thesis alignment."
        )

        match = InvestorMatch(
            founder_id=startup.founder_id,
            startup_id=startup.id,
            investor_id=investor.id,
            final_score=final_score,
            industry_score=score_result["industry_score"],
            stage_score=score_result.get("stage_score", 0),
            location_score=score_result["location_score"],
            description_score=score_result["description_score"],
            team_score=0,
            match_reason=reason
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
            "final_score_raw": final_score,
            "industry_score": score_result["industry_score"],
            "stage_score": score_result.get("stage_score", 0),
            "location_score": score_result["location_score"],
            "description_score": score_result["description_score"],
            "match_reason": reason
        })

    db.commit()

    results = sorted(results, key=lambda x: x["final_score_raw"], reverse=True)

    top = results[:15]
    top_score = top[0]["final_score_raw"] if top else 0
    for r in top:
        raw = r["final_score_raw"]
        r["final_score_scaled"] = round(100 * raw / top_score) if top_score else 0
        r["final_score"] = r["final_score_scaled"]

    return {
        "startup_id": startup.id,
        "startup_name": startup.startup_name,
        "industry": startup.industry,
        "top_investors": top
    }


@app.get("/matches/{startup_id}")
def get_matches(startup_id: int, db: Session = Depends(get_db)):
    matches = (
        db.query(InvestorMatch, Investor)
        .join(Investor, InvestorMatch.investor_id == Investor.id)
        .filter(InvestorMatch.startup_id == startup_id)
        .order_by(InvestorMatch.final_score.desc())
        .all()
    )

    return [
        {
            "entity_name": investor.entity_name,
            "investor_type": investor.investor_type,
            "hq_country": investor.hq_country,
            "location_city": investor.location_city,
            "website": investor.website,
            "final_score": match.final_score,
            "industry_score": match.industry_score,
            "stage_score": match.stage_score,
            "location_score": match.location_score,
            "description_score": match.description_score,
            "match_reason": match.match_reason
        }
        for match, investor in matches
    ]
