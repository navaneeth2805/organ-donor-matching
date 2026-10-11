"""Donor management interface for registration, search, filtering, and updates."""

from datetime import date, datetime
import pandas as pd
import streamlit as st
from config.settings import (
    AVAILABILITY_STATUSES,
    BLOOD_GROUPS,
    CROSSMATCH_STATUSES,
    ECG_STATUSES,
    INFECTIOUS_DISEASE_STATUSES,
    ORGAN_ASSESSMENT_STATUSES,
    ORGANS,
    SMOKING_STATUSES,
)
from modules.donor import DonorService
from modules.hospital import HospitalService
from modules.medical_profile import MedicalProfileService
from modules.recipient import RecipientService
from ui.components import render_empty_state, render_page_header, render_section_header
from ui.medical_profile_components import (
    render_cardiac_display,
    render_crossmatches_display,
    render_data_quality_display,
    render_hla_display,
    render_laboratory_display,
    render_medical_history_display,
    render_organ_assessments_display,
    render_vitals_display,
)
from utils.exceptions import DuplicateRecordError, ValidationError
from utils.export import export_donors_csv
from utils.helpers import format_display_id, parse_display_id
from visualization.medical_charts import (
    render_completeness_breakdown_chart,
    render_labs_trend_chart,
    render_vitals_trend_chart,
)


def render_donor_page(
    donor_service: DonorService,
    hospital_service: HospitalService,
    medical_profile_service: MedicalProfileService | None = None,
    recipient_service: RecipientService | None = None,
) -> None:
    """Render comprehensive donor management workspace."""
    render_page_header(
        title="Organ Donor Registry",
        description="Register donors, manage availability states, and evaluate clinical medical profiles and telemetry.",
    )

    # Fetch active hospitals for dropdown mapping
    hospitals = hospital_service.list_hospitals(active_only=True)
    hospital_options = {h.name: h.id for h in hospitals}
    hospital_id_to_name = {h.id: h.name for h in hospitals}

    tab_titles = ["📋 View & Search Donors", "➕ Add New Donor", "✏️ Edit / Delete Donor"]
    if medical_profile_service:
        tab_titles.append("🩺 Clinical Medical Profile")

    tabs = st.tabs(tab_titles)
    tab_view = tabs[0]
    tab_add = tabs[1]
    tab_edit = tabs[2]
    tab_med = tabs[3] if medical_profile_service else None


    # ---------------------------------------------------------
    # TAB 1: VIEW, FILTER, SEARCH & EXPORT
    # ---------------------------------------------------------
    with tab_view:
        # Search & Filter Controls Card
        with st.expander("🔍 Search & Filter Tools", expanded=True):
            col_s1, col_s2, col_s3 = st.columns([2, 1, 1])
            with col_s1:
                search_term = st.text_input("Search Donors", placeholder="Search by ID, Name, City, or Hospital...")
            with col_s2:
                filter_organ = st.selectbox("Filter by Organ", ["All"] + ORGANS)
            with col_s3:
                filter_blood = st.selectbox("Filter by Blood Group", ["All"] + BLOOD_GROUPS)

            col_f1, col_f2, col_f3, col_f4 = st.columns(4)
            with col_f1:
                filter_avail = st.selectbox("Filter Availability", ["All"] + AVAILABILITY_STATUSES)
            with col_f2:
                filter_hosp_name = st.selectbox("Filter Hospital", ["All"] + list(hospital_options.keys()))
            with col_f3:
                age_range = st.slider("Age Range", min_value=0, max_value=100, value=(0, 100))
            with col_f4:
                sort_col = st.selectbox(
                    "Sort By",
                    ["ID", "Name", "Age", "Blood Group", "Organ", "Hospital", "Availability", "Registration Date"],
                )
                sort_order = st.radio("Order", ["Ascending", "Descending"], horizontal=True)

        # Apply Filters
        selected_hosp_id = hospital_options.get(filter_hosp_name) if filter_hosp_name != "All" else None
        selected_organ = filter_organ if filter_organ != "All" else None
        selected_blood = filter_blood if filter_blood != "All" else None
        selected_avail = filter_avail if filter_avail != "All" else None

        # Execute query at repository layer
        donors = donor_service.filter_donors(
            hospital_id=selected_hosp_id,
            blood_group=selected_blood,
            organ=selected_organ,
            availability=selected_avail,
            min_age=age_range[0],
            max_age=age_range[1],
            search_term=search_term,
            sort_by=sort_col.lower().replace(" ", "_"),
            sort_asc=(sort_order == "Ascending"),
        )

        st.markdown(f"**Found {len(donors)} matching donor records**")

        if donors:
            table_rows = []
            for d in donors:
                table_rows.append({
                    "ID": d.id,
                    "Code": format_display_id("D", d.id),
                    "Name": d.name,
                    "Age": d.age,
                    "Blood Group": d.blood_group,
                    "Organ": d.organ,
                    "Hospital": d.hospital_name or hospital_id_to_name.get(d.hospital_id, "Unassigned"),
                    "Location": d.location,
                    "Availability": d.availability,
                    "Registration Date": d.registration_date,
                })
            df_display = pd.DataFrame(table_rows)
            st.dataframe(
                df_display[["Code", "Name", "Age", "Blood Group", "Organ", "Hospital", "Location", "Availability", "Registration Date"]],
                use_container_width=True,
                hide_index=True,
            )

            # Export Button
            csv_data = export_donors_csv(donors)
            st.download_button(
                label="📥 Download Donors CSV",
                data=csv_data,
                file_name=f"donors_export_{date.today().isoformat()}.csv",
                mime="text/csv",
            )
        else:
            render_empty_state("No donors found matching your search criteria.")

    # ---------------------------------------------------------
    # TAB 2: ADD DONOR FORM
    # ---------------------------------------------------------
    with tab_add:
        render_section_header("Register New Organ Donor", icon="📝")
        with st.form("add_donor_form", clear_on_submit=True):
            col_a1, col_a2 = st.columns(2)
            with col_a1:
                new_id_input = st.number_input(
                    "Donor ID (Unique Integer)",
                    min_value=1,
                    max_value=999999,
                    value=101,
                    step=1,
                    help="Unique numeric identifier for the donor.",
                )
                new_name = st.text_input("Full Legal Name *", placeholder="e.g. Eleanor Vance")
                new_age = st.number_input("Age (Years) *", min_value=0, max_value=120, value=35, step=1)
                new_blood = st.selectbox("Blood Group *", BLOOD_GROUPS, index=1)
                new_organ = st.selectbox("Donated Organ *", ORGANS, index=0)
            
            with col_a2:
                new_hosp_name = st.selectbox(
                    "Affiliated Hospital *",
                    list(hospital_options.keys()) if hospital_options else ["No active hospitals found"],
                )
                new_location = st.text_input("City / Location *", placeholder="e.g. New Delhi")
                new_availability = st.selectbox("Availability Status *", AVAILABILITY_STATUSES, index=0)
                new_phone = st.text_input("Contact Phone", placeholder="e.g. +91 9876543210")
                new_email = st.text_input("Contact Email", placeholder="e.g. eleanor@example.org")
                new_reg_date = st.date_input("Registration Date *", value=date.today())

            submitted = st.form_submit_button("✅ Register Donor", use_container_width=True)
            if submitted:
                if not hospital_options:
                    st.error("Cannot register donor without active hospitals. Please add a hospital first.")
                else:
                    selected_hid = hospital_options.get(new_hosp_name)
                    try:
                        donor_service.create_donor(
                            donor_id=int(new_id_input),
                            name=new_name,
                            age=int(new_age),
                            blood_group=new_blood,
                            organ=new_organ,
                            hospital_id=selected_hid,
                            location=new_location,
                            availability=new_availability,
                            phone=new_phone or None,
                            email=new_email or None,
                            registration_date=new_reg_date.isoformat(),
                        )
                        st.success(f"Donor '{new_name}' (ID: {new_id_input}) successfully registered!")
                        st.rerun()
                    except DuplicateRecordError as d_err:
                        st.error(f"Duplicate Error: {d_err}")
                    except ValidationError as v_err:
                        st.error(f"Validation Error: {v_err}")
                    except Exception as ex:
                        st.error(f"Unexpected Error: {ex}")

    # ---------------------------------------------------------
    # TAB 3: EDIT & DELETE DONOR
    # ---------------------------------------------------------
    with tab_edit:
        render_section_header("Update or Remove Donor Record", icon="⚙️")
        all_donors = donor_service.list_donors(sort_by="id", sort_asc=True)
        if not all_donors:
            render_empty_state("No donors currently available to edit.")
        else:
            donor_choice_map = {f"{format_display_id('D', d.id)} - {d.name} ({d.organ})": d.id for d in all_donors}
            selected_label = st.selectbox("Select Donor to Edit", list(donor_choice_map.keys()))
            selected_donor_id = donor_choice_map[selected_label]
            target_donor = donor_service.get_donor_by_id(selected_donor_id)

            # Edit Form
            with st.form("edit_donor_form"):
                col_e1, col_e2 = st.columns(2)
                with col_e1:
                    edit_name = st.text_input("Full Name *", value=target_donor.name)
                    edit_age = st.number_input("Age *", min_value=0, max_value=120, value=target_donor.age)
                    edit_blood = st.selectbox(
                        "Blood Group *",
                        BLOOD_GROUPS,
                        index=BLOOD_GROUPS.index(target_donor.blood_group) if target_donor.blood_group in BLOOD_GROUPS else 0,
                    )
                    edit_organ = st.selectbox(
                        "Organ *",
                        ORGANS,
                        index=ORGANS.index(target_donor.organ) if target_donor.organ in ORGANS else 0,
                    )
                with col_e2:
                    current_hosp_name = (
                        hospital_id_to_name.get(target_donor.hospital_id, list(hospital_options.keys())[0])
                        if hospital_options
                        else "None"
                    )
                    hosp_names_list = list(hospital_options.keys())
                    hosp_idx = hosp_names_list.index(current_hosp_name) if current_hosp_name in hosp_names_list else 0
                    edit_hosp = st.selectbox("Hospital *", hosp_names_list, index=hosp_idx)
                    edit_loc = st.text_input("City / Location *", value=target_donor.location)
                    edit_avail = st.selectbox(
                        "Availability Status *",
                        AVAILABILITY_STATUSES,
                        index=AVAILABILITY_STATUSES.index(target_donor.availability) if target_donor.availability in AVAILABILITY_STATUSES else 0,
                    )
                    edit_phone = st.text_input("Phone", value=target_donor.phone or "")
                    edit_email = st.text_input("Email", value=target_donor.email or "")

                save_changes = st.form_submit_button("💾 Save Changes", use_container_width=True)
                if save_changes:
                    try:
                        donor_service.update_donor(
                            donor_id=target_donor.id,
                            name=edit_name,
                            age=int(edit_age),
                            blood_group=edit_blood,
                            organ=edit_organ,
                            hospital_id=hospital_options.get(edit_hosp),
                            location=edit_loc,
                            availability=edit_avail,
                            phone=edit_phone or None,
                            email=edit_email or None,
                            registration_date=target_donor.registration_date,
                        )
                        st.success(f"Donor ID {target_donor.id} updated successfully.")
                        st.rerun()
                    except ValidationError as v_err:
                        st.error(f"Validation Error: {v_err}")
                    except Exception as ex:
                        st.error(f"Update failed: {ex}")

            # Delete Section with Confirmation
            st.markdown("---")
            render_section_header("Danger Zone", icon="⚠️")
            st.warning(f"Deleting donor {format_display_id('D', target_donor.id)} ({target_donor.name}) is irreversible.")
            col_del1, col_del2 = st.columns([3, 1])
            with col_del1:
                confirm_box = st.checkbox(
                    f"Yes, I confirm I want to permanently delete donor {format_display_id('D', target_donor.id)}.",
                    key=f"del_confirm_d_{target_donor.id}",
                )
            with col_del2:
                if st.button("🗑️ Delete Donor", type="primary", disabled=not confirm_box):
                    try:
                        donor_service.delete_donor(target_donor.id)
                        st.success(f"Donor {format_display_id('D', target_donor.id)} deleted successfully.")
                        st.rerun()
                    except Exception as ex:
                        st.error(f"Failed to delete donor: {ex}")

    # ---------------------------------------------------------
    # TAB 4: CLINICAL MEDICAL PROFILE & DIAGNOSTIC INTELLIGENCE
    # ---------------------------------------------------------
    if tab_med and medical_profile_service:
        with tab_med:
            render_section_header("Donor Clinical Health Intelligence & Comprehensive Diagnostics", icon="🩺")
            all_donors = donor_service.list_donors(sort_by="id", sort_asc=True)
            if not all_donors:
                render_empty_state("No donors registered yet.")
            else:
                d_choices = {f"{format_display_id('D', d.id)} - {d.name} ({d.organ}, {d.blood_group})": d.id for d in all_donors}
                sel_donor_label = st.selectbox("Select Donor to Review / Update", list(d_choices.keys()), key="med_donor_select")
                donor_id = d_choices[sel_donor_label]

                profile_bundle = medical_profile_service.get_complete_profile("DONOR", donor_id)
                render_data_quality_display(profile_bundle["quality_report"])

                med_sub1, med_sub2, med_sub3, med_sub4, med_sub5, med_sub6, med_sub7 = st.tabs([
                    "🫀 Vital Signs",
                    "🧪 Laboratory",
                    "❤️ Cardiac",
                    "📋 Medical History",
                    "🧬 HLA Typing",
                    "🫁 Organ Assessment",
                    "🔬 Crossmatches",
                ])

                # 1. VITALS
                with med_sub1:
                    render_vitals_display(profile_bundle["vitals"])
                    v_hist = medical_profile_service.vitals_service.get_history("DONOR", donor_id)
                    if len(v_hist) >= 2:
                        st.markdown("##### Longitudinal Vitals Telemetry")
                        render_vitals_trend_chart(v_hist)

                    with st.expander("➕ Record New Vital Signs Panel"):
                        with st.form(f"record_vitals_form_{donor_id}"):
                            cv1, cv2, cv3 = st.columns(3)
                            with cv1:
                                sys_bp = st.number_input("Systolic BP (mmHg) *", min_value=40, max_value=300, value=120)
                                dia_bp = st.number_input("Diastolic BP (mmHg) *", min_value=20, max_value=200, value=80)
                                hr = st.number_input("Heart Rate (bpm) *", min_value=20, max_value=300, value=72)
                            with cv2:
                                rr = st.number_input("Respiratory Rate (breaths/min) *", min_value=4, max_value=80, value=16)
                                temp = st.number_input("Temperature (°C) *", min_value=25.0, max_value=45.0, value=37.0, step=0.1)
                                spo2 = st.number_input("SpO2 (%) *", min_value=50.0, max_value=100.0, value=98.0, step=0.5)
                            with cv3:
                                ht = st.number_input("Height (cm) *", min_value=30.0, max_value=260.0, value=172.0, step=0.5)
                                wt = st.number_input("Weight (kg) *", min_value=1.0, max_value=400.0, value=70.0, step=0.5)
                                rec_d = st.date_input("Recording Date *", value=date.today(), key=f"v_date_{donor_id}")

                            v_submit = st.form_submit_button("💾 Save Vitals Recording", use_container_width=True)
                            if v_submit:
                                try:
                                    _, warns = medical_profile_service.vitals_service.record_vitals(
                                        entity_type="DONOR",
                                        entity_id=donor_id,
                                        systolic_bp=sys_bp,
                                        diastolic_bp=dia_bp,
                                        heart_rate=hr,
                                        respiratory_rate=rr,
                                        temperature=temp,
                                        spo2=spo2,
                                        height_cm=ht,
                                        weight_kg=wt,
                                        recorded_at=rec_d.isoformat(),
                                    )
                                    st.success(f"Vitals successfully saved for Donor ID {donor_id}.")
                                    for w in warns:
                                        st.warning(f"⚠️ {w}")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving vitals: {ex}")

                # 2. LABORATORY
                with med_sub2:
                    render_laboratory_display(profile_bundle["laboratory"])
                    l_hist = medical_profile_service.lab_service.get_history("DONOR", donor_id)
                    if len(l_hist) >= 2:
                        st.markdown("##### Biomarker Longitudinal Progression")
                        b_choice = st.selectbox(
                            "Select Biomarker to Plot",
                            ["creatinine", "egfr", "blood_glucose", "hemoglobin", "potassium", "ast", "alt"],
                            key=f"lab_plot_select_{donor_id}",
                        )
                        render_labs_trend_chart(l_hist, biomarker_key=b_choice)

                    with st.expander("➕ Record New Laboratory Results Panel"):
                        with st.form(f"record_lab_form_{donor_id}"):
                            st.caption("Enter clinical biomarkers (leave empty if not tested):")
                            cl1, cl2, cl3, cl4 = st.columns(4)
                            with cl1:
                                glu = st.text_input("Glucose (mg/dL)", placeholder="e.g. 95")
                                hba1c = st.text_input("HbA1c (%)", placeholder="e.g. 5.4")
                                cr = st.text_input("Creatinine (mg/dL)", placeholder="e.g. 0.9")
                                egfr = st.text_input("eGFR (mL/min)", placeholder="e.g. 98")
                            with cl2:
                                bun = st.text_input("BUN (mg/dL)", placeholder="e.g. 14")
                                na = st.text_input("Sodium (mEq/L)", placeholder="e.g. 140")
                                k = st.text_input("Potassium (mEq/L)", placeholder="e.g. 4.2")
                                ca = st.text_input("Calcium (mg/dL)", placeholder="e.g. 9.2")
                            with cl3:
                                hb = st.text_input("Hemoglobin (g/dL)", placeholder="e.g. 14.5")
                                wbc = st.text_input("WBC (x10³/µL)", placeholder="e.g. 6.8")
                                plt_val = st.text_input("Platelets (x10³/µL)", placeholder="e.g. 240")
                                inr = st.text_input("INR", placeholder="e.g. 1.0")
                            with cl4:
                                ast_val = st.text_input("AST (U/L)", placeholder="e.g. 25")
                                alt_val = st.text_input("ALT (U/L)", placeholder="e.g. 28")
                                bili = st.text_input("Bilirubin (mg/dL)", placeholder="e.g. 0.7")
                                alb = st.text_input("Albumin (g/dL)", placeholder="e.g. 4.2")

                            l_date = st.date_input("Laboratory Test Date *", value=date.today(), key=f"lab_d_{donor_id}")
                            l_submit = st.form_submit_button("💾 Save Laboratory Results", use_container_width=True)

                            if l_submit:
                                lab_payload = {
                                    "blood_glucose": glu.strip() or None,
                                    "hba1c": hba1c.strip() or None,
                                    "creatinine": cr.strip() or None,
                                    "egfr": egfr.strip() or None,
                                    "bun": bun.strip() or None,
                                    "sodium": na.strip() or None,
                                    "potassium": k.strip() or None,
                                    "calcium": ca.strip() or None,
                                    "hemoglobin": hb.strip() or None,
                                    "wbc": wbc.strip() or None,
                                    "platelets": plt_val.strip() or None,
                                    "inr": inr.strip() or None,
                                    "ast": ast_val.strip() or None,
                                    "alt": alt_val.strip() or None,
                                    "bilirubin": bili.strip() or None,
                                    "albumin": alb.strip() or None,
                                }
                                try:
                                    _, l_alerts = medical_profile_service.lab_service.record_laboratory_results(
                                        entity_type="DONOR",
                                        entity_id=donor_id,
                                        results_data=lab_payload,
                                        test_date=l_date.isoformat(),
                                    )
                                    st.success(f"Laboratory panel saved for Donor ID {donor_id}.")
                                    for al in l_alerts:
                                        st.warning(f"⚠️ {al}")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving lab panel: {ex}")

                # 3. CARDIAC
                with med_sub3:
                    render_cardiac_display(profile_bundle["cardiac"])
                    with st.expander("➕ Record Cardiac Assessment"):
                        with st.form(f"record_cardiac_form_{donor_id}"):
                            cc1, cc2 = st.columns(2)
                            with cc1:
                                ecg_st = st.selectbox("12-Lead ECG Status *", ECG_STATUSES, index=0)
                                ecg_findings = st.text_area("ECG Rhythm & Morphological Findings", placeholder="e.g. Normal sinus rhythm, normal axis, no ST-T changes.")
                                c_hr = st.text_input("Heart Rate during ECG (bpm)", placeholder="e.g. 72")
                                echo_avail = st.checkbox("Echocardiogram Completed", value=True)
                                ef_val = st.text_input("Left Ventricular Ejection Fraction (%)", placeholder="e.g. 60")
                            with cc2:
                                pr_int = st.text_input("PR Interval (ms)", placeholder="e.g. 150")
                                qrs_dur = st.text_input("QRS Duration (ms)", placeholder="e.g. 90")
                                qt_int = st.text_input("QT Interval (ms)", placeholder="e.g. 380")
                                qtc_val = st.text_input("QTc Interval (ms)", placeholder="e.g. 410")
                                c_date = st.date_input("Assessment Date *", value=date.today(), key=f"c_date_{donor_id}")

                            c_submit = st.form_submit_button("💾 Save Cardiac Assessment", use_container_width=True)
                            if c_submit:
                                c_data = {
                                    "ecg_status": ecg_st,
                                    "ecg_findings": ecg_findings.strip() or None,
                                    "heart_rate": c_hr.strip() or None,
                                    "pr_interval": pr_int.strip() or None,
                                    "qrs_duration": qrs_dur.strip() or None,
                                    "qt_interval": qt_int.strip() or None,
                                    "qtc": qtc_val.strip() or None,
                                    "echocardiogram_available": 1 if echo_avail else 0,
                                    "ejection_fraction": ef_val.strip() or None,
                                }
                                try:
                                    _, c_alerts = medical_profile_service.cardiac_service.record_cardiac_assessment(
                                        entity_type="DONOR",
                                        entity_id=donor_id,
                                        cardiac_data=c_data,
                                        assessment_date=c_date.isoformat(),
                                    )
                                    st.success("Cardiac assessment recorded.")
                                    for al in c_alerts:
                                        st.warning(f"⚠️ {al}")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving cardiac record: {ex}")

                # 4. MEDICAL HISTORY
                with med_sub4:
                    render_medical_history_display(profile_bundle["history"])
                    with st.expander("➕ Update Medical History & Infection Screening"):
                        with st.form(f"record_history_form_{donor_id}"):
                            st.markdown("###### Systemic Comorbidities")
                            ch1, ch2, ch3 = st.columns(3)
                            with ch1:
                                diab = st.checkbox("Diabetes Mellitus")
                                htn = st.checkbox("Hypertension")
                                hd = st.checkbox("Cardiovascular Disease")
                            with ch2:
                                kd = st.checkbox("Renal Disease / CKD")
                                ld = st.checkbox("Hepatic Disease")
                                lung_d = st.checkbox("Chronic Lung Disease")
                            with ch3:
                                cancer = st.checkbox("History of Malignancy / Cancer")

                            ch4, ch5 = st.columns(2)
                            with ch4:
                                inf_st = st.selectbox("Infectious Disease Screening *", INFECTIOUS_DISEASE_STATUSES)
                                smk_st = st.selectbox("Smoking Status *", SMOKING_STATUSES)
                            with ch5:
                                meds = st.text_input("Current Medication Regimen", placeholder="e.g. Multivitamins, no active prescription drugs.")
                                surg = st.text_input("Prior Surgical Procedures", placeholder="e.g. Appendectomy (2018).")

                            hist_notes = st.text_area("Clinical Notes & Physician Remarks", placeholder="e.g. Donor cleared for procurement evaluation.")
                            h_date = st.date_input("Assessment Date *", value=date.today(), key=f"h_date_{donor_id}")
                            h_submit = st.form_submit_button("💾 Save Medical History", use_container_width=True)

                            if h_submit:
                                h_payload = {
                                    "diabetes": diab,
                                    "hypertension": htn,
                                    "heart_disease": hd,
                                    "kidney_disease": kd,
                                    "liver_disease": ld,
                                    "lung_disease": lung_d,
                                    "cancer_history": cancer,
                                    "infectious_disease_status": inf_st,
                                    "smoking_status": smk_st,
                                    "medication_history": meds.strip() or None,
                                    "previous_surgery": surg.strip() or None,
                                    "notes": hist_notes.strip() or None,
                                }
                                try:
                                    _, h_warns = medical_profile_service.history_service.record_medical_history(
                                        entity_type="DONOR",
                                        entity_id=donor_id,
                                        history_data=h_payload,
                                        assessment_date=h_date.isoformat(),
                                    )
                                    st.success("Medical history saved.")
                                    for w in h_warns:
                                        st.warning(f"⚠️ {w}")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving history: {ex}")

                # 5. HLA IMMUNOLOGY
                with med_sub5:
                    render_hla_display(profile_bundle["hla"])
                    with st.expander("➕ Record HLA Genotyping Profile"):
                        with st.form(f"record_hla_form_{donor_id}"):
                            st.caption("Specify alleles for Major Histocompatibility Complex loci:")
                            chla1, chla2, chla3 = st.columns(3)
                            with chla1:
                                a_locus = st.text_input("HLA-A *", placeholder="e.g. A*02:01, A*24:02")
                                b_locus = st.text_input("HLA-B *", placeholder="e.g. B*07:02, B*44:02")
                            with chla2:
                                c_locus = st.text_input("HLA-C", placeholder="e.g. C*07:01, C*04:01")
                                dr_locus = st.text_input("HLA-DR *", placeholder="e.g. DRB1*04:01, DRB1*15:01")
                            with chla3:
                                dq_locus = st.text_input("HLA-DQ", placeholder="e.g. DQB1*03:01, DQB1*06:02")
                                antibody_info = st.text_input("Panel Reactive Antibodies (PRA %)", placeholder="e.g. PRA 0% (Unsensitized)")

                            hla_date = st.date_input("Genotype Date *", value=date.today(), key=f"hla_d_{donor_id}")
                            hla_submit = st.form_submit_button("💾 Save HLA Profile", use_container_width=True)

                            if hla_submit:
                                try:
                                    medical_profile_service.hla_service.record_hla(
                                        entity_type="DONOR",
                                        entity_id=donor_id,
                                        hla_a=a_locus.strip() or None,
                                        hla_b=b_locus.strip() or None,
                                        hla_c=c_locus.strip() or None,
                                        hla_dr=dr_locus.strip() or None,
                                        hla_dq=dq_locus.strip() or None,
                                        antibody_information=antibody_info.strip() or None,
                                        test_date=hla_date.isoformat(),
                                    )
                                    st.success(f"HLA Genotype profile recorded for Donor ID {donor_id}.")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving HLA profile: {ex}")

                # 6. ORGAN PROCUREMENT ASSESSMENT
                with med_sub6:
                    render_organ_assessments_display(profile_bundle["organ_assessments"])
                    with st.expander("➕ Record Organ Procurement Suitability"):
                        with st.form(f"record_organ_form_{donor_id}"):
                            co1, co2 = st.columns(2)
                            with co1:
                                target_organ = st.selectbox("Target Organ *", ORGANS)
                                org_status = st.selectbox("Assessment Status *", ORGAN_ASSESSMENT_STATUSES)
                            with co2:
                                org_notes = st.text_area("Surgical / Procurement Notes", placeholder="e.g. Normal anatomical vascularization, biopsy benign, organ cleared.")
                                org_date = st.date_input("Assessment Date *", value=date.today(), key=f"oa_d_{donor_id}")

                            org_submit = st.form_submit_button("💾 Save Organ Assessment", use_container_width=True)
                            if org_submit:
                                try:
                                    medical_profile_service.organ_service.record_organ_assessment(
                                        donor_id=donor_id,
                                        organ=target_organ,
                                        assessment_status=org_status,
                                        assessment_notes=org_notes.strip() or None,
                                        assessment_date=org_date.isoformat(),
                                    )
                                    st.success(f"Organ assessment for {target_organ} recorded.")
                                    st.rerun()
                                except ValidationError as ve:
                                    st.error(f"Validation Error: {ve}")
                                except Exception as ex:
                                    st.error(f"Error saving organ assessment: {ex}")

                # 7. CROSSMATCHES
                with med_sub7:
                    render_crossmatches_display(profile_bundle["crossmatches"])
                    if recipient_service:
                        with st.expander("➕ Log Prospective / Virtual Crossmatch with Recipient"):
                            recips = recipient_service.list_recipients(sort_by="id", sort_asc=True)
                            if not recips:
                                st.info("No recipients available to pair for crossmatch.")
                            else:
                                r_map = {f"{format_display_id('R', r.id)} - {r.name} ({r.organ_needed}, {r.blood_group})": r.id for r in recips}
                                with st.form(f"crossmatch_form_d_{donor_id}"):
                                    cx1, cx2 = st.columns(2)
                                    with cx1:
                                        sel_r_label = st.selectbox("Select Target Recipient *", list(r_map.keys()))
                                        xm_res = st.selectbox("Crossmatch Outcome *", CROSSMATCH_STATUSES)
                                    with cx2:
                                        xm_ab = st.text_input("Antibody / Flow Cytometry Info", placeholder="e.g. T-cell / B-cell flow cytometry negative.")
                                        xm_notes = st.text_input("Notes", placeholder="e.g. Immunological clearance approved.")
                                        xm_date = st.date_input("Crossmatch Date *", value=date.today(), key=f"xm_d_{donor_id}")

                                    xm_submit = st.form_submit_button("💾 Save Crossmatch Test Result", use_container_width=True)
                                    if xm_submit:
                                        target_recip_id = r_map[sel_r_label]
                                        try:
                                            medical_profile_service.crossmatch_service.record_crossmatch(
                                                donor_id=donor_id,
                                                recipient_id=target_recip_id,
                                                result=xm_res,
                                                antibody_information=xm_ab.strip() or None,
                                                test_date=xm_date.isoformat(),
                                                notes=xm_notes.strip() or None,
                                            )
                                            st.success("Crossmatch test result recorded.")
                                            st.rerun()
                                        except ValidationError as ve:
                                            st.error(f"Validation Error: {ve}")
                                        except Exception as ex:
                                            st.error(f"Error recording crossmatch: {ex}")

