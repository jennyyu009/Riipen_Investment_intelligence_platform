import os
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

try:
    from ..config import ENABLE_HEAVY_PROCESSING
    from ..precomputed_relationships import lookup_precomputed_relationships
    from .relationship_intelligence import run_relationship_intelligence
except ImportError:
    from config import ENABLE_HEAVY_PROCESSING
    from precomputed_relationships import lookup_precomputed_relationships
    from relationship_intelligence.relationship_intelligence import run_relationship_intelligence

router = APIRouter()


class RelationshipIntelligenceRequest(BaseModel):
    founder_data: Dict[str, Any]
    top_investors: List[Dict[str, Any]]
    connections_csv: str
    messages_csv: Optional[str] = None


def _save_text_to_temp(content: str, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
    except Exception:
        os.close(fd)
        raise
    return path


@router.post("/relationship-intelligence")
def relationship_intelligence(payload: RelationshipIntelligenceRequest):
    if not ENABLE_HEAVY_PROCESSING:
        return lookup_precomputed_relationships(payload.founder_data, payload.top_investors)

    connection_path = None
    messages_path = None

    try:
        connection_path = _save_text_to_temp(payload.connections_csv, ".csv")
        if payload.messages_csv:
            messages_path = _save_text_to_temp(payload.messages_csv, ".csv")

        return run_relationship_intelligence(
            founder_data=payload.founder_data,
            top_investors=payload.top_investors,
            connections_csv_path=connection_path,
            messages_csv_path=messages_path,
        )
    finally:
        for path in (connection_path, messages_path):
            if path and os.path.exists(path):
                os.remove(path)
