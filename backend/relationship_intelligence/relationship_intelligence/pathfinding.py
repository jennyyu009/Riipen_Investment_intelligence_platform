import networkx as nx
from typing import List, Dict, Any

def find_best_path(G: nx.Graph, source_node: int, target_node: int, max_hops: int = 2) -> Dict[str, Any]:
    """
    Find the lowest-cost path limited to max_hops intermediate nodes.
    Returns a dict with path, hops and relationship_score (min strength along path).
    """
    if source_node not in G or target_node not in G:
        return {}

    best = None
    best_cost = float("inf")

    for path in nx.all_simple_paths(G, source=source_node, target=target_node, cutoff=max_hops + 1):
        hops = len(path) - 2
        if hops < 1 or hops > max_hops:
            continue
        # compute total cost
        total_cost = 0.0
        strengths = []
        for u, v in zip(path[:-1], path[1:]):
            edge = G.get_edge_data(u, v)
            if edge is None:
                total_cost = float("inf")
                break
            total_cost += float(edge.get("cost", 100.0))
            strengths.append(float(edge.get("strength", 0.0)))
        if total_cost < best_cost:
            best_cost = total_cost
            best = {"path": path, "hops": hops, "relationship_score": int(min(strengths) if strengths else 0), "cost": total_cost}

    return best or {}
