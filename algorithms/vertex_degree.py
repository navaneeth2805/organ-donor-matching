"""Vertex Degree and Direct Connectivity Analysis for Bipartite Graphs."""

from typing import Any
import networkx as nx


class VertexDegreeAnalyzer:
    """Analyzes direct node connections and degree distribution across partitions."""

    def __init__(self, graph: nx.Graph):
        self.graph = graph

    def get_node_degrees(self) -> dict[str, int]:
        """Return degree for every node in the graph."""
        if self.graph is None:
            return {}
        return dict(self.graph.degree())

    def get_normalized_degrees(self) -> dict[str, float]:
        """Calculate degree normalized by total possible vertices (N - 1)."""
        if self.graph is None or len(self.graph.nodes) <= 1:
            return {n: 0.0 for n in (self.graph.nodes if self.graph else [])}

        n = len(self.graph.nodes)
        return {node: round(deg / (n - 1), 4) for node, deg in self.graph.degree()}

    def get_partition_degrees(self) -> tuple[dict[str, int], dict[str, int]]:
        """Split degree counts into donor and recipient partitions."""
        if self.graph is None:
            return {}, {}

        donor_degrees: dict[str, int] = {}
        recipient_degrees: dict[str, int] = {}

        for node, deg in self.graph.degree():
            node_type = self.graph.nodes[node].get("node_type")
            bipartite_val = self.graph.nodes[node].get("bipartite")

            if node_type == "donor" or bipartite_val == 0:
                donor_degrees[node] = deg
            else:
                recipient_degrees[node] = deg

        return donor_degrees, recipient_degrees

    def get_degree_summary(self) -> dict[str, Any]:
        """Generate comprehensive degree metrics and extreme connectivity nodes."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return {
                "total_nodes": 0,
                "donor_degrees": {},
                "recipient_degrees": {},
                "highest_degree_donor": None,
                "lowest_degree_donor": None,
                "highest_degree_recipient": None,
                "lowest_degree_recipient": None,
                "average_donor_degree": 0.0,
                "average_recipient_degree": 0.0,
            }

        donor_deg, recip_deg = self.get_partition_degrees()

        def _get_extreme(deg_dict: dict[str, int], find_max: bool):
            if not deg_dict:
                return None
            target_val = max(deg_dict.values()) if find_max else min(deg_dict.values())
            # Find first node with this value
            for k, v in deg_dict.items():
                if v == target_val:
                    return {"node_id": k, "degree": v, "display_name": self.graph.nodes[k].get("display_name", k)}
            return None

        avg_donor = sum(donor_deg.values()) / len(donor_deg) if donor_deg else 0.0
        avg_recip = sum(recip_deg.values()) / len(recip_deg) if recip_deg else 0.0

        return {
            "total_nodes": len(self.graph.nodes),
            "donor_degrees": donor_deg,
            "recipient_degrees": recip_deg,
            "highest_degree_donor": _get_extreme(donor_deg, find_max=True),
            "lowest_degree_donor": _get_extreme(donor_deg, find_max=False),
            "highest_degree_recipient": _get_extreme(recip_deg, find_max=True),
            "lowest_degree_recipient": _get_extreme(recip_deg, find_max=False),
            "average_donor_degree": round(avg_donor, 2),
            "average_recipient_degree": round(avg_recip, 2),
        }
