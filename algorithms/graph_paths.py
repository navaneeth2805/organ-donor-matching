"""Shortest Path Analysis Engine for Donor-Recipient Compatibility Graphs."""

from typing import Any
import networkx as nx


class GraphPathEngine:
    """Computes shortest paths, distances, and network connectivity between nodes."""

    def __init__(self, graph: nx.Graph):
        self.graph = graph

    def is_valid_node(self, node: str) -> bool:
        """Check if a node identifier exists in the graph."""
        return self.graph is not None and node in self.graph

    def is_connected(self, source: str, target: str) -> bool:
        """Check if a path exists between source and target nodes."""
        if not self.is_valid_node(source) or not self.is_valid_node(target):
            return False
        return nx.has_path(self.graph, source, target)

    def find_shortest_path(self, source: str, target: str) -> list[str] | None:
        """Find the unweighted shortest path (fewest hops) between source and target.

        Returns list of node IDs in sequence, or None if no path exists.
        """
        if not self.is_valid_node(source) or not self.is_valid_node(target):
            return None

        if source == target:
            return [source]

        try:
            return nx.shortest_path(self.graph, source=source, target=target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def get_path_length(self, source: str, target: str) -> int | None:
        """Get the edge hop count of the shortest path between source and target."""
        if not self.is_valid_node(source) or not self.is_valid_node(target):
            return None

        if source == target:
            return 0

        try:
            return nx.shortest_path_length(self.graph, source=source, target=target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def find_all_shortest_paths(self, source: str, target: str) -> list[list[str]]:
        """Find all tied shortest paths between source and target."""
        if not self.is_valid_node(source) or not self.is_valid_node(target):
            return []

        if source == target:
            return [[source]]

        try:
            return list(nx.all_shortest_paths(self.graph, source=source, target=target))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def format_path_details(self, path: list[str]) -> list[dict[str, Any]]:
        """Format path node transitions with edge weights and attributes."""
        if not path or len(path) < 2:
            return []

        transitions = []
        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            edge_data = self.graph.get_edge_data(u, v, default={})
            u_data = self.graph.nodes.get(u, {})
            v_data = self.graph.nodes.get(v, {})

            transitions.append({
                "hop": i + 1,
                "from_node": u,
                "from_type": u_data.get("node_type", "unknown"),
                "from_name": u_data.get("display_name", u),
                "to_node": v,
                "to_type": v_data.get("node_type", "unknown"),
                "to_name": v_data.get("display_name", v),
                "weight": edge_data.get("weight", 0.0),
                "status": edge_data.get("status", "POTENTIAL_CANDIDATE"),
            })

        return transitions
