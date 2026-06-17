import json
import os
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Dict

MODEL_ID = "Qwen/Qwen3-8B-Instruct"
MAX_CONTEXT_CHARS = 24000
SYSTEM_MESSAGE = """You are an experienced venture capital analyst and startup fundraising advisor.

Your task is to evaluate startup pitch decks and provide objective fundraising feedback.

Only use information explicitly found in the pitch deck.

Do not invent information.

Respond professionally and concisely.

Return valid JSON only."""


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
    try:
        from docling.document_converter import DocumentConverter
    except ImportError as exc:
        raise RuntimeError("Docling is required for pitch deck text extraction.") from exc

    suffix = Path(filename or "pitch-deck.pdf").suffix or ".pdf"
    with NamedTemporaryFile(suffix=suffix, delete=True) as temp_file:
        temp_file.write(file_bytes)
        temp_file.flush()
        converter = DocumentConverter()
        result = converter.convert(temp_file.name)
        document = result.document
        if hasattr(document, "export_to_markdown"):
            return document.export_to_markdown()
        if hasattr(document, "export_to_text"):
            return document.export_to_text()
        return str(document)


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
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


async def analyze_pitch_deck(pitch_text: str) -> Dict[str, Any]:
    cleaned_text = clean_pitch_text(pitch_text)
    if not cleaned_text:
        raise ValueError("Pitch deck text is required.")

    api_key = os.getenv("HF_API_KEY")
    if not api_key:
        raise RuntimeError("HF_API_KEY is not configured.")

    from huggingface_hub import InferenceClient

    client = InferenceClient(
        provider="hf-inference",
        api_key=api_key,
    )
    response = client.chat.completions.create(
        model=MODEL_ID,
        messages=[
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": build_prompt(cleaned_text)},
        ],
        temperature=0.2,
        max_tokens=2200,
    )
    content = response.choices[0].message.content
    return parse_json_response(content)
