"""Network exploration and multi-attribute graph filtering view."""

import pandas as pd
import streamlit as st

from modules.graph_engine import GraphEngine
from ui.components import render_page_header, render_section_header, render_stat_card
from visualization.graph_legend import render_graph_legend
from visualization.graph_visualizer import GraphVisualizer
from visualization.pyvis_renderer import render_html_export_button, render_pyvis_in_streamlit


def render_network_page(graph_engine: GraphEngine) -> None:
    """Render interactive network filtering and subgraph exploration view."""
    render_page_header(
        title="Network Filtering & Cohort Subgraphs",
        description="Filter bipartite compatibility networks by organ type, blood phenotypes, clinical urgency, or minimum score thresholds without modifying underlying datasets.",
    )

    if graph_engine.graph.number_of_nodes() == 0:
        st.warning("⚠️ Graph is currently unpopulated. Please build the network first.")
        return

    # Extract dynamic domain options from graph metadata
    all_organs = sorted(list({d.get("organ") for _, d in graph_engine.graph.nodes(data=True) if d.get("organ")}))
    all_bloods = sorted(list({d.get("blood_group") for _, d in graph_engine.graph.nodes(data=True) if d.get("blood_group")}))
    all_hosps = sorted(list({d.get("hospital") for _, d in graph_engine.graph.nodes(data=True) if d.get("hospital")}))
    all_urgencies = ["Critical", "High", "Medium", "Low"]

    # Filter Controls
    with st.expander("🔍 Filter Controls & Cohort Criteria", expanded=True):
        col_f1, col_f2, col_f3, col_f4 = st.columns(4)
        with col_f1:
            sel_organ = st.selectbox("Organ Filter", ["All"] + all_organs)
        with col_f2:
            sel_donor_bg = st.selectbox("Donor Blood Group", ["All"] + all_bloods)
        with col_f3:
            sel_recip_bg = st.selectbox("Recipient Blood Group", ["All"] + all_bloods)
        with col_f4:
            sel_hosp = st.selectbox("Hospital / Facility", ["All"] + all_hosps)

        col_f5, col_f6, col_f7 = st.columns(3)
        with col_f5:
            min_score = st.slider("Minimum Compatibility Score", 0.0, 100.0, 0.0, 5.0)
        with col_f6:
            sel_urgency = st.selectbox("Recipient Urgency", ["All"] + all_urgencies)
        with col_f7:
            sel_status = st.selectbox("Candidate Status", ["All", "POTENTIAL_CANDIDATE", "REQUIRES_REVIEW"])

    # Generate filtered induced subgraph
    filtered_graph = graph_engine.filter_graph(
        organ=None if sel_organ == "All" else sel_organ,
        donor_blood_group=None if sel_donor_bg == "All" else sel_donor_bg,
        recipient_blood_group=None if sel_recip_bg == "All" else sel_recip_bg,
        hospital=None if sel_hosp == "All" else sel_hosp,
        min_score=min_score,
        urgency=None if sel_urgency == "All" else sel_urgency,
        candidate_status=None if sel_status == "All" else sel_status,
    )

    # Metrics
    f_nodes = filtered_graph.number_of_nodes()
    f_edges = filtered_graph.number_of_edges()
    f_donors = sum(1 for _, d in filtered_graph.nodes(data=True) if d.get("node_type") == "donor")
    f_recips = sum(1 for _, d in filtered_graph.nodes(data=True) if d.get("node_type") == "recipient")

    col_m1, col_m2, col_m3, col_m4 = st.columns(4)
    with col_m1:
        render_stat_card("Filtered Nodes", f_nodes, "Subset Size", "🌐", "#2563EB")
    with col_m2:
        render_stat_card("Filtered Donors", f_donors, "Partition 0", "👤", "#1E40AF")
    with col_m3:
        render_stat_card("Filtered Recipients", f_recips, "Partition 1", "🧑‍⚕️", "#16A34A")
    with col_m4:
        render_stat_card("Candidate Edges", f_edges, "Filtered Pairs", "🔗", "#0284C7")

    st.markdown("<br>", unsafe_allow_html=True)
    render_graph_legend()

    if f_nodes > 0:
        html_filtered = GraphVisualizer.generate_html(filtered_graph, height="600px")
        render_pyvis_in_streamlit(html_filtered, height=620)
        render_html_export_button(html_filtered, file_name="filtered_subgraph.html")
    else:
        st.info("No nodes or edges match the specified filter criteria.", icon="ℹ️")
