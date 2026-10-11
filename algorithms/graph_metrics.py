"""Comprehensive Graph Topology and Density Metrics Engine."""

from typing import Any
import networkx as nx


class GraphMetricsCalculator:
    """Computes global structural graph statistics, densities, and component properties."""

    @staticmethod
    def calculate(graph: nx.Graph) -> dict[str, Any]:
        """Compute all topological metrics safely, handling empty and disconnected states."""
        if graph is None or len(graph.nodes) == 0:
            return {
                "node_count": 0,
                "edge_count": 0,
                "donor_count": 0,
                "recipient_count": 0,
                "density": 0.0,
                "average_degree": 0.0,
                "maximum_degree": 0,
                "minimum_degree": 0,
                "connected_components": 0,
                "largest_component_size": 0,
                "isolated_node_count": 0,
                "is_bipartite": True,
                "average_clustering": 0.0,
            }

        node_count = graph.number_of_nodes()
        edge_count = graph.number_of_edges()

        donor_count = sum(1 for _, d in graph.nodes(data=True) if d.get("node_type") == "donor" or d.get("bipartite") == 0)
        recipient_count = sum(1 for _, d in graph.nodes(data=True) if d.get("node_type") == "recipient" or d.get("bipartite") == 1)

        density = nx.density(graph)

        degrees = [d for _, d in graph.degree()]
        avg_degree = (sum(degrees) / len(degrees)) if degrees else 0.0
        max_degree = max(degrees) if degrees else 0
        min_degree = min(degrees) if degrees else 0

        # Component metrics
        num_components = nx.number_connected_components(graph)
        comps = list(nx.connected_components(graph))
        largest_comp_size = max(len(c) for c in comps) if comps else 0
        isolates_count = sum(1 for d in degrees if d == 0)

        # Path metrics for largest component (never on disconnected entire graph)
        largest_comp_diameter = None
        largest_comp_avg_path = None
        if largest_comp_size > 1:
            largest_comp = max(comps, key=len)
            subG = graph.subgraph(largest_comp)
            try:
                largest_comp_diameter = nx.diameter(subG)
                largest_comp_avg_path = round(nx.average_shortest_path_length(subG), 2)
            except Exception:
                pass

        return {
            "node_count": node_count,
            "edge_count": edge_count,
            "donor_count": donor_count,
            "recipient_count": recipient_count,
            "density": round(density, 4),
            "average_degree": round(avg_degree, 2),
            "maximum_degree": max_degree,
            "minimum_degree": min_degree,
            "connected_components": num_components,
            "largest_component_size": largest_comp_size,
            "isolated_node_count": isolates_count,
            "is_bipartite": nx.is_bipartite(graph),
            "largest_component_diameter": largest_comp_diameter,
            "largest_component_avg_shortest_path": largest_comp_avg_path,
        }
