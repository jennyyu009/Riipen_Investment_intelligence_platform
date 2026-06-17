import os
import re
import logging
import json
import traceback
from uuid import uuid4

from fastapi import FastAPI, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

try:
    from .database import Base, SessionLocal, engine, ensure_database_schema, get_db
    from .config import ENABLE_HEAVY_PROCESSING, MAX_PITCH_DECK_BYTES
    from .enriched_data import sync_enriched_investors
    from .models import Founder, Startup, Investor, InvestorMatch
    from .schemas import FounderStartupCreate, InvestorEnrichmentRequest
    from .investor_enrichment import enrich_investor, investor_data
    from .matching_score.api import router as matching_score_router
    from .relationship_intelligence.api import router as relationship_intelligence_router
    from .seed_investors import ensure_investors_seeded
    from .services.ai_insights_service import MODEL_ID as AI_INSIGHTS_MODEL_ID, analyze_pitch_deck, extract_text_with_docling
except ImportError:
    from database import Base, SessionLocal, engine, ensure_database_schema, get_db
    from config import ENABLE_HEAVY_PROCESSING, MAX_PITCH_DECK_BYTES
    from enriched_data import sync_enriched_investors
    from models import Founder, Startup, Investor, InvestorMatch
    from schemas import FounderStartupCreate, InvestorEnrichmentRequest
    from investor_enrichment import enrich_investor, investor_data
    from matching_score.api import router as matching_score_router
    from relationship_intelligence.api import router as relationship_intelligence_router
    from seed_investors import ensure_investors_seeded
    from services.ai_insights_service import MODEL_ID as AI_INSIGHTS_MODEL_ID, analyze_pitch_deck, extract_text_with_docling

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
    if ENABLE_HEAVY_PROCESSING:
        investor_count = ensure_investors_seeded()
        source = "local database/CSV"
    else:
        db = SessionLocal()
        try:
            investor_count = sync_enriched_investors(db)
        finally:
            db.close()
        source = "pre-enriched JSON"
    logger.info("Backend startup completed with %s investors loaded from %s", investor_count, source)


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
    if data.startup.pitch_deck_url and not data.startup.pitch_deck_url.lower().endswith((".pdf", ".pptx")):
        raise HTTPException(status_code=415, detail="Only PDF and PPTX pitch deck files are accepted.")

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


@app.post("/investors/enrich")
def enrich_investors(data: InvestorEnrichmentRequest, db: Session = Depends(get_db)):
    investor_ids = list(dict.fromkeys(data.investor_ids))[:15]
    investors = db.query(Investor).filter(Investor.id.in_(investor_ids)).all()

    if ENABLE_HEAVY_PROCESSING:
        for investor in investors:
            enrich_investor(investor)

    db.commit()
    for investor in investors:
        db.refresh(investor)

    return {
        "investors": [investor_data(investor) for investor in investors],
    }


@app.post("/pitch-deck/validate")
async def validate_pitch_deck(file: UploadFile = File(...)):
    filename = file.filename or "pitch-deck.pdf"
    normalized_name = filename.lower()
    is_supported = (
        file.content_type == "application/pdf"
        or file.content_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        or normalized_name.endswith(".pdf")
        or normalized_name.endswith(".pptx")
    )
    if not is_supported:
        raise HTTPException(status_code=415, detail="Only PDF and PPTX files are accepted.")

    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_PITCH_DECK_BYTES:
            raise HTTPException(status_code=413, detail="Pitch deck exceeds the maximum file size of 10MB.")

    return {
        "filename": filename,
        "size": size,
        "message": "Pitch deck is a valid PDF or PPTX within the 10MB limit.",
    }


@app.post("/api/ai-insights")
async def analyze_ai_insights(request: Request):
    request_id = str(uuid4())
    pitch_text = ""
    content_type = request.headers.get("content-type", "")
    logger.info(
        "[AI Insights] request_id=%s endpoint=/api/ai-insights method=POST content_type=%s hf_key_loaded=%s",
        request_id,
        content_type,
        bool(os.getenv("HF_API_KEY")),
    )
    try:
        if content_type.startswith("multipart/form-data"):
            form = await request.form()
            logger.info("[AI Insights] request_id=%s multipart_fields=%s", request_id, list(form.keys()))
            pitch_text = str(form.get("pitch_text") or "")
            pitch_deck = form.get("pitch_deck") or form.get("file")
            if pitch_deck and hasattr(pitch_deck, "read"):
                file_bytes = await pitch_deck.read()
                filename = getattr(pitch_deck, "filename", "pitch-deck.pdf") or "pitch-deck.pdf"
                upload_content_type = getattr(pitch_deck, "content_type", "")
                logger.info(
                    "[AI Insights] request_id=%s uploaded_file filename=%s content_type=%s bytes=%s",
                    request_id,
                    filename,
                    upload_content_type,
                    len(file_bytes or b""),
                )
                pitch_text = extract_text_with_docling(
                    file_bytes,
                    filename,
                )
        else:
            payload = await request.json()
            pitch_text = payload.get("pitch_text", "")
            logger.info("[AI Insights] request_id=%s json_payload_keys=%s pitch_text_chars=%s", request_id, list(payload.keys()), len(pitch_text or ""))
    except RuntimeError as exc:
        logger.error(
            "[AI Insights] request_id=%s request parsing/extraction RuntimeError exception=%s traceback=%s",
            request_id,
            str(exc),
            traceback.format_exc(),
        )
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.error(
            "[AI Insights] request_id=%s request parsing/extraction failed exception=%s traceback=%s",
            request_id,
            repr(exc),
            traceback.format_exc(),
        )
        raise HTTPException(status_code=400, detail="Pitch deck text or file is required.")

    if not pitch_text.strip():
        logger.warning("[AI Insights] request_id=%s empty_pitch_text_after_extraction", request_id)
        raise HTTPException(status_code=400, detail="Pitch deck text is required.")

    try:
        logger.info("[AI Insights] request_id=%s starting_model_analysis pitch_text_chars=%s", request_id, len(pitch_text or ""))
        analysis = await analyze_pitch_deck(pitch_text)
        logger.info("[AI Insights] request_id=%s analysis_success top_level_keys=%s", request_id, list(analysis.keys()))
        return {"success": True, "analysis": analysis}
    except Exception as exc:
        logger.error(
            "[AI Insights] request_id=%s analysis_failed model=%s exception=%s traceback=%s",
            request_id,
            AI_INSIGHTS_MODEL_ID,
            repr(exc),
            traceback.format_exc(),
        )
        raise HTTPException(status_code=502, detail="AI Insights temporarily unavailable.")


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
            **investor_data(investor),
            "entity_name": investor.entity_name,
            "final_score": match.final_score,
            "industry_score": match.industry_score,
            "stage_score": match.stage_score,
            "location_score": match.location_score,
            "fundraising_score": match.fundraising_score,
            "linkedin_score": match.linkedin_score,
            "linkedin_matched_count": match.linkedin_matched_count or 0,
            "linkedin_contribution": match.linkedin_contribution or 0,
            "linkedin_matches": json.loads(match.linkedin_matches) if match.linkedin_matches else {},
            "match_reason": match.match_reason
        }
        for match, investor in matches
    ]
