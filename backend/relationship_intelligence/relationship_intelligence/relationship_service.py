import os
import re
import unicodedata
from typing import List, Dict, Any, Optional

import networkx as nx
import pandas as pd
from neo4j.exceptions import ServiceUnavailable
from rapidfuzz import fuzz

from .neo4j_client import get_driver
from .graph_builder import build_graph_from_neo4j
from .scoring import compute_frequency, compute_recency, compute_seniority, relationship_strength

DIRECT_CONTACT_THRESHOLD = 88
FIRM_MATCH_THRESHOLD = 90
MAX_INTRO_HOPS = 2
GENERIC_FIRM_WORDS = {
    "capital",
    "ventures",
    "venture",
    "management",
    "partners",
    "partner",
    "group",
    "fund",
    "finance",
    "financial",
    "bank",
    "limited",
    "ltd",
    "inc",
    "corp",
    "corporation",
    "company",
    "canada",
    "holdings",
    "equity",
    "private",
    "investment",
    "investments",
}


def _normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return " ".join(text.split())


def _linkedin_key(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    match = re.search(r"linkedin\.com/in/([^/?#]+)", text)
    if match:
        return match.group(1).strip("/")
    return text.rstrip("/")


def _read_linkedin_connections(path: Optional[str]) -> pd.DataFrame:
    if not path:
        return pd.DataFrame()

    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            lines = handle.readlines()
    except FileNotFoundError:
        return pd.DataFrame()

    header_index = 0
    for index, line in enumerate(lines):
        if "First Name" in line and "Last Name" in line and "URL" in line:
            header_index = index
            break

    try:
        df = pd.read_csv(path, skiprows=header_index)
    except (pd.errors.EmptyDataError, pd.errors.ParserError):
        return pd.DataFrame()

    df.columns = [str(col).strip() for col in df.columns]
    return df


def _connection_rows(connections_csv_path: Optional[str]) -> List[Dict[str, Any]]:
    df = _read_linkedin_connections(connections_csv_path)
    if df.empty:
        return []

    rows = []
    for _, row in df.iterrows():
        first = row.get("First Name", "")
        last = row.get("Last Name", "")
        name = " ".join(part for part in [str(first or "").strip(), str(last or "").strip()] if part)
        if not name:
            continue

        rows.append({
            "name": name,
            "normalized_name": _normalize_name(name),
            "linkedin_key": _linkedin_key(row.get("URL")),
            "company": str(row.get("Company", "") or "").strip(),
            "normalized_company": _normalize_name(row.get("Company")),
            "title": str(row.get("Position", "") or "").strip(),
            "connected_on": row.get("Connected On"),
        })
    return rows


def _read_messages(path: Optional[str]) -> pd.DataFrame:
    if not path:
        return pd.DataFrame()
    try:
        df = pd.read_csv(path)
    except (FileNotFoundError, pd.errors.EmptyDataError, pd.errors.ParserError):
        return pd.DataFrame()
    df.columns = [str(col).strip() for col in df.columns]
    return df


def _message_stats_for_connection(messages_df: pd.DataFrame, connection: Dict[str, Any]) -> Dict[str, Any]:
    if messages_df.empty:
        return {"count": None, "last_contact": None}

    normalized_name = connection.get("normalized_name")
    linkedin_key = connection.get("linkedin_key")
    if not normalized_name and not linkedin_key:
        return {"count": 0, "last_contact": None}

    date_col = None
    lower_columns = {str(col).lower(): col for col in messages_df.columns}
    for candidate in ("timestamp", "time", "date", "created_at", "sent_at"):
        if candidate in lower_columns:
            date_col = lower_columns[candidate]
            break

    matched_rows = []
    for _, row in messages_df.iterrows():
        row_text = " ".join(str(value or "") for value in row.values)
        normalized_row = _normalize_name(row_text)
        linkedin_row = _linkedin_key(row_text)
        if normalized_name and normalized_name in normalized_row:
            matched_rows.append(row)
        elif linkedin_key and linkedin_key in linkedin_row:
            matched_rows.append(row)

    last_contact = None
    if date_col and matched_rows:
        dates = pd.to_datetime([row.get(date_col) for row in matched_rows], errors="coerce", utc=True)
        dates = dates.dropna()
        if not dates.empty:
            last_contact = dates.max().to_pydatetime()

    return {"count": len(matched_rows), "last_contact": last_contact}


def _name_similarity(a: Any, b: Any) -> float:
    left = _normalize_name(a)
    right = _normalize_name(b)
    if not left or not right:
        return 0.0
    return float(fuzz.token_set_ratio(left, right))


def _person_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or "").strip()
    return str(value or "").strip()


def _person_linkedin_key(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    return _linkedin_key(
        value.get("linkedin")
        or value.get("linkedin_url")
        or value.get("url")
        or value.get("linkedin_key")
    )


def _first_last_parts(name: Any) -> tuple[str, str]:
    parts = _normalize_name(name).split()
    if len(parts) < 2:
        return "", ""
    return parts[0], parts[-1]


def is_same_person(connection_person: Any, investor_contact: Any) -> bool:
    connection_key = _person_linkedin_key(connection_person)
    contact_key = _person_linkedin_key(investor_contact)
    if connection_key and contact_key and connection_key == contact_key:
        return True

    connection_name = _person_name(connection_person)
    contact_name = _person_name(investor_contact)
    normalized_connection = _normalize_name(connection_name)
    normalized_contact = _normalize_name(contact_name)
    connection_first, connection_last = _first_last_parts(connection_name)
    contact_first, contact_last = _first_last_parts(contact_name)
    has_full_names = bool(connection_first and connection_last and contact_first and contact_last)
    if not normalized_connection or not normalized_contact or not has_full_names:
        return False

    if normalized_connection == normalized_contact:
        return True

    names_have_same_first_last = connection_first == contact_first and connection_last == contact_last
    return names_have_same_first_last and _name_similarity(connection_name, contact_name) >= 95


def _is_weak_identity_candidate(connection_person: Any, investor_contact: Any) -> bool:
    connection_name = _person_name(connection_person)
    contact_name = _person_name(investor_contact)
    if not connection_name or not contact_name:
        return False
    return _name_similarity(connection_name, contact_name) >= DIRECT_CONTACT_THRESHOLD


def _clean_firm_name(value: Any) -> str:
    normalized = _normalize_name(value)
    words = [word for word in normalized.split() if word not in GENERIC_FIRM_WORDS]
    return " ".join(words)


def is_verified_firm_match(company_name: Any, investor_name: Any) -> bool:
    normalized_company = _normalize_name(company_name)
    normalized_investor = _normalize_name(investor_name)
    if not normalized_company or not normalized_investor:
        return False

    if normalized_company == normalized_investor:
        return True

    cleaned_company = _clean_firm_name(company_name)
    cleaned_investor = _clean_firm_name(investor_name)
    if not cleaned_company or not cleaned_investor:
        return False

    shorter_cleaned = min(cleaned_company, cleaned_investor, key=len)
    if (
        len(shorter_cleaned) >= 5
        and (cleaned_company in cleaned_investor or cleaned_investor in cleaned_company)
    ):
        return True

    return float(fuzz.token_set_ratio(cleaned_company, cleaned_investor)) >= FIRM_MATCH_THRESHOLD


def _iter_investor_contacts(investor: Any) -> List[Dict[str, Any]]:
    if not isinstance(investor, dict):
        return []

    contacts = investor.get("contacts")
    if contacts:
        return [contact for contact in contacts if contact.get("name") or contact.get("linkedin")]

    return [
        {
            "name": investor.get("contact_1_name"),
            "title": investor.get("contact_1_title"),
            "linkedin": investor.get("contact_1_linkedin"),
        },
        {
            "name": investor.get("contact_2_name"),
            "title": investor.get("contact_2_title"),
            "linkedin": investor.get("contact_2_linkedin"),
        },
    ]


def _investor_name(investor: Any) -> str:
    if isinstance(investor, dict):
        return str(investor.get("investor_name") or investor.get("name") or "")
    return str(investor or "")


def _edge_strength(
    connection: Optional[Dict[str, Any]] = None,
    title: Optional[str] = None,
    message_stats: Optional[Dict[str, Any]] = None,
) -> float:
    connected_on = pd.to_datetime((connection or {}).get("connected_on"), errors="coerce", utc=True)
    connected_on_date = None if pd.isna(connected_on) else connected_on.to_pydatetime()
    message_last_contact = (message_stats or {}).get("last_contact")
    last_contact = max(
        [date for date in (connected_on_date, message_last_contact) if date is not None],
        default=None,
    )
    message_count = (message_stats or {}).get("count")
    frequency_score = compute_frequency(message_count) if message_count is not None else 50
    recency_score = compute_recency(last_contact)
    mutual_connections_score = 50
    seniority_score = compute_seniority(None, title or (connection or {}).get("title"))
    return relationship_strength(
        frequency_score,
        recency_score,
        mutual_connections_score,
        seniority_score,
    )


def _add_edge(G: nx.Graph, left: str, right: str, rel_type: str, strength: float, **props: Any) -> None:
    G.add_edge(
        left,
        right,
        rel_type=rel_type,
        strength=float(strength),
        cost=max(1.0, 100.0 - float(strength)),
        **props,
    )


def _person_node_id(prefix: str, name: str, linkedin_key: str = "") -> str:
    if linkedin_key:
        return f"{prefix}:linkedin:{linkedin_key}"
    return f"{prefix}:name:{_normalize_name(name)}"


def _firm_node_id(name: str) -> str:
    return f"firm:{_normalize_name(name)}"


def _investor_node_id(name: str) -> str:
    return f"investor:{_normalize_name(name)}"


def _build_verified_graph(
    founder_data: Dict[str, Any],
    top_investors: List[Any],
    connections: List[Dict[str, Any]],
    messages_df: Optional[pd.DataFrame] = None,
) -> tuple[nx.Graph, Dict[str, Any]]:
    founder_name = str(founder_data.get("name") or "Founder")
    founder_node = "founder:you"
    G = nx.Graph()
    verified_direct_contact_matches = 0
    rejected_weak_identity_matches = 0
    same_firm_matches = 0
    verified_firm_relationship_matches = 0
    rejected_firm_matches = 0
    messages_df = messages_df if messages_df is not None else pd.DataFrame()
    message_stats_by_connection = {
        _person_node_id("person", connection["name"], connection["linkedin_key"]): _message_stats_for_connection(messages_df, connection)
        for connection in connections
    }

    G.add_node(founder_node, labels=["Founder"], name=founder_name)

    for connection in connections:
        person_node = _person_node_id("person", connection["name"], connection["linkedin_key"])
        G.add_node(
            person_node,
            labels=["Person"],
            name=connection["name"],
            linkedin_key=connection["linkedin_key"],
            title=connection["title"],
            company=connection["company"],
        )
        _add_edge(
            G,
            founder_node,
            person_node,
            "CONNECTED",
            _edge_strength(connection, connection["title"], message_stats_by_connection.get(person_node)),
            verified=True,
            connected_on=connection["connected_on"],
        )

        if connection["company"]:
            firm_node = _firm_node_id(connection["company"])
            G.add_node(firm_node, labels=["Firm"], name=connection["company"])
            _add_edge(G, person_node, firm_node, "WORKS_AT", 100, verified=True)

    for investor in top_investors:
        investor_name = _investor_name(investor)
        if not investor_name:
            continue

        investor_node = _investor_node_id(investor_name)
        investor_firm_node = _firm_node_id(investor_name)
        G.add_node(investor_node, labels=["Investor"], name=investor_name)
        G.add_node(investor_firm_node, labels=["Firm"], name=investor_name)
        _add_edge(G, investor_firm_node, investor_node, "REPRESENTS", 100, verified=True)

        for contact in _iter_investor_contacts(investor):
            contact_name_raw = str(contact.get("name") or "").strip()
            contact_key = _linkedin_key(contact.get("linkedin"))
            if not contact_name_raw and not contact_key:
                continue

            contact_node = _person_node_id("contact", contact_name_raw or contact_key, contact_key)
            G.add_node(
                contact_node,
                labels=["Person", "InvestorContact"],
                name=contact_name_raw or contact_key,
                linkedin_key=contact_key,
                title=contact.get("title"),
            )
            _add_edge(
                G,
                contact_node,
                investor_node,
                "INTRO_PATH",
                100,
                verified=True,
                contact_title=contact.get("title"),
            )

            for connection in connections:
                connection_node = _person_node_id("person", connection["name"], connection["linkedin_key"])
                if not is_same_person(connection, contact):
                    if _is_weak_identity_candidate(connection, contact):
                        rejected_weak_identity_matches += 1
                    continue

                verified_direct_contact_matches += 1
                similarity = 100 if contact_key and contact_key == connection["linkedin_key"] else _name_similarity(contact_name_raw, connection["name"])
                strength = _edge_strength(
                    connection,
                    contact.get("title") or connection["title"],
                    message_stats_by_connection.get(connection_node),
                )
                _add_edge(
                    G,
                    connection_node,
                    investor_node,
                    "INTRO_PATH",
                    strength,
                    verified=True,
                    match_type="verified direct contact match",
                    similarity=similarity,
                    contact_title=contact.get("title") or connection.get("title"),
                    connected_on=connection["connected_on"],
                )

        for connection in connections:
            if not connection["company"]:
                continue
            if not is_verified_firm_match(connection["company"], investor_name):
                rejected_firm_matches += 1
                continue

            same_firm = _normalize_name(connection["company"]) == _normalize_name(investor_name)
            if same_firm:
                same_firm_matches += 1
            else:
                verified_firm_relationship_matches += 1
            company_score = _name_similarity(_clean_firm_name(connection["company"]), _clean_firm_name(investor_name))
            company_firm_node = _firm_node_id(connection["company"])
            _add_edge(
                G,
                company_firm_node,
                investor_node,
                "REPRESENTS",
                100,
                verified=True,
                match_type="same investor firm match" if same_firm else "verified firm relationship match",
                similarity=company_score,
            )

    diagnostics = {
        "connections_loaded": len(connections),
        "investors_checked": len(top_investors),
        "contacts_checked": sum(len(_iter_investor_contacts(investor)) for investor in top_investors),
        "investor_firms_checked": len([_investor_name(investor) for investor in top_investors if _investor_name(investor)]),
        "connection_companies_checked": len({connection["normalized_company"] for connection in connections if connection["normalized_company"]}),
        "verified_direct_contact_matches": verified_direct_contact_matches,
        "rejected_weak_identity_matches": rejected_weak_identity_matches,
        "direct_contact_matches": verified_direct_contact_matches,
        "same_firm_matches": same_firm_matches,
        "verified_firm_relationship_matches": verified_firm_relationship_matches,
        "verified_firm_matches": same_firm_matches + verified_firm_relationship_matches,
        "rejected_firm_matches": rejected_firm_matches,
        "firm_company_matches": same_firm_matches + verified_firm_relationship_matches,
        "total_graph_edges": G.number_of_edges(),
        "total_graph_nodes": G.number_of_nodes(),
    }
    return G, diagnostics


def _path_kind(G: nx.Graph, path: List[str]) -> str:
    edge_types = [G.get_edge_data(left, right, {}).get("rel_type") for left, right in zip(path[:-1], path[1:])]
    if edge_types == ["CONNECTED", "INTRO_PATH"]:
        return "direct contact match"
    if edge_types == ["CONNECTED", "WORKS_AT", "REPRESENTS"]:
        edge = G.get_edge_data(path[-2], path[-1]) or {}
        if edge.get("match_type") == "same investor firm match":
            return "same investor firm match"
        return "verified firm relationship match"
    return "verified graph path"


def _is_allowed_path(G: nx.Graph, path: List[str]) -> bool:
    edge_types = [G.get_edge_data(left, right, {}).get("rel_type") for left, right in zip(path[:-1], path[1:])]
    return edge_types in (
        ["CONNECTED", "INTRO_PATH"],
        ["CONNECTED", "WORKS_AT", "REPRESENTS"],
    )


def _path_evidence(G: nx.Graph, path: List[str], match_type: str) -> List[str]:
    names = [G.nodes[node].get("name") or str(node) for node in path]
    if match_type == "direct contact match":
        return [f"{names[1]} is explicitly listed as an investor contact and passed strict identity verification."]
    if match_type == "same investor firm match":
        return [
            f"{names[1]} lists {names[2]}.",
            f"{names[2]} exactly matches the investor firm.",
        ]
    if match_type == "verified firm relationship match":
        return [
            f"{names[1]} lists {names[2]}.",
            f"{names[2]} passed strict firm verification for {names[-1]}.",
        ]
    return ["Verified graph relationship path."]


def _path_score(strengths: List[float]) -> float:
    if not strengths:
        return 0.0
    weakest_edge_strength = min(strengths)
    average_edge_strength = sum(strengths) / len(strengths)
    return (0.7 * weakest_edge_strength) + (0.3 * average_edge_strength)


def _find_verified_paths(G: nx.Graph, founder_node: str, investor_node: str, limit: int = 3) -> List[Dict[str, Any]]:
    if founder_node not in G or investor_node not in G:
        return []

    verified_paths = []
    seen_paths = set()
    max_edges = MAX_INTRO_HOPS + 1

    for path in nx.all_simple_paths(G, source=founder_node, target=investor_node, cutoff=max_edges):
        if len(path) < 3 or len(path) - 2 > MAX_INTRO_HOPS:
            continue
        if not _is_allowed_path(G, path):
            continue

        path_key = tuple(path)
        if path_key in seen_paths:
            continue
        seen_paths.add(path_key)

        strengths = []
        for left, right in zip(path[:-1], path[1:]):
            edge = G.get_edge_data(left, right) or {}
            strengths.append(float(edge.get("strength", 0)))

        score = _path_score(strengths)
        intro_hops = len(path) - 2
        match_type = _path_kind(G, path)
        verified_paths.append({
            "path": path,
            "hops": intro_hops,
            "relationship_score": int(round(score)),
            "path_score": score,
            "weakest_edge_strength": min(strengths) if strengths else 0,
            "average_edge_strength": sum(strengths) / len(strengths) if strengths else 0,
            "match_type": match_type,
            "confidence": "verified",
            "evidence": _path_evidence(G, path, match_type),
        })

    verified_paths.sort(key=lambda item: (item["relationship_score"], item["path_score"], -item["hops"]), reverse=True)
    return verified_paths[:limit]


def _investor_matching_score(investor: Any) -> Any:
    if not isinstance(investor, dict):
        return None
    for key in ("matching_score", "score", "score_raw", "final_score"):
        if investor.get(key) is not None:
            return investor.get(key)
    return None


def _graph_relationship_results(
    founder_data: Dict[str, Any],
    top_investors: List[Any],
    connections: List[Dict[str, Any]],
    messages_df: Optional[pd.DataFrame] = None,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    G, diagnostics = _build_verified_graph(founder_data, top_investors, connections, messages_df)
    results = []

    for investor in top_investors:
        investor_name = _investor_name(investor)
        investor_entry = {
            "investor_name": investor_name,
            "matching_score": _investor_matching_score(investor),
            "paths": [],
        }
        verified_paths = _find_verified_paths(G, "founder:you", _investor_node_id(investor_name), limit=3)
        for verified_path in verified_paths:
            investor_entry["paths"].append({
                "path": [G.nodes[node].get("name") or str(node) for node in verified_path["path"]],
                "hops": verified_path["hops"],
                "relationship_score": verified_path["relationship_score"],
                "path_score": verified_path["path_score"],
                "match_type": verified_path["match_type"],
                "confidence": verified_path["confidence"],
                "evidence": verified_path["evidence"],
            })
        results.append(investor_entry)

    return results, diagnostics


def _merge_neo4j_path(result: Dict[str, Any], investor_name: str, path: Dict[str, Any]) -> None:
    for entry in result["results"]:
        if entry["investor_name"] == investor_name:
            entry["paths"].append(path)
            entry["paths"].sort(
                key=lambda item: (item.get("relationship_score", 0), item.get("path_score", 0)),
                reverse=True,
            )
            entry["paths"] = entry["paths"][:3]
            return
    result["results"].append({"investor_name": investor_name, "paths": [path]})


def run_relationship_intelligence(
    founder_data: Dict[str, Any],
    top_investors: List[Any],
    connections_csv_path: str = None,
    messages_csv_path: str = None,
    neo4j_uri: str = None,
    neo4j_user: str = None,
    neo4j_password: str = None,
) -> Dict[str, Any]:
    """
    Single entrypoint for relationship intelligence.
    Returns a structure suitable for API responses.
    """
    csv_connections = _connection_rows(connections_csv_path)
    messages_df = _read_messages(messages_csv_path)
    graph_results, diagnostics = _graph_relationship_results(
        founder_data,
        top_investors,
        csv_connections,
        messages_df,
    )
    result = {
        "results": graph_results,
        "errors": [],
        "diagnostics": diagnostics,
    }

    neo4j_uri = neo4j_uri if neo4j_uri is not None else os.getenv("NEO4J_URI")
    neo4j_user = neo4j_user if neo4j_user is not None else os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password = neo4j_password if neo4j_password is not None else os.getenv("NEO4J_PASSWORD", "12345678")

    if not neo4j_uri:
        return result

    try:
        driver = get_driver(neo4j_uri, neo4j_user, neo4j_password)
    except ServiceUnavailable as exc:
        result["errors"].append(str(exc))
        return result

    try:
        G = build_graph_from_neo4j(driver, connections_csv_path, messages_csv_path)
    except Exception as exc:
        result["errors"].append(f"Graph build failed: {exc}")
        return result

    # find founder node id by matching name
    founder_name = founder_data.get("name")
    founder_node = None
    for n, attrs in G.nodes(data=True):
        if attrs.get("name") and attrs.get("name").strip().lower() == str(founder_name).strip().lower():
            founder_node = n
            break

    if founder_node is None:
        result["errors"].append("Founder not found in graph")

    for investor in top_investors:
        investor_name = _investor_name(investor)
        investor_node = None
        for n, attrs in G.nodes(data=True):
            labels = attrs.get("labels") or []
            if "Investor" in labels and attrs.get("name") and attrs.get("name").strip().lower() == str(investor_name).strip().lower():
                investor_node = n
                break

        if founder_node is None or investor_node is None:
            continue

        try:
            for verified_path in _find_verified_paths(G, founder_node, investor_node, limit=3):
                path_names = [G.nodes[p].get("name") or str(p) for p in verified_path["path"]]
                _merge_neo4j_path(result, investor_name, {
                    "path": path_names,
                    "hops": verified_path["hops"],
                    "relationship_score": verified_path["relationship_score"],
                    "path_score": verified_path["path_score"],
                    "match_type": verified_path["match_type"],
                    "confidence": verified_path["confidence"],
                    "evidence": verified_path["evidence"],
                })
        except Exception as exc:
            result["errors"].append(f"Pathfinding failed for {investor_name}: {exc}")

    return result
