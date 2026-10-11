"""Dashboard view presenting network statistics, clinical breakdowns, and recent activity."""

import pandas as pd
import streamlit as st
from modules.analytics import AnalyticsService
from modules.data_quality import DataQualityService
from modules.donor import DonorService
from modules.recipient import RecipientService
from ui.components import (
    render_empty_state,
    render_page_header,
    render_section_header,
    render_stat_card,
)
from utils.constants import (
    COLOR_DANGER,
    COLOR_PRIMARY,
    COLOR_SECONDARY,
    COLOR_SUCCESS,
    COLOR_WARNING,
)
from utils.helpers import format_display_id
from visualization.dashboard_components import (
    render_availability_pie_chart,
    render_blood_group_chart,
    render_organ_distribution_chart,
    render_registration_trend_chart,
    render_urgency_chart,
)


def render_dashboard_page(
    analytics_service: AnalyticsService,
    donor_service: DonorService,
    recipient_service: RecipientService,
    data_quality_service: DataQualityService | None = None,
) -> None:
    """Render the central operations overview dashboard."""
    render_page_header(
        title="Network Operations Dashboard",
        description="Real-time clinical metrics, donor/recipient supply-demand distributions, and medical data readiness.",
    )

    # Core Stat Cards Grid
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    
    total_donors = analytics_service.get_total_donors()
    total_recipients = analytics_service.get_total_recipients()
    total_hospitals = analytics_service.get_total_hospitals(active_only=True)
    avail_donors = analytics_service.get_available_donors()
    pending_donors = analytics_service.get_pending_donors()
    crit_recipients = analytics_service.get_critical_recipients()

    with col1:
        render_stat_card("Total Donors", total_donors, "Registered donors", "👤", COLOR_PRIMARY)
    with col2:
        render_stat_card("Total Recipients", total_recipients, "Transplant waitlist", "🧑‍⚕️", COLOR_SECONDARY)
    with col3:
        render_stat_card("Active Hospitals", total_hospitals, "Partner centers", "🏥", "#4F46E5")
    with col4:
        render_stat_card("Available Donors", avail_donors, "Ready for evaluation", "🟢", COLOR_SUCCESS)
    with col5:
        render_stat_card("Pending Donors", pending_donors, "Assessment underway", "🟡", COLOR_WARNING)
    with col6:
        render_stat_card("Critical Recipients", crit_recipients, "Urgent clinical priority", "🚨", COLOR_DANGER)

    st.markdown("<br>", unsafe_allow_html=True)

    # Phase 2 Clinical Engine Status Banner
    st.info(
        "🩺 **Phase 2 Medical Profile Engine Active**: Clinical data validation, vital sign telemetry, biomarker alerting, "
        "12-lead ECG/echocardiogram telemetry, HLA typing, and data quality scoring are active across all donor and recipient records. "
        "Bipartite graph optimization (Hopcroft-Karp / Edmonds-Karp maximum flow) will build upon these verified profiles in Phase 3/4.",
        icon="✅",
    )

    # Phase 2 Data Quality Overview Card
    if data_quality_service and (total_donors > 0 or total_recipients > 0):
        render_section_header("Network Clinical Profile Completeness & Readiness", icon="🩺")
        dq_stats = data_quality_service.evaluate_network_data_quality()

        dq_col1, dq_col2, dq_col3, dq_col4 = st.columns(4)
        with dq_col1:
            render_stat_card("Data Completeness", f"{dq_stats['overall_network_avg_score']}%", "Network average", "📈", "#0284C7")
        with dq_col2:
            render_stat_card("Donor Readiness", f"{dq_stats['donor_avg_score']}%", "Avg completeness", "👤", "#1E40AF")
        with dq_col3:
            render_stat_card("Recipient Readiness", f"{dq_stats['recipient_avg_score']}%", "Avg completeness", "🧑‍⚕️", "#0D9488")
        with dq_col4:
            render_stat_card(
                "Completed Profiles",
                f"{dq_stats['completed_profiles_count']}/{dq_stats['total_entities_evaluated']}",
                "≥80% data complete",
                "📋",
                "#16A34A" if dq_stats["completed_profiles_count"] > 0 else "#64748B",
            )

        fresh_b = dq_stats.get("freshness_breakdown", {})
        st.markdown(
            f"""
            <div style="background-color: #1E293B; border: 1px solid #334155; border-radius: 8px; padding: 12px 18px; margin: 12px 0 20px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="font-size: 0.85rem; color: #94A3B8; font-weight: 600;">Clinical Freshness Distribution:</div>
                    <div style="display: flex; gap: 16px; font-size: 0.82rem;">
                        <span style="color: #34D399;">● Current (≤30d): <b>{fresh_b.get('Current', 0)}</b></span>
                        <span style="color: #FBBF24;">● Recent (31-90d): <b>{fresh_b.get('Recent', 0)}</b></span>
                        <span style="color: #F87171;">● Needs Update (>90d): <b>{fresh_b.get('Needs Update', 0)}</b></span>
                        <span style="color: #94A3B8;">● Unassessed: <b>{fresh_b.get('No Assessment', 0)}</b></span>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


    # Charts: Two-column grid
    render_section_header("Clinical Distribution Analysis", icon="📊")
    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:
        df_donor_organs = analytics_service.get_donors_by_organ()
        render_organ_distribution_chart(df_donor_organs, title="Donors by Organ", color="#1E40AF")

    with chart_col2:
        df_recip_organs = analytics_service.get_recipients_by_organ()
        render_organ_distribution_chart(df_recip_organs, title="Recipients by Organ Needed", color="#0284C7")

    chart_col3, chart_col4 = st.columns(2)

    with chart_col3:
        df_donor_bg = analytics_service.get_donors_by_blood_group()
        render_blood_group_chart(df_donor_bg, title="Donors by Blood Group")

    with chart_col4:
        df_recip_urg = analytics_service.get_recipients_by_urgency()
        render_urgency_chart(df_recip_urg)

    # Donut & Timeline Trend
    chart_col5, chart_col6 = st.columns([1, 2])

    with chart_col5:
        df_avail = analytics_service.get_donor_availability_distribution()
        render_availability_pie_chart(df_avail)

    with chart_col6:
        df_trend = analytics_service.get_registration_trend()
        render_registration_trend_chart(df_trend)

    st.markdown("<br>", unsafe_allow_html=True)

    # Recent Registrations
    render_section_header("Recent Network Activity", icon="⏱️")
    tab_donors, tab_recipients = st.tabs(["Latest Donors", "Latest Recipients"])

    with tab_donors:
        latest_donors = donor_service.list_donors(sort_by="id", sort_asc=False, limit=8)
        if latest_donors:
            donor_table_data = [
                {
                    "Display ID": format_display_id("D", d.id),
                    "Name": d.name,
                    "Age": d.age,
                    "Blood Group": d.blood_group,
                    "Organ": d.organ,
                    "Hospital": d.hospital_name or f"ID #{d.hospital_id}" if d.hospital_id else "Unassigned",
                    "Location": d.location,
                    "Availability": d.availability,
                    "Registration Date": d.registration_date,
                }
                for d in latest_donors
            ]
            st.dataframe(pd.DataFrame(donor_table_data), use_container_width=True, hide_index=True)
        else:
            render_empty_state("No registered donors found.", "Add donors to populate the activity feed.")

    with tab_recipients:
        latest_recipients = recipient_service.list_recipients(sort_by="id", sort_asc=False, limit=8)
        if latest_recipients:
            recip_table_data = [
                {
                    "Display ID": format_display_id("R", r.id),
                    "Name": r.name,
                    "Age": r.age,
                    "Blood Group": r.blood_group,
                    "Organ Needed": r.organ_needed,
                    "Urgency": r.urgency,
                    "Waiting (Days)": r.waiting_time_days,
                    "Hospital": r.hospital_name or f"ID #{r.hospital_id}" if r.hospital_id else "Unassigned",
                    "Location": r.location,
                    "Registration Date": r.registration_date,
                }
                for r in latest_recipients
            ]
            st.dataframe(pd.DataFrame(recip_table_data), use_container_width=True, hide_index=True)
        else:
            render_empty_state("No registered recipients found.", "Add recipients to populate the activity feed.")
