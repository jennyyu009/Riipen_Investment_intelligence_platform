import json
import logging
import os
import re
import traceback
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Dict


MODEL_ID = os.getenv("HF_AI_INSIGHTS_MODEL", "Qwen/Qwen3-8B")
MAX_CONTEXT_CHARS = 24000
logger = logging.getLogger("uvicorn.error")
SYSTEM_MESSAGE = """You are an experienced venture capital analyst and startup fundraising advisor.

Your task is to evaluate startup pitch decks and provide objective fundraising feedback.

Only use information explicitly found in the pitch deck.

Do not invent information.

Respond professionally and concisely.

Return valid JSON only."""


def truncate_for_log(value: Any, limit: int = 4000) -> str:
    text = str(value or "")
    return text if len(text) <= limit else f"{text[:limit]}... [truncated {len(text) - limit} chars]"


def clean_pitch_text(pitch_text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in (pitch_text or "").splitlines()]
    lines = [line for line in lines if line]

    counts: Dict[str, int] = {}
    for line in lines:
        normalized = line.lower()
        counts[normalized] = counts.get(normalized, 0) + 1

    cleaned = []
    for line in lines:
        normalized = line.lower()
        if re.fullmatch(r"(page\s*)?\d+(\s*/\s*\d+)?", normalized):
            continue
        if counts.get(normalized, 0) > 2 and len(line) < 120:
            continue
        if cleaned and cleaned[-1] == line:
            continue
        cleaned.append(line)

    text = "\n".join(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return prioritize_pitch_text(text)


def prioritize_pitch_text(text: str) -> str:
    if len(text) <= MAX_CONTEXT_CHARS:
        return text

    keywords = [
        "executive summary",
        "problem",
        "solution",
        "market",
        "business model",
        "team",
        "traction",
        "financial",
        "fundraising",
        "ask",
        "use of funds",
    ]
    paragraphs = re.split(r"\n\s*\n", text)
    selected = []
    budget = MAX_CONTEXT_CHARS

    intro = "\n\n".join(paragraphs[:4])
    selected.append(intro)
    budget -= len(intro)

    for paragraph in paragraphs[4:]:
        lower = paragraph.lower()
        if not any(keyword in lower for keyword in keywords):
            continue
        if len(paragraph) + 2 > budget:
            continue
        selected.append(paragraph)
        budget -= len(paragraph) + 2
        if budget <= 1000:
            break

    return "\n\n".join(selected).strip()[:MAX_CONTEXT_CHARS]


def extract_text_with_docling(file_bytes: bytes, filename: str) -> str:
    logger.info(
        "[AI Insights] Docling extraction requested filename=%s bytes=%s",
        filename,
        len(file_bytes or b""),
    )
    try:
        from docling.document_converter import DocumentConverter
    except ImportError as exc:
        logger.exception("[AI Insights] Docling import failed. Is docling installed in the Render environment?")
        raise RuntimeError("Docling is required for pitch deck text extraction.") from exc

    suffix = Path(filename or "pitch-deck.pdf").suffix or ".pdf"
    try:
        with NamedTemporaryFile(suffix=suffix, delete=True) as temp_file:
            temp_file.write(file_bytes)
            temp_file.flush()
            converter = DocumentConverter()
            result = converter.convert(temp_file.name)
            document = result.document
            if hasattr(document, "export_to_markdown"):
                text = document.export_to_markdown()
            elif hasattr(document, "export_to_text"):
                text = document.export_to_text()
            else:
                text = str(document)
        logger.info("[AI Insights] Docling extraction complete filename=%s extracted_chars=%s", filename, len(text or ""))
        logger.info("[AI Insights] Extracted pitch text preview=%s", truncate_for_log(text, 1200))
        return text
    except Exception:
        logger.error("[AI Insights] Docling extraction failed traceback=%s", traceback.format_exc())
        raise


def build_prompt(pitch_text: str) -> str:
    return f"""Analyze the following startup pitch deck.

Evaluate:

1. Executive Summary
2. Startup Overview
3. Key Strengths
4. Key Risks
5. Fundraising Readiness
6. Investor Fit Analysis
7. Recommended Investor Profile
8. Outreach Recommendations
9. Final Investment Impression

Return JSON in exactly this structure:
{{
  "executive_summary": "",
  "startup_overview": {{
    "startup_name": "",
    "industry": "",
    "business_model": "",
    "target_market": "",
    "fundraising_stage": ""
  }},
  "strengths": [
    {{
      "title": "",
      "explanation": ""
    }}
  ],
  "weaknesses": [
    {{
      "title": "",
      "explanation": "",
      "suggestion": ""
    }}
  ],
  "fundraising_readiness": {{
    "market_opportunity": 0,
    "problem_solution_fit": 0,
    "business_model_clarity": 0,
    "competitive_positioning": 0,
    "team_strength": 0,
    "traction_evidence": 0,
    "go_to_market_strategy": 0,
    "total_score": 0
  }},
  "investor_fit": [
    {{
      "type": "",
      "reason": ""
    }}
  ],
  "recommended_investor_profile": {{
    "industries": [],
    "stages": [],
    "geography": [],
    "strategic_value": []
  }},
  "outreach_recommendations": [],
  "final_investment_impression": ""
}}

Pitch Deck Content:

{pitch_text}"""


def parse_json_response(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    logger.info("[AI Insights] Raw model response before JSON parsing=%s", truncate_for_log(text, 6000))
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
        logger.info("[AI Insights] JSON parsed successfully using direct parse keys=%s", list(parsed.keys()))
        return parsed
    except json.JSONDecodeError as exc:
        logger.warning(
            "[AI Insights] Direct JSON parse failed error=%s. Trying object extraction from plain-text response.",
            str(exc),
        )
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            logger.error("[AI Insights] No JSON object found in model response. response=%s", truncate_for_log(text, 6000))
            raise
        try:
            parsed = json.loads(match.group(0))
            logger.info("[AI Insights] JSON parsed successfully after extracting object keys=%s", list(parsed.keys()))
            return parsed
        except json.JSONDecodeError:
            logger.error(
                "[AI Insights] Extracted JSON parse failed traceback=%s response=%s",
                traceback.format_exc(),
                truncate_for_log(text, 6000),
            )
            raise


async def analyze_pitch_deck(pitch_text: str) -> Dict[str, Any]:
    logger.info("[AI Insights] analyze_pitch_deck started model=%s input_chars=%s", MODEL_ID, len(pitch_text or ""))
    cleaned_text = clean_pitch_text(pitch_text)
    logger.info("[AI Insights] Cleaned pitch text chars=%s preview=%s", len(cleaned_text or ""), truncate_for_log(cleaned_text, 1200))
    if not cleaned_text:
        raise ValueError("Pitch deck text is required.")

    api_key = os.getenv("HF_API_KEY")
    logger.info("[AI Insights] HF_API_KEY loaded=%s length=%s", bool(api_key), len(api_key or ""))
    if not api_key:
        raise RuntimeError("HF_API_KEY is not configured.")

    from huggingface_hub import InferenceClient

    prompt = build_prompt(cleaned_text)
    logger.info(
        "[AI Insights] Hugging Face request starting provider=hf-inference model=%s max_tokens=2200 temperature=0.2 prompt_chars=%s",
        MODEL_ID,
        len(prompt),
    )
    client = InferenceClient(
        provider="hf-inference",
        api_key=api_key,
    )
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_MESSAGE},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=2200,
        )
        logger.info("[AI Insights] Hugging Face response object=%s", truncate_for_log(response, 4000))
    except Exception as exc:
        response_obj = getattr(exc, "response", None)
        status_code = getattr(response_obj, "status_code", None)
        response_text = getattr(response_obj, "text", "") if response_obj is not None else ""
        logger.error(
            "[AI Insights] Hugging Face request failed model=%s status_code=%s exception=%s response_content=%s traceback=%s",
            MODEL_ID,
            status_code,
            repr(exc),
            truncate_for_log(response_text, 6000),
            traceback.format_exc(),
        )
        raise

    try:
        content = response.choices[0].message.content
        logger.info("[AI Insights] Hugging Face response status_code=%s model=%s", "not_exposed_by_InferenceClient", MODEL_ID)
        logger.info("[AI Insights] Hugging Face raw content=%s", truncate_for_log(content, 6000))
        return parse_json_response(content)
    except Exception:
        logger.error(
            "[AI Insights] Response extraction or JSON parsing failed traceback=%s response_object=%s",
            traceback.format_exc(),
            truncate_for_log(response, 6000),
        )
        raise
