"""Interactive PyVis Graph Visualizer with healthcare color semantics and medical safety tooltips."""

from html import escape
import os
from typing import Any
import networkx as nx
from pyvis.network import Network


class GraphVisualizer:
    """Renders interactive NetworkX bipartite graphs using PyVis / vis.js."""

    # Healthcare color tokens
    COLOR_DONOR = "#2563EB"       # Clinical Blue
    COLOR_RECIPIENT = "#16A34A"   # Healthcare Green
    COLOR_EDGE_NORMAL = "#94A3B8" # Slate Gray
    COLOR_MATCH_MAX = "#DC2626"   # Cardinal Red (Maximum Cardinality)
    COLOR_MATCH_WEIGHT = "#7C3AED" # Deep Purple (Maximum Weight)
    COLOR_REVIEW = "#D97706"      # Amber (Review Required)
    COLOR_PATH = "#EA580C"        # Radiant Orange (Shortest Path Traversal)

    @classmethod
    def generate_html(
        cls,
        graph: nx.Graph,
        highlight_edges: set[tuple[str, str]] | None = None,
        highlight_color: str = "#DC2626",
        path_nodes: list[str] | None = None,
        height: str = "600px",
        width: str = "100%",
        physics_enabled: bool = True,
        directed: bool = False,
    ) -> str:
        """Generate interactive vis.js HTML string for rendering in web view or Streamlit iframe."""
        net = Network(height=height, width=width, directed=directed, notebook=False)

        if graph is None or len(graph.nodes) == 0:
            # Return empty placeholder HTML
            return """
            <div style="display:flex; justify-content:center; align-items:center; height:100%; color:#64748B; font-family:sans-serif;">
                <p>No graph nodes to display.</p>
            </div>
            """

        highlight_edges = highlight_edges or set()
        path_nodes_set = set(path_nodes or [])

        # Build path edge lookup if path exists
        path_edges_set = set()
        if path_nodes and len(path_nodes) > 1:
            for i in range(len(path_nodes) - 1):
                path_edges_set.add((path_nodes[i], path_nodes[i + 1]))
                path_edges_set.add((path_nodes[i + 1], path_nodes[i]))

        # Add Nodes
        for node_id, data in graph.nodes(data=True):
            node_type = data.get("node_type", "donor")
            bipartite_val = data.get("bipartite", 0)
            is_donor = (node_type == "donor" or bipartite_val == 0)

            degree = graph.degree(node_id)
            # Scaled bounded node size
            node_size = min(36, 16 + degree * 2)

            # Node Color
            if node_id in path_nodes_set:
                color = cls.COLOR_PATH
            elif is_donor:
                color = cls.COLOR_DONOR
            else:
                color = cls.COLOR_RECIPIENT

            # Label
            label = data.get("label", node_id)

            # Construct safe tooltip (no personal identifiers, emails, phones, or raw medical logs)
            display_name = escape(str(data.get("display_name", node_id)))
            organ = escape(str(data.get("organ", "N/A")))
            blood = escape(str(data.get("blood_group", "N/A")))
            hospital = escape(str(data.get("hospital", "Regional Center")))

            if is_donor:
                tooltip = (
                    f"<strong>Donor: {display_name} ({node_id})</strong><br/>"
                    f"Organ: {organ}<br/>"
                    f"Blood Group: {blood}<br/>"
                    f"Hospital: {hospital}<br/>"
                    f"Connections: {degree}"
                )
            else:
                urgency = escape(str(data.get("urgency", "Standard")))
                waiting_time = data.get("waiting_time", 0)
                tooltip = (
                    f"<strong>Recipient: {display_name} ({node_id})</strong><br/>"
                    f"Organ Needed: {organ}<br/>"
                    f"Blood Group: {blood}<br/>"
                    f"Hospital: {hospital}<br/>"
                    f"Urgency: {urgency}<br/>"
                    f"Waiting Time: {waiting_time} days<br/>"
                    f"Connections: {degree}"
                )

            net.add_node(
                node_id,
                label=label,
                title=tooltip,
                color=color,
                size=node_size,
                shape="dot",
                font={"color": "#FFFFFF", "size": 12, "strokeWidth": 2, "strokeColor": "#0F172A"},
            )

        # Add Edges
        for u, v, data in graph.edges(data=True):
            score = float(data.get("compatibility_score", data.get("weight", 0.0)))
            status = data.get("status", "POTENTIAL_CANDIDATE")

            is_path_edge = (u, v) in path_edges_set or (v, u) in path_edges_set
            is_highlighted = (u, v) in highlight_edges or (v, u) in highlight_edges

            if is_path_edge:
                edge_color = cls.COLOR_PATH
                edge_width = 4.5
                edge_dash = False
            elif is_highlighted:
                edge_color = highlight_color
                edge_width = 3.5
                edge_dash = False
            elif status == "REQUIRES_REVIEW":
                edge_color = cls.COLOR_REVIEW
                edge_width = 1.5
                edge_dash = True
            else:
                edge_color = cls.COLOR_EDGE_NORMAL
                edge_width = 1.2
                edge_dash = False

            # Tooltip
            tooltip = (
                f"<strong>Candidate Pair: {u} → {v}</strong><br/>"
                f"Software Ranking Score: <strong>{score:.1f} / 100</strong><br/>"
                f"Blood Compatibility: {data.get('blood_score', 0):.0f}<br/>"
                f"Organ Viability: {data.get('organ_score', 0):.0f}<br/>"
                f"Clinical Readiness: {data.get('clinical_score', 0):.0f}<br/>"
                f"Urgency Weighting: {data.get('urgency_score', 0):.0f}<br/>"
                f"Waiting Time: {data.get('waiting_time_score', 0):.0f}<br/>"
                f"HLA Readiness: {data.get('hla_score', 0):.0f}<br/>"
                f"Geographic Proximity: {data.get('geographic_score', 0):.0f}<br/>"
                f"<em>Software ranking decision-support only. Not a clinical allocation decision.</em>"
            )

            net.add_edge(
                u,
                v,
                value=max(1, score / 25),
                title=tooltip,
                color=edge_color,
                width=edge_width,
                dashes=edge_dash,
            )

        # Configure vis.js physics and interaction options
        options = {
            "physics": {
                "enabled": physics_enabled,
                "barnesHut": {
                    "gravitationalConstant": -4000,
                    "centralGravity": 0.3,
                    "springLength": 120,
                    "springConstant": 0.04,
                    "damping": 0.09,
                    "avoidOverlap": 0.2,
                },
                "stabilization": {"iterations": 100},
            },
            "interaction": {
                "hover": True,
                "navigationButtons": True,
                "keyboard": True,
                "tooltipDelay": 200,
                "zoomView": True,
            },
        }
        net.set_options(str(options).replace("True", "true").replace("False", "false"))

        # Generate HTML string
        return net.generate_html()
