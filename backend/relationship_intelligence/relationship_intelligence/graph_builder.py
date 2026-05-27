import pandas as pd
import networkx as nx
from typing import Tuple, Dict, Any
from datetime import datetime
from neo4j import Session

from .scoring import (
    compute_frequency,
    compute_recency,
    compute_mutual_connections,
    compute_seniority,
    relationship_strength,
)

CSV_REQUIRED_COLUMNS = ["source", "target"]

def _read_csv(path: str) -> pd.DataFrame:
    try:
        try:
            df = pd.read_csv(path)
        except pd.errors.ParserError:
            with open(path, "r", encoding="utf-8-sig") as handle:
                lines = handle.readlines()
            header_index = 0
            for index, line in enumerate(lines):
                if "First Name" in line and "Last Name" in line and "URL" in line:
                    header_index = index
                    break
            df = pd.read_csv(path, skiprows=header_index)
        if df.empty:
            return pd.DataFrame()
        return df
    except FileNotFoundError:
        return pd.DataFrame()
    except pd.errors.EmptyDataError:
        return pd.DataFrame()

def build_graph_from_neo4j(driver, connections_csv_path: str = None, messages_csv_path: str = None) -> nx.Graph:
    """
    Extract verified nodes and relationships from Neo4j and construct a NetworkX graph.
    Compute relationship strengths using provided CSVs when available.
    """
    G = nx.Graph()

    connections_df = _read_csv(connections_csv_path) if connections_csv_path else pd.DataFrame()
    messages_df = _read_csv(messages_csv_path) if messages_csv_path else pd.DataFrame()

    # Build node map
    with driver.session() as session:
        node_query = (
            "MATCH (n) WHERE any(l IN labels(n) WHERE l IN ['Founder','Person','Investor','Firm']) "
            "RETURN id(n) as id, labels(n) as labels, n.name as name, n.title as title, n.seniority as seniority"
        )
        nodes = {rec["id"]: {"labels": rec["labels"], "name": rec["name"], "title": rec["title"], "seniority": rec.get("seniority")} for rec in session.run(node_query)}

        # Add nodes
        for nid, meta in nodes.items():
            G.add_node(nid, **meta)

        # Relationships
        rel_query = (
            "MATCH (a)-[r]->(b) WHERE type(r) IN ['CONNECTED','WORKS_AT','INTRO_PATH','REPRESENTS'] "
            "RETURN id(a) as a_id, id(b) as b_id, type(r) as type, r as props"
        )
        for rec in session.run(rel_query):
            a = rec["a_id"]
            b = rec["b_id"]
            rtype = rec["type"]
            props = dict(rec["props"]) if rec["props"] is not None else {}

            # Compute simple metrics
            # frequency: messages between a and b
            frequency = 0
            last_contact = None
            if not messages_df.empty:
                # expect messages CSV to have columns 'from','to','timestamp' or similar
                cols = messages_df.columns.str.lower()
                time_col = None
                for c in ("timestamp", "time", "date"):
                    if c in cols:
                        time_col = messages_df.columns[cols.tolist().index(c)]
                        break
                # try to match by name when available
                name_a = nodes.get(a, {}).get("name")
                name_b = nodes.get(b, {}).get("name")
                if name_a and name_b and time_col:
                    mask = (
                        (messages_df.applymap(lambda v: isinstance(v, str) and v.strip().lower()).any())
                    )
                    try:
                        m = messages_df[
                            (messages_df.astype(str).apply(lambda row: row.str.lower().str.contains(str(name_a).lower())).any(axis=1)) &
                            (messages_df.astype(str).apply(lambda row: row.str.lower().str.contains(str(name_b).lower())).any(axis=1))
                        ]
                        frequency = len(m)
                        if not m.empty:
                            last_vals = pd.to_datetime(m[time_col], errors='coerce')
                            if not last_vals.dropna().empty:
                                last_contact = last_vals.max().to_pydatetime()
                    except Exception:
                        frequency = 0

            # mutual connections: count via connections_df when available
            mutual = 0
            if not connections_df.empty:
                try:
                    s = connections_df.columns.str.lower()
                    # find candidate columns for endpoints
                    possible = [c for c in connections_df.columns if c.lower() in ("source", "target", "from", "to", "a", "b")]
                    if possible and nodes.get(a) and nodes.get(b):
                        name_a = nodes[a].get("name")
                        name_b = nodes[b].get("name")
                        dfstr = connections_df.astype(str).apply(lambda col: col.str.lower())
                        # mutual neighbors: count rows where either endpoint connects to both
                        mutual = int(
                            connections_df.apply(lambda row: (str(name_a).lower() in " ".join(row.astype(str).str.lower().values)) and (str(name_b).lower() in " ".join(row.astype(str).str.lower().values)), axis=1).sum()
                        )
                except Exception:
                    mutual = 0

            seniority = nodes.get(a, {}).get("seniority") or nodes.get(b, {}).get("seniority")
            title_a = nodes.get(a, {}).get("title")
            title_b = nodes.get(b, {}).get("title")

            freq_score = compute_frequency(frequency)
            rec_score = compute_recency(last_contact)
            mutual_score = compute_mutual_connections(mutual)
            senior_score = compute_seniority(seniority, title_a or title_b)

            strength = relationship_strength(freq_score, rec_score, mutual_score, senior_score)
            cost = max(1.0, 100.0 - strength)

            G.add_edge(a, b, rel_type=rtype, strength=float(strength), cost=float(cost), props=props)

    return G
