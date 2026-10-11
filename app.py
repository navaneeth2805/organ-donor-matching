"""Organ Donor Matching Network - Streamlit Application Entry Point."""

import os
from pathlib import Path
import streamlit as st
import pandas as pd

from config.logging_config import get_logger, setup_logging
from config.settings import APP_NAME, APP_SUBTITLE, DATABASE_PATH, VERSION
from database.database import DatabaseManager
from database.repositories import (
    AuditLogRepository,
    CardiacAssessmentRepository,
    CrossmatchRepository,
    CompatibilityRepository,
    DonorRepository,
    HLARepository,
    HospitalRepository,
    LaboratoryRepository,
    MatchingRunRepository,
    MedicalHistoryRepository,
    MedicalProfileRepository,
    OrganAssessmentRepository,
    RecipientRepository,
    VitalSignsRepository,
)
from modules.analytics import AnalyticsService
from modules.cardiac_assessment import CardiacAssessmentService
from modules.compatibility import CompatibilityService
from modules.data_quality import DataQualityService
from modules.donor import DonorService
from modules.graph_analytics import GraphAnalyticsService
from modules.graph_engine import GraphEngine
from modules.hospital import HospitalService
from modules.immunology import CrossmatchService, HLAService
from modules.laboratory import LaboratoryService
from modules.matching_engine import MatchingEngine
from modules.medical_history import MedicalHistoryService
from modules.medical_profile import MedicalProfileService
from modules.organ_assessment import OrganAssessmentService
from modules.recipient import RecipientService
from modules.vital_signs import VitalSignsService
from ui.candidate_page import render_candidate_page
from ui.compatibility_page import render_compatibility_page
from ui.components import inject_custom_css, render_page_header, render_section_header, render_stat_card
from ui.dashboard import render_dashboard_page
from ui.donor_page import render_donor_page
from ui.graph_analytics_page import render_graph_analytics_page
from ui.graph_page import render_graph_page
from ui.hospital_page import render_hospital_page
from ui.matching_page import render_matching_page
from ui.medical_profiles_page import render_medical_profiles_page
from ui.network_page import render_network_page
from ui.recipient_page import render_recipient_page
from utils.export import export_analytics_csv
from visualization.dashboard_components import (
    render_availability_pie_chart,
    render_blood_group_chart,
    render_organ_distribution_chart,
    render_registration_trend_chart,
    render_urgency_chart,
)

# Initialize logging
setup_logging()
logger = get_logger("app")

# Page Configuration
st.set_page_config(
    page_title=APP_NAME,
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)


@st.cache_resource
def get_database_and_services(db_path: str = DATABASE_PATH):
    """Singleton initialization for database manager, repositories, and services."""
    db = DatabaseManager(db_path)
    db.initialize()
    logger.info("Core database initialized and verified.")

    hospital_repo = HospitalRepository(db)
    audit_repo = AuditLogRepository(db)
    donor_repo = DonorRepository(db)
    recipient_repo = RecipientRepository(db)

    # Phase 2 Repositories
    vitals_repo = VitalSignsRepository(db)
    labs_repo = LaboratoryRepository(db)
    cardiac_repo = CardiacAssessmentRepository(db)
    history_repo = MedicalHistoryRepository(db)
    hla_repo = HLARepository(db)
    crossmatch_repo = CrossmatchRepository(db)
    organ_repo = OrganAssessmentRepository(db)
    profile_repo = MedicalProfileRepository(db)
    compat_repo = CompatibilityRepository(db)

    # Phase 1 Services
    donor_service = DonorService(donor_repo, hospital_repo, audit_repo)
    recipient_service = RecipientService(recipient_repo, hospital_repo, audit_repo)
    hospital_service = HospitalService(hospital_repo, audit_repo)
    analytics_service = AnalyticsService(donor_repo, recipient_repo, hospital_repo)

    # Phase 2 Medical Intelligence Services
    vitals_service = VitalSignsService(vitals_repo, audit_repo)
    lab_service = LaboratoryService(labs_repo, audit_repo)
    cardiac_service = CardiacAssessmentService(cardiac_repo, audit_repo)
    history_service = MedicalHistoryService(history_repo, audit_repo)
    hla_service = HLAService(hla_repo, audit_repo)
    crossmatch_service = CrossmatchService(crossmatch_repo, donor_repo, recipient_repo, audit_repo)
    organ_service = OrganAssessmentService(organ_repo, donor_repo, audit_repo)

    data_quality_service = DataQualityService(
        donor_repo=donor_repo,
        recipient_repo=recipient_repo,
        vitals_repo=vitals_repo,
        labs_repo=labs_repo,
        cardiac_repo=cardiac_repo,
        history_repo=history_repo,
        hla_repo=hla_repo,
        organ_repo=organ_repo,
    )

    medical_profile_service = MedicalProfileService(
        profile_repo=profile_repo,
        donor_repo=donor_repo,
        recipient_repo=recipient_repo,
        vitals_service=vitals_service,
        lab_service=lab_service,
        cardiac_service=cardiac_service,
        history_service=history_service,
        hla_service=hla_service,
        crossmatch_service=crossmatch_service,
        organ_service=organ_service,
        data_quality_service=data_quality_service,
        audit_repo=audit_repo,
    )

    # Phase 3 Compatibility & Candidate Ranking Engine
    compat_service = CompatibilityService(
        compatibility_repo=compat_repo,
        donor_repo=donor_repo,
        recipient_repo=recipient_repo,
        hospital_repo=hospital_repo,
        medical_profile_service=medical_profile_service,
        data_quality_service=data_quality_service,
        audit_repo=audit_repo,
    )

    # Phase 4 Bipartite Graph Engine & Matching Algorithms
    matching_run_repo = MatchingRunRepository(db)
    graph_engine = GraphEngine(audit_repo=audit_repo)
    matching_engine = MatchingEngine(
        graph_engine=graph_engine,
        compat_repo=compat_repo,
        donor_repo=donor_repo,
        recipient_repo=recipient_repo,
        matching_run_repo=matching_run_repo,
        audit_repo=audit_repo,
    )

    return {
        "db": db,
        "donor_repo": donor_repo,
        "recipient_repo": recipient_repo,
        "hospital_repo": hospital_repo,
        "audit_repo": audit_repo,
        "vitals_repo": vitals_repo,
        "labs_repo": labs_repo,
        "cardiac_repo": cardiac_repo,
        "history_repo": history_repo,
        "hla_repo": hla_repo,
        "crossmatch_repo": crossmatch_repo,
        "organ_repo": organ_repo,
        "profile_repo": profile_repo,
        "compat_repo": compat_repo,
        "matching_run_repo": matching_run_repo,
        "donor_service": donor_service,
        "recipient_service": recipient_service,
        "hospital_service": hospital_service,
        "analytics_service": analytics_service,
        "vitals_service": vitals_service,
        "lab_service": lab_service,
        "cardiac_service": cardiac_service,
        "history_service": history_service,
        "hla_service": hla_service,
        "crossmatch_service": crossmatch_service,
        "organ_service": organ_service,
        "data_quality_service": data_quality_service,
        "medical_profile_service": medical_profile_service,
        "compat_service": compat_service,
        "graph_engine": graph_engine,
        "matching_engine": matching_engine,
    }


def seed_demo_data(services: dict) -> None:
    """Populate database with realistic, clearly synthetic clinical data for demonstration."""
    hospital_svc: HospitalService = services["hospital_service"]
    donor_svc: DonorService = services["donor_service"]
    recip_svc: RecipientService = services["recipient_service"]

    # 1. Seed Hospitals
    hosp_defs = [
        ("Apex Transplant Institute", "New Delhi", "Delhi", "India", "+91 11 40506070", "organ@apex.org"),
        ("Apollo Health City", "Hyderabad", "Telangana", "India", "+91 40 23607777", "transplant@apollo.org"),
        ("Christian Medical College", "Vellore", "Tamil Nadu", "India", "+91 416 2281000", "organbank@cmcvellore.ac.in"),
        ("Fortis Memorial Research Institute", "Gurugram", "Haryana", "India", "+91 124 4921021", "donorcare@fortis.org"),
        ("Manipal Super Specialty Hospital", "Bengaluru", "Karnataka", "India", "+91 80 25024444", "organ@manipal.edu"),
    ]
    created_hosps = []
    for name, city, state, country, phone, email in hosp_defs:
        try:
            h = hospital_svc.add_hospital(name, city, state, country, phone, email, active=1)
            created_hosps.append(h)
        except Exception:
            existing = hospital_svc.search_hospitals(name)
            if existing:
                created_hosps.append(existing[0])

    if not created_hosps:
        return

    # 2. Seed Donors
    donor_defs = [
        (101, "Aarav Sharma", 28, "O+", "Kidney", created_hosps[0].id, "New Delhi", "Available", "+91 9811001122", "aarav@demo.org", "2026-08-10"),
        (102, "Priya Patel", 34, "A+", "Liver", created_hosps[1].id, "Hyderabad", "Available", "+91 9822002233", "priya@demo.org", "2026-08-12"),
        (103, "Rohan Iyer", 45, "B+", "Heart", created_hosps[2].id, "Chennai", "Pending", "+91 9833003344", "rohan@demo.org", "2026-08-15"),
        (104, "Kavita Reddy", 29, "AB+", "Lung", created_hosps[3].id, "Gurugram", "Available", "+91 9844004455", "kavita@demo.org", "2026-08-18"),
        (105, "Vikram Malhotra", 52, "O-", "Kidney", created_hosps[0].id, "New Delhi", "Available", "+91 9855005566", "vikram@demo.org", "2026-08-20"),
        (106, "Ananya Sen", 23, "A-", "Cornea", created_hosps[4].id, "Bengaluru", "Available", "+91 9866006677", "ananya@demo.org", "2026-08-25"),
        (107, "Manish Verma", 39, "B-", "Pancreas", created_hosps[1].id, "Secunderabad", "Unavailable", "+91 9877007788", "manish@demo.org", "2026-08-28"),
        (108, "Sunita Rao", 31, "O+", "Bone Marrow", created_hosps[2].id, "Vellore", "Pending", "+91 9888008899", "sunita@demo.org", "2026-09-01"),
    ]
    for d_id, name, age, bg, organ, hid, loc, avail, phone, email, r_date in donor_defs:
        try:
            donor_svc.create_donor(d_id, name, age, bg, organ, hid, loc, avail, phone, email, r_date)
        except Exception:
            pass

    # 3. Seed Recipients
    recip_defs = [
        (201, "Suresh Nair", 54, "O+", "Kidney", created_hosps[0].id, "New Delhi", "Critical", 280, "+91 9111001122", "suresh@demo.org", "2026-08-01"),
        (202, "Deepa Chawla", 42, "A+", "Liver", created_hosps[1].id, "Hyderabad", "High", 195, "+91 9222002233", "deepa@demo.org", "2026-08-05"),
        (203, "Aditya Roy", 38, "O-", "Heart", created_hosps[2].id, "Bengaluru", "Critical", 310, "+91 9333003344", "aditya@demo.org", "2026-08-09"),
        (204, "Meera Kulkarni", 61, "B+", "Lung", created_hosps[3].id, "Noida", "Medium", 85, "+91 9444004455", "meera@demo.org", "2026-08-14"),
        (205, "Rajesh Gupta", 49, "Kidney", "Kidney", created_hosps[0].id, "Faridabad", "Low", 40, "+91 9555005566", "rajesh@demo.org", "2026-08-19"),
        (206, "Neha Bhatt", 27, "A-", "Cornea", created_hosps[4].id, "Mysuru", "Medium", 110, "+91 9666006677", "neha@demo.org", "2026-08-23"),
        (207, "Karan Kapoor", 33, "AB+", "Bone Marrow", created_hosps[2].id, "Chennai", "High", 145, "+91 9777007788", "karan@demo.org", "2026-08-27"),
    ]
    # Correct blood group for recip 205
    recip_defs[4] = (205, "Rajesh Gupta", 49, "AB-", "Kidney", created_hosps[0].id, "Faridabad", "Low", 40, "+91 9555005566", "rajesh@demo.org", "2026-08-19")

    for r_id, name, age, bg, organ, hid, loc, urg, wt, phone, email, r_date in recip_defs:
        try:
            recip_svc.create_recipient(r_id, name, age, bg, organ, hid, loc, urg, wt, phone, email, r_date)
        except Exception:
            pass

    # 4. Seed Phase 2 Clinical Medical Profiles
    vitals_svc = services.get("vitals_service")
    lab_svc = services.get("lab_service")
    cardiac_svc = services.get("cardiac_service")
    history_svc = services.get("history_service")
    hla_svc = services.get("hla_service")
    organ_svc = services.get("organ_service")
    crossmatch_svc = services.get("crossmatch_service")
    profile_svc = services.get("medical_profile_service")

    # Donor 101: Living Kidney Donor
    try:
        if vitals_svc:
            vitals_svc.record_vitals("DONOR", 101, 120, 78, 72, 16, 36.8, 99.0, 175.0, 72.0, "2026-08-11")
        if lab_svc:
            lab_svc.record_laboratory_results("DONOR", 101, {"blood_glucose": 92.0, "creatinine": 0.9, "egfr": 112.0, "bun": 14.0, "sodium": 140.0, "potassium": 4.2, "hemoglobin": 15.2, "wbc": 6.8, "platelets": 235.0, "ast": 24.0, "alt": 26.0, "bilirubin": 0.7, "albumin": 4.4, "inr": 1.0}, "2026-08-11")
        if cardiac_svc:
            cardiac_svc.record_cardiac_assessment("DONOR", 101, {"ecg_status": "Normal", "ecg_findings": "Normal sinus rhythm, normal axis", "heart_rate": 72, "pr_interval": 150, "qrs_duration": 85, "qt_interval": 380, "qtc": 410, "echocardiogram_available": 1, "ejection_fraction": 62.0}, "2026-08-11")
        if history_svc:
            history_svc.record_medical_history("DONOR", 101, {"diabetes": 0, "hypertension": 0, "heart_disease": 0, "kidney_disease": 0, "liver_disease": 0, "lung_disease": 0, "cancer_history": 0, "infectious_disease_status": "Negative / Non-Reactive", "smoking_status": "Never", "notes": "Living kidney donor candidate, cleared by transplant workup team."}, "2026-08-11")
        if hla_svc:
            hla_svc.record_hla("DONOR", 101, "A*02, A*24", "B*07, B*35", "C*07", "DRB1*15, DRB1*04", "DQB1*06", "Negative PRA", "2026-08-11")
        if organ_svc:
            organ_svc.record_organ_assessment(101, "Kidney", "Assessment Complete", "Bilateral normal renal architecture, single renal artery, 100% perfusion.", "2026-08-11")
        if profile_svc:
            profile_svc.record_overview_notes("DONOR", 101, "Living donor candidate cleared by transplant surgery committee.", "2026-08-11")
    except Exception as e:
        logger.warning(f"Error seeding Donor 101 clinical profile: {e}")

    # Recipient 201: Kidney Recipient (Waitlist)
    try:
        if vitals_svc:
            vitals_svc.record_vitals("RECIPIENT", 201, 138, 86, 78, 18, 36.7, 97.0, 168.0, 76.0, "2026-08-02")
        if lab_svc:
            lab_svc.record_laboratory_results("RECIPIENT", 201, {"blood_glucose": 110.0, "creatinine": 4.8, "egfr": 12.0, "bun": 52.0, "sodium": 137.0, "potassium": 4.8, "hemoglobin": 10.4, "wbc": 7.4, "platelets": 190.0, "calcium": 8.9, "albumin": 3.8, "inr": 1.1}, "2026-08-02")
        if cardiac_svc:
            cardiac_svc.record_cardiac_assessment("RECIPIENT", 201, {"ecg_status": "Normal", "ecg_findings": "Sinus rhythm, mild LVH voltage criteria, no ischemia", "heart_rate": 78, "pr_interval": 160, "qrs_duration": 90, "qt_interval": 390, "qtc": 420, "echocardiogram_available": 1, "ejection_fraction": 56.0}, "2026-08-02")
        if history_svc:
            history_svc.record_medical_history("RECIPIENT", 201, {"diabetes": 0, "hypertension": 1, "heart_disease": 0, "kidney_disease": 1, "liver_disease": 0, "lung_disease": 0, "cancer_history": 0, "infectious_disease_status": "Negative / Non-Reactive", "smoking_status": "Former", "notes": "Hypertensive nephrosclerosis, end-stage renal disease on hemodialysis."}, "2026-08-02")
        if hla_svc:
            hla_svc.record_hla("RECIPIENT", 201, "A*02, A*03", "B*07, B*44", "C*07", "DRB1*15, DRB1*07", "DQB1*06", "PRA 0%, no DSAs detected", "2026-08-02")
        if profile_svc:
            profile_svc.record_overview_notes("RECIPIENT", 201, "End-stage renal disease listed on high priority waitlist.", "2026-08-02")
        if crossmatch_svc:
            crossmatch_svc.record_crossmatch(101, 201, "Negative", "No donor specific anti-HLA antibodies", "2026-08-12", "Prospective crossmatch negative for T and B cell cytotoxicity.")
    except Exception as e:
        logger.warning(f"Error seeding Recipient 201 clinical profile: {e}")

    # Donor 102: Liver Donor
    try:
        if vitals_svc:
            vitals_svc.record_vitals("DONOR", 102, 116, 74, 68, 16, 36.6, 99.0, 162.0, 58.0, "2026-08-13")
        if lab_svc:
            lab_svc.record_laboratory_results("DONOR", 102, {"blood_glucose": 88.0, "creatinine": 0.8, "egfr": 115.0, "bun": 12.0, "sodium": 141.0, "potassium": 4.1, "hemoglobin": 13.8, "ast": 22.0, "alt": 20.0, "bilirubin": 0.6, "albumin": 4.5, "inr": 0.98}, "2026-08-13")
        if cardiac_svc:
            cardiac_svc.record_cardiac_assessment("DONOR", 102, {"ecg_status": "Normal", "ecg_findings": "Normal sinus rhythm", "heart_rate": 68, "pr_interval": 145, "qrs_duration": 82, "qt_interval": 375, "qtc": 405, "echocardiogram_available": 1, "ejection_fraction": 64.0}, "2026-08-13")
        if history_svc:
            history_svc.record_medical_history("DONOR", 102, {"diabetes": 0, "hypertension": 0, "heart_disease": 0, "kidney_disease": 0, "liver_disease": 0, "lung_disease": 0, "cancer_history": 0, "infectious_disease_status": "Negative / Non-Reactive", "smoking_status": "Never", "notes": "Prospective living right lobe liver donor candidate."}, "2026-08-13")
        if hla_svc:
            hla_svc.record_hla("DONOR", 102, "A*01, A*24", "B*08, B*40", "C*03", "DRB1*03, DRB1*11", "DQB1*02", "Negative", "2026-08-13")
        if organ_svc:
            organ_svc.record_organ_assessment(102, "Liver", "Assessment Complete", "CT volumetry normal, steatosis < 5%, hepatic vasculature unremarkable.", "2026-08-13")
        if profile_svc:
            profile_svc.record_overview_notes("DONOR", 102, "Living donor right hepatectomy candidate cleared by surgical team.", "2026-08-13")
    except Exception as e:
        logger.warning(f"Error seeding Donor 102 clinical profile: {e}")

    # Recipient 202: Liver Recipient
    try:
        if vitals_svc:
            vitals_svc.record_vitals("RECIPIENT", 202, 122, 78, 76, 17, 36.8, 98.0, 160.0, 62.0, "2026-08-06")
        if lab_svc:
            lab_svc.record_laboratory_results("RECIPIENT", 202, {"blood_glucose": 95.0, "creatinine": 1.1, "egfr": 78.0, "bun": 19.0, "ast": 68.0, "alt": 74.0, "bilirubin": 2.8, "albumin": 3.1, "inr": 1.45}, "2026-08-06")
        if history_svc:
            history_svc.record_medical_history("RECIPIENT", 202, {"diabetes": 0, "hypertension": 0, "heart_disease": 0, "kidney_disease": 0, "liver_disease": 1, "lung_disease": 0, "cancer_history": 0, "infectious_disease_status": "Negative / Non-Reactive", "smoking_status": "Never", "notes": "Decompensated cirrhosis awaiting orthotopic liver transplantation."}, "2026-08-06")
        if hla_svc:
            hla_svc.record_hla("RECIPIENT", 202, "A*01, A*02", "B*08, B*51", "C*03", "DRB1*03, DRB1*04", "DQB1*02", "PRA 5%", "2026-08-06")
        if profile_svc:
            profile_svc.record_overview_notes("RECIPIENT", 202, "End-stage liver disease, MELD prioritized recipient.", "2026-08-06")
    except Exception as e:
        logger.warning(f"Error seeding Recipient 202 clinical profile: {e}")

    # Recipient 203: Critical Heart Waitlist
    try:
        if vitals_svc:
            vitals_svc.record_vitals("RECIPIENT", 203, 105, 65, 84, 20, 36.6, 96.0, 178.0, 70.0, "2026-08-10")
        if cardiac_svc:
            cardiac_svc.record_cardiac_assessment("RECIPIENT", 203, {"ecg_status": "Abnormal", "ecg_findings": "Left bundle branch block, ventricular runs", "heart_rate": 84, "pr_interval": 180, "qrs_duration": 135, "qt_interval": 440, "qtc": 470, "echocardiogram_available": 1, "ejection_fraction": 24.0}, "2026-08-10")
        if history_svc:
            history_svc.record_medical_history("RECIPIENT", 203, {"diabetes": 0, "hypertension": 0, "heart_disease": 1, "kidney_disease": 0, "liver_disease": 0, "lung_disease": 0, "cancer_history": 0, "infectious_disease_status": "Negative / Non-Reactive", "smoking_status": "Former", "notes": "Dilated cardiomyopathy, NYHA Class IV, Status 1 waitlist priority."}, "2026-08-10")
        if profile_svc:
            profile_svc.record_overview_notes("RECIPIENT", 203, "High-urgency cardiac transplant candidate.", "2026-08-10")
    except Exception as e:
        logger.warning(f"Error seeding Recipient 203 clinical profile: {e}")


def main() -> None:
    """Application main runner and routing controller."""
    inject_custom_css()
    services = get_database_and_services()

    # Sidebar Navigation
    with st.sidebar:
        st.markdown(
            f"""
            <div style="padding: 10px 0 16px 0; border-bottom: 1px solid #334155;">
                <div style="font-size: 1.3rem; font-weight: 800; color: #38BDF8; letter-spacing: -0.02em;">
                    🏥 {APP_NAME}
                </div>
                <div style="font-size: 0.76rem; color: #94A3B8; margin-top: 3px;">
                    {APP_SUBTITLE} • {VERSION}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<br>", unsafe_allow_html=True)
        selected_nav = st.radio(
            "Navigation",
            [
                "📊 Dashboard",
                "👤 Donors",
                "🧑‍⚕️ Recipients",
                "🏥 Hospitals",
                "🧬 Medical Profiles",
                "🎯 Compatibility",
                "🏆 Candidates",
                "🌐 Graph Network",
                "🤝 Matching Engine",
                "📈 Graph Analytics",
                "⚙️ Settings",
            ],
            label_visibility="collapsed",
        )

        st.markdown("<br><br>", unsafe_allow_html=True)
        st.markdown(
            """
            <div style="padding: 12px; border-radius: 8px; background-color: #1E293B; border: 1px solid #334155;">
                <div style="font-size: 0.74rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">
                    System Status
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 0.82rem; color: #34D399; font-weight: 600;">
                    <span>●</span> Clinical & Graph Engines Active
                </div>
                <div style="font-size: 0.72rem; color: #64748B; margin-top: 4px;">
                    Phase 1, 2, 3 & 4 Verified • NetworkX Bipartite
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Route navigation
    if selected_nav == "📊 Dashboard":
        render_dashboard_page(
            analytics_service=services["analytics_service"],
            donor_service=services["donor_service"],
            recipient_service=services["recipient_service"],
            data_quality_service=services.get("data_quality_service"),
        )

    elif selected_nav == "👤 Donors":
        render_donor_page(
            donor_service=services["donor_service"],
            hospital_service=services["hospital_service"],
            medical_profile_service=services.get("medical_profile_service"),
            recipient_service=services.get("recipient_service"),
        )

    elif selected_nav == "🧑‍⚕️ Recipients":
        render_recipient_page(
            recipient_service=services["recipient_service"],
            hospital_service=services["hospital_service"],
            medical_profile_service=services.get("medical_profile_service"),
            donor_service=services.get("donor_service"),
        )

    elif selected_nav == "🏥 Hospitals":
        render_hospital_page(services["hospital_service"])

    elif selected_nav == "🧬 Medical Profiles":
        render_medical_profiles_page(
            medical_profile_service=services["medical_profile_service"],
            donor_service=services["donor_service"],
            recipient_service=services["recipient_service"],
        )

    elif selected_nav == "🎯 Compatibility":
        render_compatibility_page(
            compat_service=services["compat_service"],
            donor_service=services["donor_service"],
            recipient_service=services["recipient_service"],
        )

    elif selected_nav == "🏆 Candidates":
        render_candidate_page(
            compat_service=services["compat_service"],
            donor_service=services["donor_service"],
            recipient_service=services["recipient_service"],
        )

    elif selected_nav == "🌐 Graph Network":
        render_graph_page(
            graph_engine=services["graph_engine"],
            compat_service=services["compat_service"],
            donor_service=services["donor_service"],
            recipient_service=services["recipient_service"],
        )

    elif selected_nav == "🤝 Matching Engine":
        render_matching_page(
            matching_engine=services["matching_engine"],
            graph_engine=services["graph_engine"],
            compat_service=services["compat_service"],
        )

    elif selected_nav == "📈 Graph Analytics":
        render_graph_analytics_page(services["graph_engine"])

    elif selected_nav == "⚙️ Settings":
        render_settings_page(services)


def render_analytics_page(analytics_svc: AnalyticsService) -> None:
    """Dedicated analytical insights and data aggregation view."""
    render_page_header(
        title="Comprehensive Healthcare Analytics",
        description="Aggregate demand-supply metrics, blood phenotype distributions, and clinical urgency breakdown.",
    )

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        render_stat_card("Donors", analytics_svc.get_total_donors(), "Registered", "👤", "#1E40AF")
    with col2:
        render_stat_card("Recipients", analytics_svc.get_total_recipients(), "Waiting list", "🧑‍⚕️", "#0284C7")
    with col3:
        render_stat_card("Available", analytics_svc.get_available_donors(), "Ready", "🟢", "#16A34A")
    with col4:
        render_stat_card("Critical Priority", analytics_svc.get_critical_recipients(), "Immediate", "🚨", "#DC2626")

    st.markdown("<br>", unsafe_allow_html=True)
    render_section_header("Organ Demand vs. Supply Breakdown", icon="⚖️")

    col_c1, col_c2 = st.columns(2)
    with col_c1:
        df_d_organ = analytics_svc.get_donors_by_organ()
        render_organ_distribution_chart(df_d_organ, title="Supplied Organs (Donors)")
    with col_c2:
        df_r_organ = analytics_svc.get_recipients_by_organ()
        render_organ_distribution_chart(df_r_organ, title="Demanded Organs (Recipients)", color="#0284C7")

    col_c3, col_c4 = st.columns(2)
    with col_c3:
        df_bg = analytics_svc.get_donors_by_blood_group()
        render_blood_group_chart(df_bg, title="Donor ABO/Rh Phenotype Distribution")
    with col_c4:
        df_urg = analytics_svc.get_recipients_by_urgency()
        render_urgency_chart(df_urg)

    # Export analytics data
    st.markdown("<br>", unsafe_allow_html=True)
    analytics_export_data = {
        "Total Donors": analytics_svc.get_total_donors(),
        "Total Recipients": analytics_svc.get_total_recipients(),
        "Available Donors": analytics_svc.get_available_donors(),
        "Critical Recipients": analytics_svc.get_critical_recipients(),
    }
    csv_str = export_analytics_csv(analytics_export_data)
    st.download_button(
        label="📥 Export Analytics Summary (CSV)",
        data=csv_str,
        file_name="organ_network_analytics.csv",
        mime="text/csv",
    )


def render_settings_page(services: dict) -> None:
    """Settings page providing system diagnostics, demo seeding, and database initialization."""
    render_page_header(
        title="System Administration & Settings",
        description="Configure application parameters, inspect SQLite database properties, and load synthetic datasets.",
    )

    db_mgr: DatabaseManager = services["db"]
    donor_repo: DonorRepository = services["donor_repo"]
    recip_repo: RecipientRepository = services["recipient_repo"]
    hosp_repo: HospitalRepository = services["hospital_repo"]
    audit_repo: AuditLogRepository = services["audit_repo"]

    # Diagnostics Card
    render_section_header("Database Environment & Metadata", icon="🔍")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Application Name", APP_NAME)
        st.metric("Total Donors", donor_repo.count())
    with col2:
        st.metric("Database File Path", Path(DATABASE_PATH).name)
        st.metric("Total Recipients", recip_repo.count())
    with col3:
        st.metric("Engine Status", "Connected (SQLite)")
        st.metric("Total Facilities", hosp_repo.count())
    with col4:
        dq_svc = services.get("data_quality_service")
        if dq_svc:
            rep = dq_svc.evaluate_network_data_quality()
            st.metric("Data Completeness", f"{rep.get('overall_network_avg_score', 0)}%")
            st.metric("High-Readiness Profiles", rep.get("completed_profiles_count", 0))

    st.markdown("---")

    # Demo Data & Maintenance
    render_section_header("Synthetic Test Data & Maintenance", icon="🧪")
    st.caption("Load realistic synthetic records for validation, demonstration, and algorithm development.")

    col_d1, col_d2, col_d3 = st.columns(3)

    with col_d1:
        if st.button("🧪 Load Demo Dataset", use_container_width=True):
            seed_demo_data(services)
            st.success("Synthetic demo dataset successfully loaded! Check Dashboard and Registry views.")
            st.rerun()

    with col_d2:
        if st.button("🔄 Re-initialize Database", use_container_width=True):
            db_mgr.initialize()
            st.success("Database schema verified and re-indexed.")
            st.rerun()

    with col_d3:
        clear_confirm = st.checkbox("Confirm database reset", key="clear_db_confirm")
        if st.button("🗑️ Clear All Records", disabled=not clear_confirm, type="primary", use_container_width=True):
            try:
                with db_mgr.get_connection() as conn:
                    conn.execute("PRAGMA foreign_keys = OFF;")
                    conn.execute("DELETE FROM donors;")
                    conn.execute("DELETE FROM recipients;")
                    conn.execute("DELETE FROM hospitals;")
                    conn.execute("DELETE FROM audit_logs;")
                    conn.execute("DELETE FROM medical_profiles;")
                    conn.execute("DELETE FROM vital_signs;")
                    conn.execute("DELETE FROM laboratory_results;")
                    conn.execute("DELETE FROM cardiac_assessments;")
                    conn.execute("DELETE FROM medical_history;")
                    conn.execute("DELETE FROM hla_profiles;")
                    conn.execute("DELETE FROM crossmatch_results;")
                    conn.execute("DELETE FROM organ_assessments;")
                    conn.execute("PRAGMA foreign_keys = ON;")
                    conn.commit()
                st.success("All records cleared from database.")
                st.rerun()
            except Exception as ex:
                st.error(f"Error clearing records: {ex}")

    st.info(
        "⚠️ **Disclaimer**: The demo dataset generates synthetic patient representations for testing and educational purposes. "
        "It contains no real personal health information (PHI).",
        icon="ℹ️",
    )

    st.markdown("---")

    # Audit Logs
    render_section_header("System Audit Trail", icon="📜")
    recent_logs = audit_repo.get_all(limit=25)
    if recent_logs:
        log_rows = [
            {
                "Timestamp": l.created_at,
                "Entity Type": l.entity_type.upper(),
                "Entity ID": l.entity_id,
                "Action": l.action,
                "Details": l.details,
            }
            for l in recent_logs
        ]
        st.dataframe(pd.DataFrame(log_rows), use_container_width=True, hide_index=True)
    else:
        st.write("No audit log entries recorded yet.")


if __name__ == "__main__":
    main()
