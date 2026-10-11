"""Graph Network page providing interactive bipartite network visualization and path analysis."""

import pandas as pd
import streamlit as st

from algorithms.graph_paths import GraphPathEngine
from modules.compatibility import CompatibilityService
from modules.donor import DonorService
from modules.graph_engine import GraphEngine
from modules.recipient import RecipientService
from ui.components import render_page_header, render_section_header, render_stat_card
from utils.export import export_compatibility_results_csv
from visualization.graph_legend import render_graph_legend
from visualization.graph_visualizer import GraphVisualizer
from visualization.pyvis_renderer import render_html_export_button, render_pyvis_in_streamlit


def render_graph_page(
    graph_engine: GraphEngine,
    compat_service: CompatibilityService,
    donor_service: DonorService,
    recipient_service: RecipientService,
) -> None:
    """Render the primary Graph Matching Network view."""
    render_page_header(
        title="Bipartite Graph Network & Topology",
        description="Analyze donor-recipient compatibility relationships through bipartite graph theory, path traversals, and topological structures.",
    )

    # Academic mode toggle
    academic_mode = st.toggle("🎓 Academic / Research Mode", value=False, help="Display mathematical formulations, graph partition theory, and algorithmic complexity notes.")
    if academic_mode:
        st.info(
            "📐 **Graph Formulation**: Let $G = (V, E, W)$ be a weighted bipartite graph where $V = V_{donor} \\cup V_{recipient}$ "
            "with $V_{donor} \\cap V_{recipient} = \\emptyset$. Every candidate edge $e = (u, v) \\in E$ connects a donor $u \\in V_{donor}$ "
            "to a recipient $v \\in V_{recipient}$ with weight $W(e) \\in [0, 100]$ computed via Phase 3 multi-criteria ranking. "
            "No intra-partition edges exist.",
            icon="ℹ️",
        )

    # Build / Fetch graph
    # Check if graph already has nodes; if not, build automatically from candidates
    candidates = compat_service.get_evaluated_pairs(limit=500)
    if graph_engine.graph.number_of_nodes() == 0 and candidates:
        donors_map = {d.id: d for d in donor_service.get_all_donors(limit=500) if d.id is not None}
        recip_map = {r.id: r for r in recipient_service.get_all_recipients(limit=500) if r.id is not None}
        graph_engine.build(candidates, donors_map=donors_map, recipients_map=recip_map)

    # Action Toolbar
    col_btn1, col_btn2, col_btn3, col_btn4 = st.columns([1.2, 1.2, 1.2, 2.4])
    with col_btn1:
        if st.button("🔄 Rebuild Graph", use_container_width=True):
            donors_map = {d.id: d for d in donor_service.get_all_donors(limit=500) if d.id is not None}
            recip_map = {r.id: r for r in recipient_service.get_all_recipients(limit=500) if r.id is not None}
            graph_engine.build(candidates, donors_map=donors_map, recipients_map=recip_map)
            st.success("Bipartite graph successfully reconstructed!")
            st.rerun()

    with col_btn2:
        if st.button("⚡ Reset View", use_container_width=True):
            st.session_state["graph_selected_path"] = None
            st.session_state["graph_selected_node"] = None
            st.rerun()

    # Metrics Row
    metrics = graph_engine.get_metrics()
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    with col1:
        render_stat_card("Total Nodes", metrics["node_count"], "|V| in Graph", "🌐", "#2563EB")
    with col2:
        render_stat_card("Donors", metrics["donor_count"], "Partition 0", "👤", "#1E40AF")
    with col3:
        render_stat_card("Recipients", metrics["recipient_count"], "Partition 1", "🧑‍⚕️", "#16A34A")
    with col4:
        render_stat_card("Candidate Edges", metrics["edge_count"], "|E| Approved", "🔗", "#0284C7")
    with col5:
        render_stat_card("Components", metrics["connected_components"], "Disjoint Subsets", "🧩", "#D97706")
    with col6:
        render_stat_card("Density", f"{metrics['density']:.3f}", "Graph Sparsity", "📐", "#7C3AED")

    if metrics["node_count"] == 0:
        st.warning(
            "⚠️ **No eligible candidate edges are currently available.**\n\n"
            "Please register donors and recipients, and run the Phase 3 Compatibility Engine to generate candidate relationships before building the network graph.",
            icon="⚠️",
        )
        return

    st.markdown("<br>", unsafe_allow_html=True)
    render_graph_legend()

    # Network Visualization & Path Traversal Split
    path_nodes = st.session_state.get("graph_selected_path")

    # Generate PyVis HTML
    html_graph = GraphVisualizer.generate_html(
        graph_engine.graph,
        path_nodes=path_nodes,
        height="640px",
        physics_enabled=True,
    )

    col_vis, col_inspect = st.columns([2.8, 1.2])

    with col_vis:
        render_pyvis_in_streamlit(html_graph, height=660)
        render_html_export_button(html_graph)

    with col_inspect:
        st.markdown(
            """
            <div style="font-size: 0.95rem; font-weight: 700; color: #F8FAFC; margin-bottom: 8px;">
                🔍 Path & Node Inspector
            </div>
            """,
            unsafe_allow_html=True,
        )

        all_nodes = sorted(list(graph_engine.graph.nodes))
        donor_nodes = [n for n in all_nodes if "DONOR" in n]
        recip_nodes = [n for n in all_nodes if "RECIPIENT" in n]

        tab_path, tab_node = st.tabs(["Shortest Path", "Node Details"])

        with tab_path:
            st.caption("Traverse compatibility chains across donor-recipient vertices.")
            src_node = st.selectbox("Source Vertex", all_nodes, index=0 if all_nodes else 0, key="path_src_node")
            tgt_node = st.selectbox("Target Vertex", all_nodes, index=len(all_nodes)-1 if len(all_nodes) > 1 else 0, key="path_tgt_node")

            if st.button("🔎 Find Shortest Path", use_container_width=True):
                path_engine = GraphPathEngine(graph_engine.graph)
                found_path = path_engine.find_shortest_path(src_node, tgt_node)

                if found_path:
                    st.session_state["graph_selected_path"] = found_path
                    st.success(f"Path Discovered: Length {len(found_path) - 1} hops")
                    st.markdown("**Traversal Sequence:**")
                    st.write(" ➔ ".join(found_path))
                    st.rerun()
                else:
                    st.warning("No compatibility path exists between these nodes.")

            if path_nodes:
                if st.button("Clear Highlighted Path", use_container_width=True):
                    st.session_state["graph_selected_path"] = None
                    st.rerun()

        with tab_node:
            inspected_node = st.selectbox("Select Node", all_nodes, key="inspect_node_select")
            if inspected_node:
                ndata = graph_engine.graph.nodes[inspected_node]
                st.markdown(f"**Entity:** {ndata.get('display_name', inspected_node)}")
                st.markdown(f"**Partition:** {ndata.get('node_type', 'N/A').capitalize()}")
                st.markdown(f"**Organ:** {ndata.get('organ', 'N/A')}")
                st.markdown(f"**Blood Group:** {ndata.get('blood_group', 'N/A')}")
                st.markdown(f"**Hospital:** {ndata.get('hospital', 'N/A')}")
                st.markdown(f"**Degree (Connections):** {graph_engine.graph.degree(inspected_node)}")

                neighbors = list(graph_engine.graph.neighbors(inspected_node))
                st.markdown(f"**Connected Nodes ({len(neighbors)}):**")
                for nbr in neighbors[:8]:
                    edge_w = graph_engine.graph[inspected_node][nbr].get("weight", 0.0)
                    st.caption(f"• {nbr} (Score: {edge_w:.1f})")
                if len(neighbors) > 8:
                    st.caption(f"... and {len(neighbors) - 8} more.")

    # Accessible Tabular Alternative
    st.markdown("---")
    render_section_header("Accessible Graph Data Table (Non-Visual Inspection)", icon="📋")

    tab_nodes_tbl, tab_edges_tbl = st.tabs(["Nodes Registry", "Candidate Edges Registry"])

    with tab_nodes_tbl:
        nodes_data = graph_engine.get_nodes()
        if nodes_data:
            df_nodes = pd.DataFrame([
                {
                    "Node ID": n["node_id"],
                    "Type": n["node_type"].capitalize(),
                    "Name": n["display_name"],
                    "Organ": n["organ"],
                    "Blood Group": n["blood_group"],
                    "Hospital": n["hospital"],
                    "Degree": n["degree"],
                }
                for n in nodes_data
            ])
            st.dataframe(df_nodes, use_container_width=True, hide_index=True)
            st.download_button(
                "📥 Export Nodes (CSV)",
                df_nodes.to_csv(index=False),
                "graph_nodes.csv",
                "text/csv",
                key="export_nodes_csv",
            )

    with tab_edges_tbl:
        edges_data = graph_engine.get_edges()
        if edges_data:
            df_edges = pd.DataFrame([
                {
                    "Donor ID": e["donor_id"],
                    "Recipient ID": e["recipient_id"],
                    "Compatibility Score": f"{e['compatibility_score']:.1f}",
                    "Status": e["status"],
                    "Blood Score": e["blood_score"],
                    "Organ Score": e["organ_score"],
                    "Clinical Score": e["clinical_score"],
                    "Urgency Score": e["urgency_score"],
                }
                for e in edges_data
            ])
            st.dataframe(df_edges, use_container_width=True, hide_index=True)
            st.download_button(
                "📥 Export Edges (CSV)",
                df_edges.to_csv(index=False),
                "graph_edges.csv",
                "text/csv",
                key="export_edges_csv",
            )
