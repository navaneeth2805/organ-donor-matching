"""Candidate Ranking & Matching Center UI page."""

import time
import pandas as pd
import streamlit as st
from config.matching_config import (
    COMPATIBILITY_STATUSES,
    DEFAULT_WEIGHTS,
    SAFETY_DISCLAIMER,
    WEIGHT_PRESETS,
    validate_matching_weights,
)
from config.settings import BLOOD_GROUPS, ORGANS, URGENCY_LEVELS
from modules.compatibility import CompatibilityService
from modules.donor import DonorService
from modules.recipient import RecipientService
from ui.components import (
    render_badge,
    render_empty_state,
    render_page_header,
    render_section_header,
    render_stat_card,
)
from utils.exceptions import ValidationError
from utils.export import export_analytics_csv
from visualization.compatibility_charts import (
    render_score_histogram,
    render_status_distribution_chart,
)


def render_candidate_page(
    compat_service: CompatibilityService,
    donor_service: DonorService,
    recipient_service: RecipientService,
) -> None:
    """Render the Candidate Ranking & Matching Center with views, matrix, filters, and configuration."""
    render_page_header(
        "Candidate Ranking & Matching",
        "Multifactor candidate discovery, recipient/donor allocation views, and compatibility matrix",
    )

    # Mandatory Medical Safety Disclaimer
    st.info(SAFETY_DISCLAIMER, icon="ℹ️")

    tab_overview, tab_recip, tab_donor, tab_matrix, tab_config = st.tabs([
        "Candidate Rankings & Discovery",
        "Recipient-Centric View",
        "Donor-Centric View",
        "Compatibility Matrix",
        "Software Ranking Weights",
    ])

    # -------------------------------------------------------------
    # TAB 1: CANDIDATE RANKINGS & DISCOVERY
    # -------------------------------------------------------------
    with tab_overview:
        col_b1, col_b2 = st.columns([3, 1])
        with col_b1:
            st.markdown("Discover and rank potential donor-recipient candidates across the network.")
        with col_b2:
            if st.button("Run Batch Evaluation", type="primary", use_container_width=True):
                t0 = time.perf_counter()
                with st.spinner("Evaluating pairs across network..."):
                    df_batch = compat_service.evaluate_all_pairs(prefilter=False)
                t_elapsed = time.perf_counter() - t0
                st.success(f"Evaluated {len(df_batch)} pairs in {t_elapsed:.2f}s!")
                st.session_state["last_batch_time"] = round(t_elapsed, 2)
                st.session_state["last_batch_count"] = len(df_batch)

        # Filters Bar
        st.markdown("##### Filter Candidate Pairs")
        f_col1, f_col2, f_col3, f_col4 = st.columns(4)
        with f_col1:
            sel_status = st.selectbox(
                "Matching Status",
                ["All Valid Candidates (Potential + Review)", "Potential Candidate Only", "Requires Review Only", "All (Including Incompatible)"],
            )
        with f_col2:
            sel_organ = st.selectbox("Organ Type", ["All Organs"] + ORGANS)
        with f_col3:
            min_score = st.slider("Min Software Score", 0.0, 100.0, 0.0, step=5.0)
        with f_col4:
            search_query = st.text_input("Search Candidate / Donor Name", placeholder="e.g. John, Kidney...")

        # Fetch Candidates from DB
        status_filter = None
        if sel_status == "Potential Candidate Only":
            status_filter = "POTENTIAL_CANDIDATE"
        elif sel_status == "Requires Review Only":
            status_filter = "REQUIRES_REVIEW"

        organ_filter = None if sel_organ == "All Organs" else sel_organ

        candidates = compat_service.repo.get_candidates(
            status=status_filter,
            min_score=min_score,
            organ=organ_filter,
            limit=250,
        )

        if sel_status == "All Valid Candidates (Potential + Review)":
            candidates = [c for c in candidates if c.status in ("POTENTIAL_CANDIDATE", "REQUIRES_REVIEW")]

        if search_query.strip():
            sq = search_query.strip().lower()
            candidates = [
                c for c in candidates
                if sq in (c.donor_name or "").lower()
                or sq in (c.recipient_name or "").lower()
                or sq in (c.organ or "").lower()
                or sq in f"d-{c.donor_id}".lower()
                or sq in f"r-{c.recipient_id}".lower()
            ]

        # Top Metric Cards
        c1, c2, c3, c4 = st.columns(4)
        total_evals = compat_service.repo.count()
        pot_count = compat_service.repo.count("POTENTIAL_CANDIDATE")
        rev_count = compat_service.repo.count("REQUIRES_REVIEW")
        incomp_count = compat_service.repo.count("INCOMPATIBLE")

        with c1:
            render_stat_card("Pairs Evaluated", str(total_evals), "Stored evaluations", "📊")
        with c2:
            render_stat_card("Potential Candidates", str(pot_count), "Zero active review flags", "✓")
        with c3:
            render_stat_card("Review Required", str(rev_count), "Clinical verification needed", "⚠")
        with c4:
            render_stat_card("Incompatible Pairs", str(incomp_count), "Failed hard constraints", "✕")

        if not candidates:
            render_empty_state(
                "No candidate pairs match filters",
                "Click 'Run Batch Evaluation' or lower the minimum score filter to populate candidates.",
            )
        else:
            table_rows = []
            for rank_idx, c in enumerate(candidates, 1):
                warn_str = f"{len(c.warnings)} alert(s)" if c.warnings else "None"
                table_rows.append({
                    "Rank": rank_idx,
                    "Donor": f"D-{c.donor_id} ({c.donor_name})",
                    "Recipient": f"R-{c.recipient_id} ({c.recipient_name})",
                    "Organ": c.organ,
                    "Donor Blood": c.donor_blood_group,
                    "Recipient Blood": c.recipient_blood_group,
                    "Status": c.status.replace("_", " ").title(),
                    "Score": f"{c.score:.1f}",
                    "Urgency": c.urgency or "Standard",
                    "Review Flags": warn_str,
                })

            df_display = pd.DataFrame(table_rows)
            st.dataframe(df_display, use_container_width=True, hide_index=True)

            # Export button
            csv_data = export_analytics_csv(df_display)
            st.download_button(
                "Export Candidate List (CSV)",
                data=csv_data,
                file_name="candidate_rankings.csv",
                mime="text/csv",
            )

        # Visual Analytics Section
        st.markdown("---")
        render_section_header("Compatibility & Candidate Distributions", "Visual distributions")
        ch_col1, ch_col2 = st.columns(2)
        status_counts = compat_service.repo.get_status_counts()
        with ch_col1:
            st.markdown("##### Candidate Evaluation Status Distribution")
            render_status_distribution_chart(status_counts)
        with ch_col2:
            st.markdown("##### Software Ranking Score Distribution")
            all_scores = [c.score for c in candidates if c.score > 0]
            render_score_histogram(all_scores)

    # -------------------------------------------------------------
    # TAB 2: RECIPIENT-CENTRIC VIEW
    # -------------------------------------------------------------
    with tab_recip:
        render_section_header("Recipient Allocation View", "Potential donors for waiting recipient")
        recipients = recipient_service.get_all_recipients(active_only=True)
        if not recipients:
            render_empty_state("No registered recipients", "Add recipients to use this view.")
        else:
            recip_map = {
                f"R-{r.id}: {r.name} (Needs {r.organ_needed}, {r.blood_group}, Urgency: {r.urgency})": r.id
                for r in recipients
            }
            sel_r_label = st.selectbox("Select Waiting Recipient", list(recip_map.keys()), key="recip_view_sel")
            target_r_id = recip_map[sel_r_label]
            target_r = recipient_service.get_recipient_by_id(target_r_id)

            col_btn1, col_btn2 = st.columns([3, 1])
            with col_btn2:
                recalc_r = st.button("Re-evaluate Donors for Recipient", use_container_width=True)

            with st.spinner(f"Evaluating candidate donors for {target_r.name}..."):
                donor_candidates = compat_service.find_candidates_for_recipient(target_r_id, recalculate=recalc_r)

            if not donor_candidates:
                render_empty_state(
                    f"No compatible donors for {target_r.name}",
                    f"No available donors offer {target_r.organ_needed} with ABO compatibility ({target_r.blood_group}).",
                )
            else:
                st.markdown(f"#### Compatible Candidate Donors for Recipient R-{target_r.id} ({target_r.name})")
                r_rows = []
                for idx, c in enumerate(donor_candidates, 1):
                    donor_rec = donor_service.get_donor_by_id(c.donor_id)
                    r_rows.append({
                        "Rank": idx,
                        "Donor ID": f"D-{c.donor_id}",
                        "Donor Name": c.donor_name,
                        "Organ": c.organ,
                        "Donor Blood": c.donor_blood_group,
                        "Donor Availability": getattr(donor_rec, "availability", "Available"),
                        "Software Score": f"{c.score:.1f} / 100",
                        "Status": c.status.replace("_", " ").title(),
                        "Review Flags": "; ".join(c.warnings) if c.warnings else "None",
                    })
                st.dataframe(pd.DataFrame(r_rows), use_container_width=True, hide_index=True)

    # -------------------------------------------------------------
    # TAB 3: DONOR-CENTRIC VIEW
    # -------------------------------------------------------------
    with tab_donor:
        render_section_header("Donor Allocation View", "Potential recipients for available donor")
        donors = donor_service.get_all_donors(active_only=True)
        if not donors:
            render_empty_state("No registered donors", "Add donors to use this view.")
        else:
            donor_map = {
                f"D-{d.id}: {d.name} ({d.organ}, {d.blood_group}, Status: {d.availability})": d.id
                for d in donors
            }
            sel_d_label = st.selectbox("Select Available Donor", list(donor_map.keys()), key="donor_view_sel")
            target_d_id = donor_map[sel_d_label]
            target_d = donor_service.get_donor_by_id(target_d_id)

            col_db1, col_db2 = st.columns([3, 1])
            with col_db2:
                recalc_d = st.button("Re-evaluate Recipients for Donor", use_container_width=True)

            with st.spinner(f"Evaluating candidate recipients for {target_d.name}..."):
                recip_candidates = compat_service.find_candidates_for_donor(target_d_id, recalculate=recalc_d)

            if not recip_candidates:
                render_empty_state(
                    f"No compatible recipients for {target_d.name}",
                    f"No waiting recipients require {target_d.organ} with ABO compatibility ({target_d.blood_group}).",
                )
            else:
                st.markdown(f"#### Ranked Candidate Recipients for Donor D-{target_d.id} ({target_d.name})")
                d_rows = []
                for idx, c in enumerate(recip_candidates, 1):
                    recip_rec = recipient_service.get_recipient_by_id(c.recipient_id)
                    d_rows.append({
                        "Rank": idx,
                        "Recipient ID": f"R-{c.recipient_id}",
                        "Recipient Name": c.recipient_name,
                        "Organ Needed": c.organ,
                        "Recipient Blood": c.recipient_blood_group,
                        "Urgency Priority": getattr(recip_rec, "urgency", "Standard"),
                        "Waiting Days": getattr(recip_rec, "waiting_time_days", 0),
                        "Software Score": f"{c.score:.1f} / 100",
                        "Status": c.status.replace("_", " ").title(),
                        "Review Flags": "; ".join(c.warnings) if c.warnings else "None",
                    })
                st.dataframe(pd.DataFrame(d_rows), use_container_width=True, hide_index=True)

    # -------------------------------------------------------------
    # TAB 4: COMPATIBILITY MATRIX
    # -------------------------------------------------------------
    with tab_matrix:
        render_section_header("Cross-Network Compatibility Matrix", "Grid view")
        st.markdown(
            "Matrix visualization of Donor (rows) vs Recipient (columns) compatibility. "
            "Legend: **✓** Potential Candidate, **⚠** Review Required, **✕** Incompatible, **–** Not Evaluated."
        )

        all_donors = donor_service.get_all_donors(active_only=False)
        all_recips = recipient_service.get_all_recipients(active_only=False)

        if not all_donors or not all_recips:
            render_empty_state("No data for matrix", "Register donors and recipients to generate matrix.")
        else:
            # Build matrix dataframe
            matrix_data: dict[str, list[str]] = {}
            row_labels = [f"D-{d.id} ({d.organ} {d.blood_group})" for d in all_donors]

            for r in all_recips:
                col_header = f"R-{r.id} ({r.organ_needed} {r.blood_group})"
                col_vals = []
                for d in all_donors:
                    res = compat_service.repo.get_by_pair(d.id, r.id)
                    if not res:
                        col_vals.append("–")
                    elif res.status == "POTENTIAL_CANDIDATE":
                        col_vals.append(f"✓ ({res.score:.0f})")
                    elif res.status == "REQUIRES_REVIEW":
                        col_vals.append(f"⚠ ({res.score:.0f})")
                    elif res.status == "INSUFFICIENT_DATA":
                        col_vals.append("ℹ Data")
                    else:
                        col_vals.append("✕")
                matrix_data[col_header] = col_vals

            df_matrix = pd.DataFrame(matrix_data, index=row_labels)
            st.dataframe(df_matrix, use_container_width=True)

    # -------------------------------------------------------------
    # TAB 5: SOFTWARE RANKING WEIGHTS & PRESETS
    # -------------------------------------------------------------
    with tab_config:
        render_section_header("Software Ranking Weights Configuration", "Configurable multicriteria scoring")
        st.markdown(
            "Configure transparent multi-attribute software weights. "
            "**Weights must sum to exactly 100.0%**. These weights define the mathematical ranking "
            "for software decision-support and do NOT represent an autonomous clinical allocation standard."
        )

        sel_preset = st.selectbox("Select Preconfigured Preset", list(WEIGHT_PRESETS.keys()))
        preset_vals = WEIGHT_PRESETS[sel_preset]

        w_col1, w_col2 = st.columns(2)
        with w_col1:
            w_blood = st.slider("Blood Group Compatibility Weight (%)", 0.0, 50.0, preset_vals["blood"], step=1.0)
            w_organ = st.slider("Organ Type Match Weight (%)", 0.0, 50.0, preset_vals["organ"], step=1.0)
            w_clinical = st.slider("Clinical Data Readiness Weight (%)", 0.0, 50.0, preset_vals["clinical"], step=1.0)
            w_urgency = st.slider("Recipient Urgency Priority Weight (%)", 0.0, 50.0, preset_vals["urgency"], step=1.0)
        with w_col2:
            w_waiting = st.slider("Waiting Time Contribution Weight (%)", 0.0, 50.0, preset_vals["waiting_time"], step=1.0)
            w_hla = st.slider("HLA Histocompatibility Weight (%)", 0.0, 50.0, preset_vals["hla"], step=1.0)
            w_geo = st.slider("Geographic & Transit Logistics Weight (%)", 0.0, 50.0, preset_vals["geographic"], step=1.0)
            w_dq = st.slider("Clinical Profile Completeness Weight (%)", 0.0, 50.0, preset_vals["data_quality"], step=1.0)

        total_weight = w_blood + w_organ + w_clinical + w_urgency + w_waiting + w_hla + w_geo + w_dq

        if abs(total_weight - 100.0) < 0.01:
            st.success(f"Weight validation passed: Sum equals {total_weight:.1f}%.")
            if st.button("Apply Weights & Re-rank Network", type="primary"):
                active_w = {
                    "blood": w_blood,
                    "organ": w_organ,
                    "clinical": w_clinical,
                    "urgency": w_urgency,
                    "waiting_time": w_waiting,
                    "hla": w_hla,
                    "geographic": w_geo,
                    "data_quality": w_dq,
                }
                compat_service.ranking_engine.weights = active_w
                compat_service.evaluate_all_pairs(prefilter=False, weights_override=active_w)
                st.success("Configured software weights applied and network candidate pairs re-ranked!")
        else:
            st.error(f"Invalid weight configuration: Sum is {total_weight:.1f}% (Must equal 100.0%).")
