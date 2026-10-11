"""Medical profile presentation components, clinical indicators, and diagnostic panels."""

import pandas as pd
import streamlit as st
from config.settings import (
    CROSSMATCH_STATUSES,
    ECG_STATUSES,
    INFECTIOUS_DISEASE_STATUSES,
    ORGAN_ASSESSMENT_STATUSES,
    ORGANS,
    SMOKING_STATUSES,
)
from database.models import (
    CardiacAssessment,
    CrossmatchResult,
    HLAProfile,
    LaboratoryResults,
    MedicalHistory,
    OrganAssessment,
    VitalSigns,
)
from modules.data_quality import DataQualityReport
from ui.components import render_empty_state, render_section_header
from utils.helpers import current_date


def render_data_quality_display(report: DataQualityReport) -> None:
    """Render completeness gauge, freshness tag, and missing data points."""
    # Freshness tag color
    f_bg, f_color = "#DCFCE7", "#15803D"
    if report.freshness_status == "Recent":
        f_bg, f_color = "#FEF3C7", "#B45309"
    elif report.freshness_status in ("Needs Update", "No Assessment"):
        f_bg, f_color = "#FEE2E2", "#B91C1C"

    # Completeness badge color
    score = report.overall_score
    s_color = "#16A34A" if score >= 80.0 else ("#D97706" if score >= 50.0 else "#DC2626")

    st.markdown(
        f"""
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin-bottom: 1.2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <span style="font-size: 0.82rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Clinical Profile Integrity</span>
                    <h3 style="margin: 2px 0 0 0; font-size: 1.25rem; font-weight: 800; color: #0F172A;">{report.entity_name}</h3>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="background: {f_bg}; color: {f_color}; font-weight: 700; font-size: 0.78rem; padding: 4px 12px; border-radius: 9999px;">
                        Freshness: {report.freshness_status}
                    </span>
                    <span style="background: #F1F5F9; color: {s_color}; font-weight: 800; font-size: 1.1rem; padding: 4px 12px; border-radius: 8px; border: 1px solid #CBD5E1;">
                        {report.overall_score}% Complete
                    </span>
                </div>
            </div>
            <div style="width: 100%; background-color: #E2E8F0; height: 9px; border-radius: 9999px; overflow: hidden; margin-bottom: 14px;">
                <div style="width: {min(max(report.overall_score, 0), 100)}%; background-color: {s_color}; height: 100%; border-radius: 9999px;"></div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        """,
        unsafe_allow_html=True,
    )

    # Subcategory chips
    cols = st.columns(len(report.completeness_by_category))
    for idx, (cat_name, cat_val) in enumerate(report.completeness_by_category.items()):
        c_color = "#16A34A" if cat_val >= 80 else ("#D97706" if cat_val >= 50 else "#DC2626")
        with cols[idx]:
            st.markdown(
                f"""
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px; text-align: center;">
                    <div style="font-size: 0.72rem; font-weight: 600; color: #64748B;">{cat_name}</div>
                    <div style="font-size: 1rem; font-weight: 800; color: {c_color};">{cat_val:.0f}%</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    if report.clinical_flags:
        st.markdown("<div style='margin-top: 12px;'>", unsafe_allow_html=True)
        for flag in report.clinical_flags:
            st.warning(f"⚠️ {flag}")
        st.markdown("</div>", unsafe_allow_html=True)

    if report.missing_fields:
        with st.expander(f"⚠️ Missing Clinical Fields ({len(report.missing_fields)})"):
            for m in report.missing_fields:
                st.markdown(f"- 🔸 <span style='color: #475569;'>{m}</span>", unsafe_allow_html=True)


def render_vitals_display(vitals: VitalSigns | None) -> None:
    """Render vitals metrics cards and telemetry summary."""
    if not vitals:
        render_empty_state("No Vital Signs Recorded", "Record baseline vital signs and physical biometrics.")
        return

    # Blood pressure status
    sys = vitals.systolic_bp or 0
    dia = vitals.diastolic_bp or 0
    bp_status = "Normal"
    bp_bg, bp_color = "#DCFCE7", "#15803D"
    if sys >= 140 or dia >= 90:
        bp_status = "Stage 2 HTN"
        bp_bg, bp_color = "#FEE2E2", "#B91C1C"
    elif sys >= 130 or dia >= 80:
        bp_status = "Stage 1 HTN"
        bp_bg, bp_color = "#FEF3C7", "#B45309"
    elif sys < 90 or dia < 60:
        bp_status = "Hypotension"
        bp_bg, bp_color = "#E0F2FE", "#0369A1"

    # BMI Category
    bmi = vitals.bmi or 0.0
    bmi_status = "Normal"
    bmi_bg, bmi_color = "#DCFCE7", "#15803D"
    if bmi < 18.5:
        bmi_status = "Underweight"
        bmi_bg, bmi_color = "#E0F2FE", "#0369A1"
    elif 25.0 <= bmi < 30.0:
        bmi_status = "Overweight"
        bmi_bg, bmi_color = "#FEF3C7", "#B45309"
    elif bmi >= 30.0:
        bmi_status = "Obese"
        bmi_bg, bmi_color = "#FEE2E2", "#B91C1C"

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Blood Pressure</div>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0F172A; margin: 4px 0;">{sys:.0f} / {dia:.0f} <span style="font-size: 0.75rem; color: #64748B;">mmHg</span></div>
                <span style="background: {bp_bg}; color: {bp_color}; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">{bp_status}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c2:
        hr = vitals.heart_rate or 0
        hr_bg, hr_color = ("#DCFCE7", "#15803D") if 60 <= hr <= 100 else ("#FEF3C7", "#B45309")
        hr_status = "Normal" if 60 <= hr <= 100 else ("Bradycardia" if hr < 60 else "Tachycardia")
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Heart Rate</div>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0F172A; margin: 4px 0;">{hr:.0f} <span style="font-size: 0.75rem; color: #64748B;">bpm</span></div>
                <span style="background: {hr_bg}; color: {hr_color}; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">{hr_status}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c3:
        spo2 = vitals.spo2 or 0.0
        sp_bg, sp_color = ("#DCFCE7", "#15803D") if spo2 >= 95.0 else (("#FEF3C7", "#B45309") if spo2 >= 92.0 else ("#FEE2E2", "#B91C1C"))
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Oxygen Saturation</div>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0F172A; margin: 4px 0;">{spo2:.1f}%</div>
                <span style="background: {sp_bg}; color: {sp_color}; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">SpO2</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c4:
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Body Mass Index</div>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0F172A; margin: 4px 0;">{bmi:.1f} <span style="font-size: 0.75rem; color: #64748B;">kg/m²</span></div>
                <span style="background: {bmi_bg}; color: {bmi_color}; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">{bmi_status}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Details sub-row
    c5, c6, c7, c8 = st.columns(4)
    with c5:
        st.caption(f"**Temperature:** {vitals.temperature:.1f} °C" if vitals.temperature else "**Temperature:** —")
    with c6:
        st.caption(f"**Resp Rate:** {vitals.respiratory_rate:.0f} /min" if vitals.respiratory_rate else "**Resp Rate:** —")
    with c7:
        ht = f"{vitals.height_cm:.0f} cm" if vitals.height_cm else "—"
        wt = f"{vitals.weight_kg:.1f} kg" if vitals.weight_kg else "—"
        st.caption(f"**Height / Weight:** {ht} | {wt}")
    with c8:
        st.caption(f"**Recorded:** {vitals.recorded_at[:10]}" if vitals.recorded_at else "**Recorded:** —")


def render_laboratory_display(labs: LaboratoryResults | None) -> None:
    """Render laboratory biomarker panel with reference ranges and status indicators."""
    if not labs:
        render_empty_state("No Laboratory Results", "Submit clinical blood panels and organ function tests.")
        return

    # Biomarker definitions
    defs = [
        ("Serum Creatinine", labs.creatinine, "mg/dL", 0.6, 1.2, "Renal"),
        ("eGFR", labs.egfr, "mL/min/1.73m²", 60.0, 120.0, "Renal"),
        ("Blood Urea Nitrogen (BUN)", labs.bun, "mg/dL", 7.0, 20.0, "Renal"),
        ("Blood Glucose", labs.blood_glucose, "mg/dL", 70.0, 140.0, "Glycemic"),
        ("HbA1c", labs.hba1c, "%", 4.0, 5.6, "Glycemic"),
        ("Hemoglobin", labs.hemoglobin, "g/dL", 12.0, 17.5, "Hematology"),
        ("White Blood Cells (WBC)", labs.wbc, "x10³/µL", 4.5, 11.0, "Hematology"),
        ("Platelets", labs.platelets, "x10³/µL", 150.0, 450.0, "Hematology"),
        ("INR", labs.inr, "ratio", 0.8, 1.2, "Hematology"),
        ("Sodium", labs.sodium, "mEq/L", 135.0, 145.0, "Electrolytes"),
        ("Potassium", labs.potassium, "mEq/L", 3.5, 5.0, "Electrolytes"),
        ("Calcium", labs.calcium, "mg/dL", 8.5, 10.5, "Electrolytes"),
        ("AST (SGOT)", labs.ast, "U/L", 10.0, 40.0, "Hepatic"),
        ("ALT (SGPT)", labs.alt, "U/L", 7.0, 56.0, "Hepatic"),
        ("Total Bilirubin", labs.bilirubin, "mg/dL", 0.2, 1.2, "Hepatic"),
        ("Albumin", labs.albumin, "g/dL", 3.5, 5.0, "Hepatic"),
    ]

    rows: list[dict[str, Any]] = []
    for name, val, unit, low, high, category in defs:
        if val is None:
            continue
        status = "Normal"
        status_color = "#16A34A"
        if val < low:
            status = "Low"
            status_color = "#2563EB"
        elif val > high:
            status = "Elevated"
            status_color = "#DC2626"

        rows.append({
            "Panel": category,
            "Biomarker": name,
            "Result": f"{val:.2f} {unit}",
            "Reference Range": f"{low} - {high} {unit}",
            "Status": status,
        })

    if not rows:
        render_empty_state("No Biomarkers Logged", "All biomarker parameters currently unrecorded.")
        return

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)
    st.caption(f"Laboratory Panel Date: **{labs.test_date}**")


def render_cardiac_display(cardiac: CardiacAssessment | None) -> None:
    """Render cardiac assessment findings, ECG intervals, and ejection fraction."""
    if not cardiac:
        render_empty_state("No Cardiac Assessment Recorded", "Record 12-lead ECG, telemetry intervals, and echocardiogram.")
        return

    ecg_status = cardiac.ecg_status or "Not Assessed"
    ecg_bg, ecg_color = "#DCFCE7", "#15803D"
    if ecg_status == "Abnormal":
        ecg_bg, ecg_color = "#FEE2E2", "#B91C1C"
    elif ecg_status == "Borderline":
        ecg_bg, ecg_color = "#FEF3C7", "#B45309"

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">ECG Interpretation</div>
                <div style="margin: 6px 0;">
                    <span style="background: {ecg_bg}; color: {ecg_color}; font-weight: 800; font-size: 0.85rem; padding: 4px 10px; border-radius: 9999px;">
                        {ecg_status}
                    </span>
                </div>
                <div style="font-size: 0.82rem; color: #475569; margin-top: 6px;">{cardiac.ecg_findings or 'No specific rhythm disturbances noted.'}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c2:
        ef = f"{cardiac.ejection_fraction:.0f}%" if cardiac.ejection_fraction is not None else "Not Recorded"
        echo_str = "Available" if cardiac.echocardiogram_available else "Not Done"
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Echocardiography</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 4px 0;">EF: {ef}</div>
                <div style="font-size: 0.82rem; color: #64748B;">Echo Status: <strong>{echo_str}</strong></div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c3:
        pr = f"{cardiac.pr_interval:.0f} ms" if cardiac.pr_interval else "—"
        qrs = f"{cardiac.qrs_duration:.0f} ms" if cardiac.qrs_duration else "—"
        qtc = f"{cardiac.qtc:.0f} ms" if cardiac.qtc else "—"
        st.markdown(
            f"""
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Interval Telemetry</div>
                <div style="font-size: 0.82rem; color: #334155; margin-top: 4px;">
                    <div>• <strong>PR Interval:</strong> {pr}</div>
                    <div>• <strong>QRS Duration:</strong> {qrs}</div>
                    <div>• <strong>QTc Interval:</strong> {qtc}</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    st.caption(f"Cardiac Assessment Date: **{cardiac.assessment_date}**")


def render_medical_history_display(history: MedicalHistory | None) -> None:
    """Render comorbidities, infectiology, and surgical history."""
    if not history:
        render_empty_state("No Medical History Recorded", "Document comorbidities, infection screening, and surgical records.")
        return

    comorbidities = [
        ("Diabetes Mellitus", history.diabetes),
        ("Hypertension", history.hypertension),
        ("Heart Disease", history.heart_disease),
        ("Kidney Disease", history.kidney_disease),
        ("Liver Disease", history.liver_disease),
        ("Chronic Lung Disease", history.lung_disease),
        ("History of Malignancy / Cancer", history.cancer_history),
    ]

    st.markdown("##### Systemic Comorbidities & Risk Factors")
    badges_html = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">'
    for name, is_present in comorbidities:
        if is_present:
            badges_html += f'<span style="background: #FEE2E2; color: #B91C1C; font-weight: 700; font-size: 0.78rem; padding: 4px 10px; border-radius: 9999px;">⚠️ {name}</span>'
        else:
            badges_html += f'<span style="background: #F1F5F9; color: #64748B; font-weight: 500; font-size: 0.78rem; padding: 4px 10px; border-radius: 9999px;">✓ No {name}</span>'
    badges_html += "</div>"
    st.markdown(badges_html, unsafe_allow_html=True)

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(
            f"""
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Infectious Disease Screening</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #0F172A; margin: 4px 0;">{history.infectious_disease_status}</div>
                <div style="font-size: 0.78rem; color: #64748B;">Smoking: <strong>{history.smoking_status}</strong></div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c2:
        st.markdown(
            f"""
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Medications & Surgeries</div>
                <div style="font-size: 0.82rem; color: #334155; margin-top: 4px;">
                    <div><strong>Meds:</strong> {history.medication_history or 'None reported'}</div>
                    <div><strong>Surgeries:</strong> {history.previous_surgery or 'None reported'}</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    if history.notes:
        st.info(f"**Clinical Notes:** {history.notes}")


def render_hla_display(hla: HLAProfile | None) -> None:
    """Render HLA locus typing alleles."""
    if not hla:
        render_empty_state("No HLA Typing Recorded", "Document HLA Class I and Class II loci alleles.")
        return

    loci = [
        ("HLA-A", hla.hla_a or "—"),
        ("HLA-B", hla.hla_b or "—"),
        ("HLA-C", hla.hla_c or "—"),
        ("HLA-DR", hla.hla_dr or "—"),
        ("HLA-DQ", hla.hla_dq or "—"),
    ]

    cols = st.columns(5)
    for idx, (locus, val) in enumerate(loci):
        with cols[idx]:
            st.markdown(
                f"""
                <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.72rem; font-weight: 700; color: #64748B;">{locus}</div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: #1E40AF; margin-top: 2px;">{val}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    if hla.antibody_information:
        st.caption(f"**Antibody Screening / PRA:** {hla.antibody_information}")
    st.caption(f"HLA Genotype Date: **{hla.test_date}**")


def render_organ_assessments_display(assessments: list[OrganAssessment]) -> None:
    """Render organ-specific suitability evaluations."""
    if not assessments:
        render_empty_state("No Organ Assessments", "Document organ-specific surgical evaluation notes.")
        return

    rows = []
    for a in assessments:
        rows.append({
            "Organ": a.organ,
            "Assessment Status": a.assessment_status,
            "Evaluation Notes": a.assessment_notes or "—",
            "Evaluation Date": a.assessment_date,
        })
    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)


def render_crossmatches_display(crossmatches: list[CrossmatchResult]) -> None:
    """Render crossmatch outcomes and compatibility assessments."""
    if not crossmatches:
        render_empty_state("No Crossmatch Records", "Perform virtual or prospective crossmatch matching.")
        return

    rows = []
    for c in crossmatches:
        rows.append({
            "Donor ID": c.donor_id,
            "Recipient ID": c.recipient_id,
            "Crossmatch Result": c.result,
            "Antibody Info": c.antibody_information or "—",
            "Test Date": c.test_date,
            "Notes": c.notes or "—",
        })
    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)
