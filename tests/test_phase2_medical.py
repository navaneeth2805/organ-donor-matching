"""Unit and integration tests for Phase 2 Medical Profile Engine."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.repositories import (
    AuditLogRepository,
    CardiacAssessmentRepository,
    CrossmatchRepository,
    DonorRepository,
    HLARepository,
    HospitalRepository,
    LaboratoryRepository,
    MedicalHistoryRepository,
    MedicalProfileRepository,
    OrganAssessmentRepository,
    RecipientRepository,
    VitalSignsRepository,
)
from modules.cardiac_assessment import CardiacAssessmentService
from modules.data_quality import DataQualityService
from modules.donor import DonorService
from modules.hospital import HospitalService
from modules.immunology import CrossmatchService, HLAService
from modules.laboratory import LaboratoryService
from modules.medical_history import MedicalHistoryService
from modules.medical_profile import MedicalProfileService
from modules.organ_assessment import OrganAssessmentService
from modules.recipient import RecipientService
from modules.vital_signs import VitalSignsService
from utils.exceptions import ValidationError


@pytest.fixture
def medical_env():
    """Create isolated test database with all Phase 1 and Phase 2 services."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()

    hosp_repo = HospitalRepository(db)
    audit_repo = AuditLogRepository(db)
    donor_repo = DonorRepository(db)
    recip_repo = RecipientRepository(db)

    vitals_repo = VitalSignsRepository(db)
    labs_repo = LaboratoryRepository(db)
    cardiac_repo = CardiacAssessmentRepository(db)
    history_repo = MedicalHistoryRepository(db)
    hla_repo = HLARepository(db)
    crossmatch_repo = CrossmatchRepository(db)
    organ_repo = OrganAssessmentRepository(db)
    profile_repo = MedicalProfileRepository(db)

    hosp_svc = HospitalService(hosp_repo, audit_repo)
    donor_svc = DonorService(donor_repo, hosp_repo, audit_repo)
    recip_svc = RecipientService(recip_repo, hosp_repo, audit_repo)

    vitals_svc = VitalSignsService(vitals_repo, audit_repo)
    labs_svc = LaboratoryService(labs_repo, audit_repo)
    cardiac_svc = CardiacAssessmentService(cardiac_repo, audit_repo)
    history_svc = MedicalHistoryService(history_repo, audit_repo)
    hla_svc = HLAService(hla_repo, audit_repo)
    crossmatch_svc = CrossmatchService(crossmatch_repo, donor_repo, recip_repo, audit_repo)
    organ_svc = OrganAssessmentService(organ_repo, donor_repo, audit_repo)

    dq_svc = DataQualityService(
        donor_repo=donor_repo,
        recipient_repo=recip_repo,
        vitals_repo=vitals_repo,
        labs_repo=labs_repo,
        cardiac_repo=cardiac_repo,
        history_repo=history_repo,
        hla_repo=hla_repo,
        organ_repo=organ_repo,
    )

    profile_svc = MedicalProfileService(
        profile_repo=profile_repo,
        donor_repo=donor_repo,
        recipient_repo=recip_repo,
        vitals_service=vitals_svc,
        lab_service=labs_svc,
        cardiac_service=cardiac_svc,
        history_service=history_svc,
        hla_service=hla_svc,
        crossmatch_service=crossmatch_svc,
        organ_service=organ_svc,
        data_quality_service=dq_svc,
        audit_repo=audit_repo,
    )

    # Seed one hospital, one donor, and one recipient
    h = hosp_svc.add_hospital("Clinical Center", "Mumbai", "Maharashtra")
    d = donor_svc.create_donor(1001, "Test Donor", 30, "O+", "Kidney", h.id, "Mumbai", "Available")
    r = recip_svc.create_recipient(2001, "Test Recipient", 50, "O+", "Kidney", h.id, "Mumbai", "Critical", 120)

    yield {
        "db": db,
        "donor": d,
        "recipient": r,
        "vitals_svc": vitals_svc,
        "labs_svc": labs_svc,
        "cardiac_svc": cardiac_svc,
        "history_svc": history_svc,
        "hla_svc": hla_svc,
        "crossmatch_svc": crossmatch_svc,
        "organ_svc": organ_svc,
        "dq_svc": dq_svc,
        "profile_svc": profile_svc,
    }

    if os.path.exists(path):
        os.remove(path)


def test_vitals_recording_and_bmi(medical_env):
    """Verify vital signs calculation, BMI math, and warnings."""
    vitals_svc = medical_env["vitals_svc"]
    vitals, warns = vitals_svc.record_vitals(
        entity_type="DONOR",
        entity_id=1001,
        systolic_bp=120,
        diastolic_bp=80,
        heart_rate=72,
        respiratory_rate=16,
        temperature=37.0,
        spo2=98.0,
        height_cm=180.0,
        weight_kg=81.0,
        recorded_at="2026-09-01",
    )
    assert vitals.id is not None
    assert vitals.bmi == 25.0  # 81 / (1.8^2) = 25.0
    assert len(warns) == 0

    # Test abnormal alert
    vitals_abn, warns_abn = vitals_svc.record_vitals(
        entity_type="DONOR",
        entity_id=1001,
        systolic_bp=190,
        diastolic_bp=125,
        heart_rate=135,
        respiratory_rate=28,
        temperature=39.5,
        spo2=88.0,
        height_cm=180.0,
        weight_kg=81.0,
        recorded_at="2026-09-02",
    )
    assert any("Elevated Blood Pressure" in w for w in warns_abn)
    assert any("Tachycardia" in w for w in warns_abn)
    assert any("Desaturation" in w for w in warns_abn)


def test_laboratory_recording_and_alerts(medical_env):
    """Verify laboratory biomarker tracking and critical threshold alerting."""
    labs_svc = medical_env["labs_svc"]
    data = {
        "blood_glucose": 95.0,
        "creatinine": 1.0,
        "egfr": 105.0,
        "bun": 15.0,
        "sodium": 140.0,
        "potassium": 4.0,
        "hemoglobin": 14.5,
        "wbc": 7.0,
        "platelets": 250.0,
    }
    labs, alerts = labs_svc.record_laboratory_results("DONOR", 1001, data, "2026-09-01")
    assert labs.id is not None
    assert len(alerts) == 0

    # Test abnormal lab triggers
    abnormal_data = {
        "blood_glucose": 350.0,
        "creatinine": 5.2,
        "egfr": 11.0,
        "potassium": 6.8,
    }
    _, alerts_abn = labs_svc.record_laboratory_results("DONOR", 1001, abnormal_data, "2026-09-02")
    assert any("Hyperkalemia" in a for a in alerts_abn)
    assert any("Reduced eGFR" in a for a in alerts_abn)


def test_cardiac_assessment_and_alerts(medical_env):
    """Verify cardiac electrophysiology and ejection fraction validation."""
    cardiac_svc = medical_env["cardiac_svc"]
    cardiac_data = {
        "ecg_status": "Abnormal",
        "ecg_findings": "Marked QT prolongation, anterolateral T wave inversion",
        "heart_rate": 88,
        "pr_interval": 170,
        "qrs_duration": 100,
        "qt_interval": 510,
        "qtc": 520,
        "echocardiogram_available": 1,
        "ejection_fraction": 25.0,
    }
    assessment, alerts = cardiac_svc.record_cardiac_assessment("RECIPIENT", 2001, cardiac_data, "2026-09-01")
    assert assessment.id is not None
    assert any("Prolonged QTc" in a for a in alerts)
    assert any("Severely Depressed Ejection Fraction" in a for a in alerts)


def test_medical_history_contraindications(medical_env):
    """Verify comorbidity capture and contraindication alerting."""
    history_svc = medical_env["history_svc"]
    history_data = {
        "diabetes": 1,
        "hypertension": 1,
        "cancer_history": 1,
        "infectious_disease_status": "Positive / Active Infection",
        "smoking_status": "Current Daily",
        "notes": "Metastatic melanoma 2 years prior.",
    }
    history, flags = history_svc.record_medical_history("DONOR", 1001, history_data, "2026-09-01")
    assert history.id is not None
    assert any("Malignancy" in f for f in flags)
    assert any("Infectious Disease" in f for f in flags)


def test_hla_and_crossmatch_services(medical_env):
    """Verify HLA typing, loci comparison, and crossmatch recording."""
    hla_svc = medical_env["hla_svc"]
    crossmatch_svc = medical_env["crossmatch_svc"]

    # Record HLA profiles
    d_hla = hla_svc.record_hla("DONOR", 1001, "A*02, A*24", "B*07, B*35", "C*07", "DRB1*15", "DQB1*06", "Negative", "2026-09-01")
    r_hla = hla_svc.record_hla("RECIPIENT", 2001, "A*02, A*03", "B*07, B*44", "C*07", "DRB1*15", "DQB1*06", "Negative", "2026-09-01")

    # Compare loci
    comparison = hla_svc.calculate_hla_match_score(d_hla, r_hla)
    assert comparison["matched_loci_count"] == 5
    assert comparison["match_percentage"] == 100.0

    # Record crossmatch
    xm = crossmatch_svc.record_crossmatch(
        donor_id=1001,
        recipient_id=2001,
        result="Negative",
        antibody_information="No DSAs",
        test_date="2026-09-01",
        notes="Compatible pair",
    )
    assert xm.id is not None
    assert xm.result == "Negative"


def test_data_quality_service(medical_env):
    """Verify completeness scoring and freshness tracking."""
    dq_svc = medical_env["dq_svc"]
    organ_svc = medical_env["organ_svc"]
    vitals_svc = medical_env["vitals_svc"]

    # Initial report should reflect partial data
    report_initial = dq_svc.evaluate_entity_quality("DONOR", 1001)
    assert report_initial.overall_score < 100.0

    # Add vitals & organ assessment
    vitals_svc.record_vitals("DONOR", 1001, 120, 80, 70, 16, 36.6, 99.0, 175.0, 75.0, "2026-09-01")
    organ_svc.record_organ_assessment(1001, "Kidney", "Assessment Complete", "Healthy anatomy", "2026-09-01")

    report_updated = dq_svc.evaluate_entity_quality("DONOR", 1001)
    assert report_updated.completeness_by_category["Vital Signs"] == 100.0
    assert report_updated.completeness_by_category["Organ Assessment"] == 100.0

    # Network-wide evaluation
    network_dq = dq_svc.evaluate_network_data_quality()
    assert network_dq["total_entities_evaluated"] == 2
    assert network_dq["overall_network_avg_score"] > 0


def test_medical_profile_service_complete_bundle(medical_env):
    """Verify unified medical profile retrieval bundle."""
    profile_svc = medical_env["profile_svc"]
    bundle = profile_svc.get_complete_profile("DONOR", 1001)

    assert bundle["entity_type"] == "DONOR"
    assert bundle["entity_id"] == 1001
    assert "vitals" in bundle
    assert "laboratory" in bundle
    assert "cardiac" in bundle
    assert "history" in bundle
    assert "hla" in bundle
    assert "organ_assessments" in bundle
    assert "crossmatches" in bundle
    assert "quality_report" in bundle
