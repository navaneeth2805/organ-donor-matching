"""Connected Component Analysis for Disjoint Network Clusters and Isolated Nodes."""

from typing import Any
import networkx as nx


class ConnectedComponentAnalyzer:
    """Detects isolated clusters, independent compatibility pools, and orphaned nodes."""

    def __init__(self, graph: nx.Graph):
        self.graph = graph

    def get_components(self) -> list[set[str]]:
        """Return all connected components sorted descending by size."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return []
        comps = list(nx.connected_components(self.graph))
        comps.sort(key=len, reverse=True)
        return comps

    def number_of_components(self) -> int:
        """Count total connected components in the graph."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return 0
        return nx.number_connected_components(self.graph)

    def largest_component(self) -> set[str]:
        """Return the node set of the largest connected component."""
        comps = self.get_components()
        return comps[0] if comps else set()

    def largest_component_size(self) -> int:
        """Size in vertices of the largest component."""
        return len(self.largest_component())

    def isolated_nodes(self) -> list[str]:
        """Return all nodes with zero incident edges."""
        if self.graph is None or len(self.graph.nodes) == 0:
            return []
        return list(nx.isolates(self.graph))

    def isolated_donors(self) -> list[str]:
        """Return isolated donor nodes."""
        return [
            n for n in self.isolated_nodes()
            if self.graph.nodes[n].get("node_type") == "donor" or self.graph.nodes[n].get("bipartite") == 0
        ]

    def isolated_recipients(self) -> list[str]:
        """Return isolated recipient nodes."""
        return [
            n for n in self.isolated_nodes()
            if self.graph.nodes[n].get("node_type") == "recipient" or self.graph.nodes[n].get("bipartite") == 1
        ]

    def component_summary(self) -> list[dict[str, Any]]:
        """Structured table of all components with demographic partition counts."""
        comps = self.get_components()
        summary = []

        for idx, comp in enumerate(comps, start=1):
            subgraph = self.graph.subgraph(comp)
            donors = [n for n in comp if self.graph.nodes[n].get("node_type") == "donor" or self.graph.nodes[n].get("bipartite") == 0]
            recipients = [n for n in comp if self.graph.nodes[n].get("node_type") == "recipient" or self.graph.nodes[n].get("bipartite") == 1]

            summary.append({
                "component_id": idx,
                "total_nodes": len(comp),
                "donor_count": len(donors),
                "recipient_count": len(recipients),
                "edge_count": subgraph.number_of_edges(),
                "is_isolated_singleton": len(comp) == 1,
                "member_nodes": sorted(list(comp)),
            })

        return summary
