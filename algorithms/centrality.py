"""Network Centrality Analysis: Degree, Betweenness, and Closeness Centrality."""

from typing import Any
import networkx as nx


class CentralityAnalyzer:
    """Calculates graph centrality distributions across donors and recipients.

    Terminology & Medical Safety Boundaries:
    - Degree Centrality: 'Network Connectivity'
    - Betweenness Centrality: 'Network Brokerage / Bridge Potential'
    - Closeness Centrality: 'Network Reachability'
    Centrality measures structural topology in the mathematical graph;
    they do NOT represent clinical superiority or biological fitness.
    """

    def __init__(self, graph: nx.Graph):
        self.graph = graph

    def compute_degree_centrality(self) -> dict[str, float]:
        """Compute degree centrality for all nodes."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return {}
        return nx.degree_centrality(self.graph)

    def compute_betweenness_centrality(self, normalized: bool = True) -> dict[str, float]:
        """Compute betweenness centrality (frequency of sitting on shortest paths)."""
        if self.graph is None or len(self.graph.nodes) <= 2:
            return {n: 0.0 for n in (self.graph.nodes if self.graph else [])}
        return nx.betweenness_centrality(self.graph, normalized=normalized, weight=None)

    def compute_closeness_centrality(self) -> dict[str, float]:
        """Compute closeness centrality (reciprocal of sum of shortest path distances).

        Safe on disconnected components via Wasserman-Faust formula (default in NetworkX).
        """
        if self.graph is None or len(self.graph.nodes) == 0:
            return {}
        return nx.closeness_centrality(self.graph)

    def get_all_centralities(self) -> list[dict[str, Any]]:
        """Compute and collate all centrality metrics for ranked tabular analysis."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return []

        deg_c = self.compute_degree_centrality()
        bet_c = self.compute_betweenness_centrality()
        clo_c = self.compute_closeness_centrality()

        results: list[dict[str, Any]] = []
        for node in self.graph.nodes:
            node_data = self.graph.nodes[node]
            results.append({
                "node_id": node,
                "node_type": node_data.get("node_type", "unknown").capitalize(),
                "display_name": node_data.get("display_name", node),
                "organ": node_data.get("organ", "N/A"),
                "blood_group": node_data.get("blood_group", "N/A"),
                "degree": self.graph.degree(node),
                "degree_centrality": round(deg_c.get(node, 0.0), 4),
                "betweenness_centrality": round(bet_c.get(node, 0.0), 4),
                "closeness_centrality": round(clo_c.get(node, 0.0), 4),
            })

        # Default sort by degree centrality descending
        results.sort(key=lambda r: (r["degree_centrality"], r["betweenness_centrality"]), reverse=True)
        return results

    def get_top_k(self, metric: str = "degree_centrality", k: int = 10) -> list[dict[str, Any]]:
        """Retrieve the top k nodes ranked by a specific centrality metric."""
        all_nodes = self.get_all_centralities()
        if metric in ["degree_centrality", "betweenness_centrality", "closeness_centrality", "degree"]:
            all_nodes.sort(key=lambda x: x.get(metric, 0), reverse=True)
        return all_nodes[:k]
