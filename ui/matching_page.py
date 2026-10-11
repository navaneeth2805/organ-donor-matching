"""Matching Engine UI executing Maximum Cardinality vs Maximum Weight Matching."""

import pandas as pd
import streamlit as st

from modules.compatibility import CompatibilityService
from modules.graph_engine import GraphEngine
from modules.matching_engine import MatchingEngine
from ui.components import render_page_header, render_section_header, render_stat_card
from visualization.graph_legend import render_graph_legend
from visualization.graph_visualizer import GraphVisualizer
from visualization.pyvis_renderer import render_pyvis_in_streamlit


def render_matching_page(
    matching_engine: MatchingEngine,
    graph_engine: GraphEngine,
    compat_service: CompatibilityService,
) -> None:
    """Render the Matching Engine and algorithm comparison dashboard."""
    render_page_header(
        title="Bipartite Matching Engine & Optimization",
        description="Optimize eligible donor-recipient candidate allocations using Hopcroft-Karp maximum cardinality and maximum-weight matching algorithms.",
    )

    st.info(
        "⚖️ **Medical Decision-Support Boundary**: This matching engine provides decision-support and candidate prioritization. "
        "It does NOT independently execute or approve final clinical organ allocations. "
        "All candidate assignments require multidisciplinary clinical review.",
        icon="ℹ️",
    )

    # Check if graph is built
    if graph_engine.graph.number_of_nodes() == 0:
        st.warning("⚠️ **Graph is empty.** Please build the graph on the Graph Network page first.")
        return

    # Action buttons
    col_a1, col_a2, col_a3 = st.columns([1.5, 1.5, 3])
    with col_a1:
        run_max = st.button("🚀 Run Maximum Cardinality Matching", use_container_width=True, type="primary")
    with col_a2:
        run_weight = st.button("⚖️ Run Maximum Weight Matching", use_container_width=True)

    # State preservation
    if run_max or "max_matching_res" not in st.session_state:
        st.session_state["max_matching_res"] = matching_engine.run_maximum_matching()

    if run_weight or "weighted_matching_res" not in st.session_state:
        st.session_state["weighted_matching_res"] = matching_engine.run_weighted_matching()

    max_res = st.session_state.get("max_matching_res")
    weight_res = st.session_state.get("weighted_matching_res")

    if not max_res or not weight_res:
        return

    comparison = matching_engine.compare_matching_results(max_res, weight_res)

    # High-level Algorithm Comparison Cards
    render_section_header("Algorithm Optimization Comparison", icon="📊")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        render_stat_card(
            "Max Matches (Pairs)",
            f"{max_res.total_matches} vs {weight_res.total_matches}",
            "Cardinality vs Weighted",
            "🤝",
            "#2563EB",
        )
    with col2:
        render_stat_card(
            "Avg Software Score",
            f"{comparison['cardinality']['average_score']:.1f} vs {weight_res.average_weight:.1f}",
            "Score Quality / 100",
            "⭐",
            "#16A34A",
        )
    with col3:
        render_stat_card(
            "Total Score Sum",
            f"{comparison['cardinality']['total_score']:.0f} vs {weight_res.total_weight:.0f}",
            "Cumulative Value",
            "📈",
            "#7C3AED",
        )
    with col4:
        render_stat_card(
            "Recipient Coverage",
            f"{max_res.recipient_coverage}% vs {weight_res.recipient_coverage}%",
            "Patients Matched",
            "🧑‍⚕️",
            "#0284C7",
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # Comparative Summary Table
    comp_df = pd.DataFrame([
        {
            "Metric": "Total Matched Pairs",
            "Maximum Cardinality Matching": max_res.total_matches,
            "Maximum Weight Matching": weight_res.total_matches,
            "Optimization Goal": "Max Cardinality maximizes pair count",
        },
        {
            "Metric": "Average Compatibility Score",
            "Maximum Cardinality Matching": f"{comparison['cardinality']['average_score']:.1f} / 100",
            "Maximum Weight Matching": f"{weight_res.average_weight:.1f} / 100",
            "Optimization Goal": "Max Weight maximizes total score",
        },
        {
            "Metric": "Total Score Sum",
            "Maximum Cardinality Matching": f"{comparison['cardinality']['total_score']:.1f}",
            "Maximum Weight Matching": f"{weight_res.total_weight:.1f}",
            "Optimization Goal": "Max Weight yields higher cumulative weight",
        },
        {
            "Metric": "Donor Coverage (%)",
            "Maximum Cardinality Matching": f"{max_res.donor_coverage}%",
            "Maximum Weight Matching": f"{weight_res.donor_coverage}%",
            "Optimization Goal": "Percentage of eligible donors paired",
        },
        {
            "Metric": "Recipient Coverage (%)",
            "Maximum Cardinality Matching": f"{max_res.recipient_coverage}%",
            "Maximum Weight Matching": f"{weight_res.recipient_coverage}%",
            "Optimization Goal": "Percentage of waiting recipients paired",
        },
        {
            "Metric": "Execution Time",
            "Maximum Cardinality Matching": f"{max_res.execution_time_ms:.2f} ms",
            "Maximum Weight Matching": f"{weight_res.execution_time_ms:.2f} ms",
            "Optimization Goal": "NetworkX computational latency",
        },
    ])
    st.table(comp_df.set_index("Metric"))

    st.markdown("---")

    # Match Difference Analysis (Academic Viva Requirement)
    render_section_header("Match Difference Analysis & Overlap", icon="🔬")
    col_d1, col_d2, col_d3 = st.columns(3)
    with col_d1:
        render_stat_card("Common Pairs", comparison["common_count"], "Selected by Both", "🔗", "#16A34A")
    with col_d2:
        render_stat_card("Cardinality-Only", comparison["max_only_count"], "Unique to Max Matching", "🔵", "#2563EB")
    with col_d3:
        render_stat_card("Weighted-Only", comparison["weighted_only_count"], "Unique to Max Weight", "🟣", "#7C3AED")

    # Matched Pairs Inspection Table
    st.markdown("<br>", unsafe_allow_html=True)
    render_section_header("Selected Candidate Match Allocations", icon="📋")

    algo_choice = st.radio(
        "Display Algorithm Results",
        ["Maximum Cardinality Matching", "Maximum Weight Matching", "Common Pairs Only"],
        horizontal=True,
    )

    if algo_choice == "Maximum Cardinality Matching":
        active_pairs = max_res.matched_pairs
        highlight_color = "#DC2626"
    elif algo_choice == "Maximum Weight Matching":
        active_pairs = weight_res.matched_pairs
        highlight_color = "#7C3AED"
    else:
        active_pairs = comparison["common_matches"]
        highlight_color = "#16A34A"

    if active_pairs:
        table_rows = []
        for rank, p in enumerate(active_pairs, start=1):
            table_rows.append({
                "Rank": rank,
                "Donor ID": p["donor_id"],
                "Recipient ID": p["recipient_id"],
                "Organ": p.get("organ", "N/A"),
                "Software Score": f"{p['compatibility_score']:.1f}",
                "Status": p["status"],
            })

        df_pairs = pd.DataFrame(table_rows)
        st.dataframe(df_pairs, use_container_width=True, hide_index=True)

        st.download_button(
            "📥 Export Selected Matches (CSV)",
            df_pairs.to_csv(index=False),
            f"matched_pairs_{algo_choice.lower().replace(' ', '_')}.csv",
            "text/csv",
        )

        # Match Explorer Drilldown
        st.markdown("<br>", unsafe_allow_html=True)
        render_section_header("Match Explorer & Clinical Rationale", icon="🔎")

        pair_options = [f"{p['donor_id']} ➔ {p['recipient_id']} (Score: {p['compatibility_score']:.1f})" for p in active_pairs]
        selected_option = st.selectbox("Select Pair to Explore", pair_options)

        if selected_option:
            sel_idx = pair_options.index(selected_option)
            chosen_pair = active_pairs[sel_idx]
            d_id = int(chosen_pair["donor_id"].replace("DONOR_D", "").replace("DONOR_", ""))
            r_id = int(chosen_pair["recipient_id"].replace("RECIPIENT_R", "").replace("RECIPIENT_", ""))

            eval_res = compat_service.evaluate_pair(d_id, r_id)
            if eval_res:
                col_exp1, col_exp2 = st.columns(2)
                with col_exp1:
                    st.markdown(f"**Donor:** {eval_res.donor_name} (ID: {eval_res.donor_id})")
                    st.markdown(f"**Organ:** {eval_res.organ}")
                    st.markdown(f"**Blood Group:** {eval_res.donor_blood_group}")
                    st.markdown(f"**Hospital:** {eval_res.donor_hospital}")

                with col_exp2:
                    st.markdown(f"**Recipient:** {eval_res.recipient_name} (ID: {eval_res.recipient_id})")
                    st.markdown(f"**Urgency:** {eval_res.urgency}")
                    st.markdown(f"**Blood Group:** {eval_res.recipient_blood_group}")
                    st.markdown(f"**Hospital:** {eval_res.recipient_hospital}")

                st.markdown(f"**Overall Compatibility Score:** {eval_res.score:.1f} / 100")
                st.markdown("**Rule Breakdown & Explanations:**")
                for exp in eval_res.explanations:
                    st.caption(f"• {exp}")

    # Historical Matching Runs
    if matching_engine.matching_run_repo:
        st.markdown("---")
        render_section_header("Matching Run History & Audit Trail", icon="📜")
        runs = matching_engine.matching_run_repo.get_recent_runs(limit=10)
        if runs:
            df_runs = pd.DataFrame([r.to_dict() for r in runs])
            st.dataframe(df_runs, use_container_width=True, hide_index=True)
