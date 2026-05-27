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
from .pathfinding import find_best_path
from .scoring import compute_recency, compute_seniority, relationship_strength

DIRECT_CONTACT_THRESHOLD = 88
FIRM_MATCH_THRESHOLD = 75
MAX_INTRO_HOPS = 2


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


def _name_similarity(a: Any, b: Any) -> float:
    left = _normalize_name(a)
    right = _normalize_name(b)
    if not left or not right:
        return 0.0
    return float(fuzz.token_set_ratio(left, right))


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


def _edge_strength(connection: Optional[Dict[str, Any]] = None, title: Optional[str] = None) -> float:
    connected_on = pd.to_datetime((connection or {}).get("connected_on"), errors="coerce")
    last_contact = None if pd.isna(connected_on) else connected_on.to_pydatetime()
    frequency_score = 0
    recency_score = compute_recency(last_contact)
    mutual_connections_score = 100 if connection else 0
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
) -> tuple[nx.Graph, Dict[str, Any]]:
    founder_name = str(founder_data.get("name") or "Founder")
    founder_node = "founder:you"
    G = nx.Graph()
    direct_contact_matches = 0
    firm_company_matches = 0

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
            _edge_strength(connection, connection["title"]),
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
                url_match = bool(contact_key and contact_key == connection["linkedin_key"])
                name_score = _name_similarity(contact_name_raw, connection["name"])
                if not url_match and name_score < DIRECT_CONTACT_THRESHOLD:
                    continue

                direct_contact_matches += 1
                match_type = "LinkedIn URL match" if url_match else "name similarity match"
                similarity = 100 if url_match else name_score
                strength = _edge_strength(connection, contact.get("title") or connection["title"])
                _add_edge(
                    G,
                    connection_node,
                    investor_node,
                    "INTRO_PATH",
                    strength,
                    verified=True,
                    match_type=match_type,
                    similarity=similarity,
                    contact_title=contact.get("title") or connection.get("title"),
                    connected_on=connection["connected_on"],
                )
                if connection_node != contact_node:
                    _add_edge(
                        G,
                        connection_node,
                        contact_node,
                        "IDENTITY_RESOLVED",
                        strength,
                        verified=True,
                        match_type=match_type,
                        similarity=similarity,
                    )

        for connection in connections:
            if not connection["company"]:
                continue
            company_score = _name_similarity(connection["company"], investor_name)
            if company_score < FIRM_MATCH_THRESHOLD:
                continue

            firm_company_matches += 1
            company_firm_node = _firm_node_id(connection["company"])
            _add_edge(
                G,
                company_firm_node,
                investor_node,
                "REPRESENTS",
                100,
                verified=True,
                match_type="firm/company similarity match",
                similarity=company_score,
            )

    diagnostics = {
        "connections_loaded": len(connections),
        "investors_checked": len(top_investors),
        "contacts_checked": sum(len(_iter_investor_contacts(investor)) for investor in top_investors),
        "investor_firms_checked": len([_investor_name(investor) for investor in top_investors if _investor_name(investor)]),
        "connection_companies_checked": len({connection["normalized_company"] for connection in connections if connection["normalized_company"]}),
        "direct_contact_matches": direct_contact_matches,
        "firm_company_matches": firm_company_matches,
        "total_graph_edges": G.number_of_edges(),
        "total_graph_nodes": G.number_of_nodes(),
    }
    return G, diagnostics


def _path_kind(G: nx.Graph, path: List[str]) -> str:
    edge_types = [G.get_edge_data(left, right, {}).get("rel_type") for left, right in zip(path[:-1], path[1:])]
    if edge_types == ["CONNECTED", "INTRO_PATH"]:
        return "direct contact match"
    if edge_types == ["CONNECTED", "WORKS_AT", "REPRESENTS"]:
        return "firm/company match"
    if edge_types == ["CONNECTED", "IDENTITY_RESOLVED", "INTRO_PATH"]:
        return "identity-resolved contact match"
    return "verified graph path"


def _find_verified_path(G: nx.Graph, founder_node: str, investor_node: str) -> Dict[str, Any]:
    if founder_node not in G or investor_node not in G:
        return {}

    best = None
    best_score = -1
    best_hops = float("inf")
    best_cost = float("inf")
    max_edges = MAX_INTRO_HOPS + 1

    for path in nx.all_simple_paths(G, source=founder_node, target=investor_node, cutoff=max_edges):
        if len(path) < 3 or len(path) - 2 > MAX_INTRO_HOPS:
            continue

        edge_types = [G.get_edge_data(left, right, {}).get("rel_type") for left, right in zip(path[:-1], path[1:])]
        if edge_types not in (
            ["CONNECTED", "INTRO_PATH"],
            ["CONNECTED", "WORKS_AT", "REPRESENTS"],
            ["CONNECTED", "IDENTITY_RESOLVED", "INTRO_PATH"],
        ):
            continue

        total_cost = 0.0
        strengths = []
        for left, right in zip(path[:-1], path[1:]):
            edge = G.get_edge_data(left, right) or {}
            total_cost += float(edge.get("cost", 100))
            strengths.append(float(edge.get("strength", 0)))

        relationship_score = int(min(strengths) if strengths else 0)
        intro_hops = len(path) - 2

        if (
            relationship_score > best_score
            or (relationship_score == best_score and intro_hops < best_hops)
            or (relationship_score == best_score and intro_hops == best_hops and total_cost < best_cost)
        ):
            best_score = relationship_score
            best_hops = intro_hops
            best_cost = total_cost
            best = {
                "path": path,
                "hops": intro_hops,
                "relationship_score": relationship_score,
                "cost": total_cost,
                "match_type": _path_kind(G, path),
            }

    return best or {}


def _graph_relationship_results(
    founder_data: Dict[str, Any],
    top_investors: List[Any],
    connections: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    G, diagnostics = _build_verified_graph(founder_data, top_investors, connections)
    results = []

    for investor in top_investors:
        investor_name = _investor_name(investor)
        investor_entry = {"investor_name": investor_name, "paths": []}
        best = _find_verified_path(G, "founder:you", _investor_node_id(investor_name))
        if best:
            investor_entry["paths"].append({
                "path": [G.nodes[node].get("name") or str(node) for node in best["path"]],
                "hops": best["hops"],
                "relationship_score": best["relationship_score"],
                "match_type": best["match_type"],
            })
        results.append(investor_entry)

    return results, diagnostics


def _merge_neo4j_path(result: Dict[str, Any], investor_name: str, path: Dict[str, Any]) -> None:
    for entry in result["results"]:
        if entry["investor_name"] == investor_name:
            entry["paths"].append(path)
            entry["paths"].sort(key=lambda item: item.get("relationship_score", 0), reverse=True)
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
    graph_results, diagnostics = _graph_relationship_results(
        founder_data,
        top_investors,
        csv_connections,
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
            best = find_best_path(G, founder_node, investor_node, max_hops=2)
            if best:
                # convert node ids to names
                path_names = [G.nodes[p].get("name") or str(p) for p in best["path"]]
                _merge_neo4j_path(result, investor_name, {
                    "path": path_names,
                    "hops": best["hops"],
                    "relationship_score": best["relationship_score"],
                    "match_type": "Neo4j graph path",
                })
        except Exception as exc:
            result["errors"].append(f"Pathfinding failed for {investor_name}: {exc}")

    return result
