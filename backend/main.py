import os
import re
import logging

from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

try:
    from .database import Base, engine, ensure_database_schema, get_db
    from .models import Founder, Startup, Investor, InvestorMatch
    from .schemas import FounderStartupCreate
    from .matching_score.api import router as matching_score_router
    from .relationship_intelligence.api import router as relationship_intelligence_router
    from .seed_investors import ensure_investors_seeded
except ImportError:
    from database import Base, engine, ensure_database_schema, get_db
    from models import Founder, Startup, Investor, InvestorMatch
    from schemas import FounderStartupCreate
    from matching_score.api import router as matching_score_router
    from relationship_intelligence.api import router as relationship_intelligence_router
    from seed_investors import ensure_investors_seeded

Base.metadata.create_all(bind=engine)
ensure_database_schema()
logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Latte Backend")
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", ",".join(DEFAULT_FRONTEND_ORIGINS)).split(",")
    if origin.strip()
]
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
)
ALLOWED_BROWSER_ORIGIN = re.compile(rf"^(?:{CORS_ORIGIN_REGEX})$")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(matching_score_router)
app.include_router(relationship_intelligence_router)


@app.on_event("startup")
def seed_empty_investor_database():
    investor_count = ensure_investors_seeded()
    logger.info("Backend startup completed with %s investors loaded", investor_count)


@app.middleware("http")
async def add_private_network_access_header(request, call_next):
    origin = request.headers.get("origin", "")
    is_private_network_preflight = (
        request.method == "OPTIONS" and
        request.headers.get("access-control-request-private-network") == "true" and
        ALLOWED_BROWSER_ORIGIN.match(origin)
    )
    if is_private_network_preflight:
        return Response(
            content="OK",
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
                "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
                "Access-Control-Allow-Private-Network": "true",
                "Vary": "Origin",
            },
        )

    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/")
def home(db: Session = Depends(get_db)):
    return {
        "message": "Latte backend is running",
        "investor_count": db.query(Investor).count(),
    }


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
