import json

try:
    from .config import PRECOMPUTED_WARM_PATHS_PATH
except ImportError:
    from config import PRECOMPUTED_WARM_PATHS_PATH


def _investor_name(investor):
    if isinstance(investor, dict):
        return str(investor.get("investor_name") or investor.get("entity_name") or investor.get("name") or "")
    return str(investor or "")


def _matching_score(investor):
    if not isinstance(investor, dict):
        return None
    for key in ("matching_score", "score", "score_raw", "final_score"):
        if investor.get(key) is not None:
            return investor[key]
    return None


def load_precomputed_warm_paths(path=PRECOMPUTED_WARM_PATHS_PATH):
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def lookup_precomputed_relationships(founder_data, top_investors):
    data = load_precomputed_warm_paths()
    founder_name = str((founder_data or {}).get("name") or "").strip().lower()
    founder_paths = data.get("founders", {}).get(founder_name, {})
    global_paths = data.get("investors", {})
    results = []
    matched_paths = 0

    for investor in top_investors:
        name = _investor_name(investor)
        paths = founder_paths.get(name, global_paths.get(name, []))[:3]
        matched_paths += len(paths)
        results.append({
            "investor_name": name,
            "matching_score": _matching_score(investor),
            "paths": paths,
        })

    return {
        "results": results,
        "errors": [],
        "diagnostics": {
            "mode": "precomputed_lookup",
            "matched_paths": matched_paths,
            "graph_rebuilt": False,
        },
    }
