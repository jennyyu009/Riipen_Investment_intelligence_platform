import json


JSON_TEXT_FIELDS = {
    "top_3_industries",
    "top_3_stages",
    "top_3_countries",
    "portfolio_companies",
}


def to_json_text(value):
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value


def from_json_text(value, default=None):
    if default is None:
        default = []
    if value is None or value == "":
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def parse_list_field(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        if value.startswith("["):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                pass
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def serialize_investor_json_fields(values):
    serialized = dict(values)
    for field in JSON_TEXT_FIELDS:
        if field in serialized:
            serialized[field] = to_json_text(parse_list_field(serialized[field]))
    return serialized
