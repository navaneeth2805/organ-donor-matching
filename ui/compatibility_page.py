"""Compatibility Center UI page for evaluating donor-recipient pairs and reviewing clinical rationales."""

import streamlit as st
from config.matching_config import SAFETY_DISCLAIMER
from database.models import CompatibilityResult
from modules.compatibility import CompatibilityService
from modules.donor import DonorService
from modules.recipient import RecipientService
from ui.components import (
    render_badge,
    render_card,
    render_empty_state,
    render_page_header,
    render_section_header,
    render_stat_card,
)
from visualization.compatibility_charts import render_component_score_bar_chart


def render_compatibility_page(
    compat_service: CompatibilityService,
    donor_service: DonorService,
    recipient_service: RecipientService,
) -> None:
    """Render the interactive pair compatibility evaluation and clinical rationale center."""
    render_page_header(
        "Compatibility Center",
        "Deterministic two-tiered rule engine with clinical decision-support rationales",
    )

    # Mandatory Medical Safety Disclaimer
    st.info(SAFETY_DISCLAIMER, icon="ℹ️")

    donors = donor_service.get_all_donors(active_only=False)
    recipients = recipient_service.get_all_recipients(active_only=False)

    if not donors or not recipients:
        render_empty_state(
            "Insufficient network records",
            "At least one donor and one recipient must be registered to run compatibility evaluations.",
        )
        return

    # Evaluation Selection Panel
    render_section_header("Select Candidates for Clinical Evaluation", "Pairwise evaluation")

    col_sel1, col_sel2 = st.columns(2)

    donor_options = {
        f"D-{d.id}: {d.name} ({d.organ}, Blood: {d.blood_group}, Status: {d.availability})": d.id
        for d in donors
    }
    recip_options = {
        f"R-{r.id}: {r.name} (Needs: {r.organ_needed}, Blood: {r.blood_group}, Urgency: {r.urgency})": r.id
        for r in recipients
    }

    with col_sel1:
        sel_d_label = st.selectbox("Select Registered Donor", list(donor_options.keys()), key="eval_sel_donor")
        selected_donor_id = donor_options[sel_d_label]

    with col_sel2:
        sel_r_label = st.selectbox("Select Registered Recipient", list(recip_options.keys()), key="eval_sel_recip")
        selected_recip_id = recip_options[sel_r_label]

    eval_btn = st.button("Evaluate Pair Compatibility", type="primary", use_container_width=True)

    # Check if existing evaluation is stored, or user pressed evaluate
    result: CompatibilityResult | None = None
    if eval_btn or "last_evaluated_pair" in st.session_state:
        if eval_btn:
            st.session_state["last_evaluated_pair"] = (selected_donor_id, selected_recip_id)

        d_id, r_id = st.session_state.get("last_evaluated_pair", (selected_donor_id, selected_recip_id))
        try:
            with st.spinner("Executing rule engine pipeline and generating transparent clinical rationales..."):
                result = compat_service.evaluate_pair(d_id, r_id, persist=True)
        except Exception as err:
            st.error(f"Evaluation error: {err}")
            return
    else:
        # Check if already evaluated in database
        result = compat_service.repo.get_by_pair(selected_donor_id, selected_recip_id)

    if not result:
        st.caption("Select a pair and click 'Evaluate Pair Compatibility' to inspect rule breakdowns and scores.")
        return

    st.markdown("---")

    # High-Level Decision Support Banner
    status_style_map = {
        "POTENTIAL_CANDIDATE": ("#059669", "#ECFDF5", "Potential Candidate", "Eligible under software rules"),
        "REQUIRES_REVIEW": ("#D97706", "#FFFBEB", "Requires Clinical Review", "Passed hard constraints; review items flagged"),
        "INSUFFICIENT_DATA": ("#0284C7", "#F0F9FF", "Insufficient Data", "Missing critical clinical or profile records"),
        "INCOMPATIBLE": ("#E11D48", "#FFF1F2", "Incompatible", "Failed one or more mandatory hard constraints"),
    }

    st_color, st_bg, st_label, st_desc = status_style_map.get(
        result.status, ("#64748B", "#F8FAFC", result.status, "")
    )

    st.markdown(
        f"""
        <div style="background-color: {st_bg}; border: 1.5px solid {st_color}; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span style="background-color: {st_color}; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;">
                        {st_label.upper()}
                    </span>
                    <span style="font-size: 13px; color: #475569; margin-left: 10px;">{st_desc}</span>
                    <h3 style="margin: 8px 0 0 0; color: #0F172A; font-size: 20px;">
                        Candidate Pair: Donor D-{result.donor_id} ({result.donor_name}) → Recipient R-{result.recipient_id} ({result.recipient_name})
                    </h3>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: bold;">Software Ranking Score</div>
                    <div style="font-size: 32px; font-weight: 800; color: {st_color}; line-height: 1;">
                        {result.score:.1f} <span style="font-size: 16px; font-weight: 500; color: #64748B;">/ 100</span>
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Key Metrics Bar
    m1, m2, m3, m4, m5 = st.columns(5)
    with m1:
        render_stat_card("Organ Alignment", "MATCH" if result.organ_score == 100 else "MISMATCH", "Hard constraint", "✓" if result.organ_score == 100 else "✕")
    with m2:
        render_stat_card("Blood Compatibility", f"{result.donor_blood_group} → {result.recipient_blood_group}", "ABO/Rh compatibility", "✓" if result.blood_score == 100 else "✕")
    with m3:
        render_stat_card("Clinical Readiness", f"{result.clinical_score:.0f}%", "Profile completeness", "✓" if result.clinical_score >= 70 else "⚠")
    with m4:
        render_stat_card("HLA Histocompatibility", f"{result.hla_score:.0f} pts", "Typing & loci overlap", "✓" if result.hla_score >= 60 else "⚠")
    with m5:
        render_stat_card("Geographic Logistics", f"{result.geographic_score:.0f} pts", "Transit feasibility", "🚗")

    # Detailed Side-by-Side Comparison
    render_section_header("Side-by-Side Clinical Parameter Comparison", "Profile records")
    col_d, col_r = st.columns(2)

    with col_d:
        donor_obj = donor_service.get_donor_by_id(result.donor_id)
        d_hosp = result.donor_hospital or "Unassigned"
        st.markdown(
            f"""
            <div style="border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px; background: #FFFFFF;">
                <h4 style="margin: 0 0 10px 0; color: #1E3A8A; font-size: 15px;">Donor Profile (D-{result.donor_id})</h4>
                <table style="width: 100%; font-size: 13px; color: #334155;">
                    <tr><td style="font-weight: 600; padding: 4px 0;">Full Name:</td><td>{result.donor_name}</td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Organ Offered:</td><td><strong>{result.organ}</strong></td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Blood Group:</td><td><span style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{result.donor_blood_group}</span></td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Availability:</td><td>{getattr(donor_obj, 'availability', 'Available')}</td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Facility:</td><td>{d_hosp}</td></tr>
                </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_r:
        recip_obj = recipient_service.get_recipient_by_id(result.recipient_id)
        r_hosp = result.recipient_hospital or "Unassigned"
        urgency_lbl = getattr(recip_obj, "urgency", result.urgency or "Standard")
        waiting_days = getattr(recip_obj, "waiting_time_days", result.waiting_time_days or 0)
        st.markdown(
            f"""
            <div style="border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px; background: #FFFFFF;">
                <h4 style="margin: 0 0 10px 0; color: #065F46; font-size: 15px;">Recipient Profile (R-{result.recipient_id})</h4>
                <table style="width: 100%; font-size: 13px; color: #334155;">
                    <tr><td style="font-weight: 600; padding: 4px 0;">Full Name:</td><td>{result.recipient_name}</td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Organ Needed:</td><td><strong>{result.organ}</strong></td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Blood Group:</td><td><span style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{result.recipient_blood_group}</span></td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Urgency Priority:</td><td><strong>{urgency_lbl}</strong></td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Waiting Time:</td><td>{waiting_days} days</td></tr>
                    <tr><td style="font-weight: 600; padding: 4px 0;">Facility:</td><td>{r_hosp}</td></tr>
                </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Rationale & Explainability Panel
    render_section_header("Explainability & Clinical Rationale", "Transparent reasoning")
    tab_why, tab_rules, tab_scores = st.tabs([
        "Decision Rationale ('Why this outcome?')",
        "Rule-by-Rule Breakdown",
        "Score Contributions & Weights",
    ])

    with tab_why:
        if result.status == "INCOMPATIBLE":
            st.error("### Why this pair was NOT generated as a candidate:")
            for fail in result.hard_failures:
                st.markdown(f"- ✕ **Hard Constraint Failure:** {fail}")
            st.caption("Pairs failing mandatory hard constraints are eliminated prior to candidate ranking.")
        elif result.status == "INSUFFICIENT_DATA":
            st.warning("### Data Completeness Barrier:")
            for fail in result.hard_failures:
                st.markdown(f"- ⚠ **Missing Required Data:** {fail}")
            st.caption("Please record complete clinical and immunological profiles to enable candidate ranking.")
        else:
            st.success("### Why this pair was identified as a candidate:")
            for expl in result.explanations:
                st.markdown(f"- {expl}")

            if result.warnings:
                st.warning("### Active Review Flags (Requires Clinical Verification):")
                for warn in result.warnings:
                    st.markdown(f"- ⚠ **Review Flag:** {warn}")

    with tab_rules:
        rule_data = [
            {"Rule": "Organ Type Match", "Status": "PASS" if result.organ_score == 100 else "FAIL", "Type": "Hard Constraint", "Score": f"{result.organ_score:.0f}/100"},
            {"Rule": "Blood Group (ABO/Rh)", "Status": "PASS" if result.blood_score == 100 else "FAIL", "Type": "Hard Constraint", "Score": f"{result.blood_score:.0f}/100"},
            {"Rule": "Donor Availability", "Status": "PASS" if getattr(donor_obj, 'availability', '') == 'Available' else 'REVIEW', "Type": "Hard Constraint", "Score": "100/100" if getattr(donor_obj, 'availability', '') == 'Available' else '50/100'},
            {"Rule": "Clinical Data Readiness", "Status": "PASS" if result.clinical_score >= 70 else "REVIEW", "Type": "Soft Rule", "Score": f"{result.clinical_score:.0f}/100"},
            {"Rule": "Urgency Software Priority", "Status": "PASS", "Type": "Soft Factor", "Score": f"{result.urgency_score:.0f}/100"},
            {"Rule": "Waiting Time Contribution", "Status": "PASS", "Type": "Soft Factor", "Score": f"{result.waiting_time_score:.0f}/100"},
            {"Rule": "HLA Histocompatibility", "Status": "PASS" if result.hla_score >= 60 else "REVIEW", "Type": "Immunological", "Score": f"{result.hla_score:.0f}/100"},
            {"Rule": "Geographic Feasibility", "Status": "PASS", "Type": "Logistics", "Score": f"{result.geographic_score:.0f}/100"},
        ]
        st.dataframe(rule_data, use_container_width=True)

    with tab_scores:
        col_c1, col_c2 = st.columns([1.2, 1])
        with col_c1:
            render_component_score_bar_chart({
                "blood_score": result.blood_score,
                "organ_score": result.organ_score,
                "clinical_score": result.clinical_score,
                "urgency_score": result.urgency_score,
                "waiting_time_score": result.waiting_time_score,
                "hla_score": result.hla_score,
                "geographic_score": result.geographic_score,
                "data_quality_score": result.data_quality_score,
            })
        with col_c2:
            st.markdown(
                f"""
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; font-size: 13px;">
                    <h4 style="margin-top: 0; color: #0F172A;">Software Ranking Breakdown</h4>
                    <p style="color: #64748B; font-size: 12px; margin-bottom: 8px;">
                        Component scores normalized to 0–100 scale and multiplied by configured weights.
                    </p>
                    <ul style="padding-left: 16px; margin-bottom: 8px; color: #334155;">
                        <li>Blood Score: <strong>{result.blood_score:.0f}</strong></li>
                        <li>Organ Score: <strong>{result.organ_score:.0f}</strong></li>
                        <li>Clinical Readiness: <strong>{result.clinical_score:.0f}</strong></li>
                        <li>Urgency Priority: <strong>{result.urgency_score:.0f}</strong></li>
                        <li>Waiting Time: <strong>{result.waiting_time_score:.0f}</strong></li>
                        <li>HLA Score: <strong>{result.hla_score:.0f}</strong></li>
                        <li>Geographic Score: <strong>{result.geographic_score:.0f}</strong></li>
                        <li>Data Quality: <strong>{result.data_quality_score:.0f}</strong></li>
                    </ul>
                    <div style="border-top: 1px solid #CBD5E1; padding-top: 6px; font-weight: bold; color: #0F172A;">
                        Final Candidate Ranking: {result.score:.1f} / 100
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # Metadata & Auditing Footer
    st.caption(
        f"Evaluated at: {result.evaluated_at} | Rule Engine Version: {result.rule_version} | "
        f"Algorithm Mode: Deterministic Hard Constraints + Soft Scoring"
    )
