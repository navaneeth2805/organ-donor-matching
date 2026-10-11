"""Medical Profiles view providing comprehensive clinical profile inspection and synchronization."""

import streamlit as st

from modules.donor import DonorService
from modules.medical_profile import MedicalProfileService
from modules.recipient import RecipientService
from ui.components import render_empty_state, render_page_header, render_section_header
from ui.medical_profile_components import (
    render_cardiac_panel,
    render_crossmatch_panel,
    render_data_quality_display,
    render_hla_panel,
    render_laboratory_panel,
    render_medical_history_panel,
    render_organ_assessment_panel,
    render_vitals_panel,
)


def render_medical_profiles_page(
    medical_profile_service: MedicalProfileService,
    donor_service: DonorService,
    recipient_service: RecipientService,
) -> None:
    """Render the central clinical medical profile registry and diagnostic workstation."""
    render_page_header(
        title="Medical Profiles & Diagnostic Workstation",
        description="Review and maintain specialized clinical assessments, immunogenetics (HLA/Crossmatch), organ viability, hemodynamics, and laboratory profiles.",
    )

    tab_donors, tab_recips = st.tabs(["👤 Donor Medical Profiles", "🧑‍⚕️ Recipient Medical Profiles"])

    with tab_donors:
        donors = donor_service.get_all_donors(limit=500)
        if not donors:
            render_empty_state(
                "No Donors Registered",
                "Please register a donor first to view or update their medical diagnostic profile.",
                "👤",
            )
        else:
            donor_opts = {f"D{d.id} - {d.name} ({d.organ_type}, {d.blood_group})": d.id for d in donors if d.id}
            sel_label = st.selectbox("Select Donor to Inspect", list(donor_opts.keys()), key="sel_med_donor")
            sel_id = donor_opts[sel_label]

            profile = medical_profile_service.get_full_profile("DONOR", sel_id)
            if profile and profile.data_quality_report:
                render_data_quality_display(profile.data_quality_report)

            if profile:
                t1, t2, t3, t4, t5, t6, t7 = st.tabs([
                    "Vital Signs",
                    "Laboratory",
                    "Cardiac Assessment",
                    "Organ Viability",
                    "HLA Immunogenetics",
                    "Crossmatch History",
                    "Medical History",
                ])
                with t1:
                    render_vitals_panel(profile.vital_signs)
                with t2:
                    render_laboratory_panel(profile.laboratory_results)
                with t3:
                    render_cardiac_panel(profile.cardiac_assessment)
                with t4:
                    render_organ_assessment_panel(profile.organ_assessment)
                with t5:
                    render_hla_panel(profile.hla_profile)
                with t6:
                    render_crossmatch_panel(profile.crossmatch_results)
                with t7:
                    render_medical_history_panel(profile.medical_history)

    with tab_recips:
        recipients = recipient_service.get_all_recipients(limit=500)
        if not recipients:
            render_empty_state(
                "No Recipients Registered",
                "Please register a recipient first to view or update their clinical profile.",
                "🧑‍⚕️",
            )
        else:
            recip_opts = {f"R{r.id} - {r.name} ({r.organ_needed}, {r.blood_group})": r.id for r in recipients if r.id}
            sel_label = st.selectbox("Select Recipient to Inspect", list(recip_opts.keys()), key="sel_med_recip")
            sel_id = recip_opts[sel_label]

            profile = medical_profile_service.get_full_profile("RECIPIENT", sel_id)
            if profile and profile.data_quality_report:
                render_data_quality_display(profile.data_quality_report)

            if profile:
                t1, t2, t3, t4, t5, t6, t7 = st.tabs([
                    "Vital Signs",
                    "Laboratory",
                    "Cardiac Assessment",
                    "Organ Assessment",
                    "HLA Profile",
                    "Crossmatch History",
                    "Medical History",
                ])
                with t1:
                    render_vitals_panel(profile.vital_signs)
                with t2:
                    render_laboratory_panel(profile.laboratory_results)
                with t3:
                    render_cardiac_panel(profile.cardiac_assessment)
                with t4:
                    render_organ_assessment_panel(profile.organ_assessment)
                with t5:
                    render_hla_panel(profile.hla_profile)
                with t6:
                    render_crossmatch_panel(profile.crossmatch_results)
                with t7:
                    render_medical_history_panel(profile.medical_history)
