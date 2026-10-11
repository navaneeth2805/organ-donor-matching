"""Integration and functional test suite for Phase 3 Compatibility & Candidate Ranking Engine."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.repositories import (
    AuditLogRepository,
    CardiacAssessmentRepository,
    CompatibilityRepository,
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
from modules.compatibility import CompatibilityService
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


@pytest.fixture
def compat_env():
    """Create isolated SQLite database fixture with Phase 1, 2, and 3 services initialized."""
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
    compat_repo = CompatibilityRepository(db)

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

    med_profile_svc = MedicalProfileService(
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

    compat_svc = CompatibilityService(
        compatibility_repo=compat_repo,
        donor_repo=donor_repo,
        recipient_repo=recip_repo,
        hospital_repo=hosp_repo,
        medical_profile_service=med_profile_svc,
        data_quality_service=dq_svc,
        audit_repo=audit_repo,
    )

    # Seed initial test entities
    h1 = hosp_svc.create_hospital("Metro General", "New York", "NY", phone="555-1111", email="ny@hospital.org")
    h2 = hosp_svc.create_hospital("Pacific Medical", "Los Angeles", "CA", phone="555-2222", email="la@hospital.org")

    # Donor 1: O+ Kidney
    d1 = donor_svc.create_donor(None, "Alice Donor", 28, "O+", "Kidney", h1.id, "New York", "Available")
    # Donor 2: A+ Heart
    d2 = donor_svc.create_donor(None, "Bob Donor", 45, "A+", "Heart", h2.id, "Los Angeles", "Available")

    # Recipient 1: A+ Kidney (Compatible with D1)
    r1 = recip_svc.create_recipient(None, "Charlie Recip", 50, "A+", "Kidney", h1.id, "New York", "High", 200)
    # Recipient 2: O+ Heart (Incompatible with D1 due to organ, compatible with D2 by organ but O+ cannot receive from A+)
    r2 = recip_svc.create_recipient(None, "David Recip", 35, "O+", "Heart", h2.id, "Los Angeles", "Critical", 350)

    yield {
        "db": db,
        "compat_svc": compat_svc,
        "compat_repo": compat_repo,
        "d1": d1,
        "d2": d2,
        "r1": r1,
        "r2": r2,
    }

    try:
        os.remove(path)
    except OSError:
        pass


def test_evaluate_compatible_pair(compat_env):
    """Pair D1 (Kidney, O+) and R1 (Kidney, A+) must pass all hard constraints."""
    svc = compat_env["compat_svc"]
    d1 = compat_env["d1"]
    r1 = compat_env["r1"]

    res = svc.evaluate_pair(d1.id, r1.id, persist=True)
    assert res is not None
    assert res.status in ("POTENTIAL_CANDIDATE", "REQUIRES_REVIEW")
    assert res.blood_score == 100.0
    assert res.organ_score == 100.0
    assert res.score > 50.0
    assert len(res.hard_failures) == 0


def test_evaluate_organ_mismatched_pair(compat_env):
    """Pair D1 (Kidney) and R2 (Heart) must fail hard organ constraint."""
    svc = compat_env["compat_svc"]
    d1 = compat_env["d1"]
    r2 = compat_env["r2"]

    res = svc.evaluate_pair(d1.id, r2.id, persist=True)
    assert res.status == "INCOMPATIBLE"
    assert res.organ_score == 0.0
    assert res.score == 0.0
    assert any("mismatch" in f.lower() for f in res.hard_failures)


def test_evaluate_blood_incompatible_pair(compat_env):
    """Pair D2 (A+ Heart) and R2 (O+ Heart) must fail blood compatibility constraint."""
    svc = compat_env["compat_svc"]
    d2 = compat_env["d2"]
    r2 = compat_env["r2"]

    res = svc.evaluate_pair(d2.id, r2.id, persist=True)
    assert res.status == "INCOMPATIBLE"
    assert res.blood_score == 0.0
    assert res.organ_score == 100.0  # Organ matches
    assert res.score == 0.0
    assert any("blood" in f.lower() for f in res.hard_failures)


def test_find_candidates_for_donor_and_recipient(compat_env):
    svc = compat_env["compat_svc"]
    d1 = compat_env["d1"]
    r1 = compat_env["r1"]

    # Search candidates for Donor 1
    d_cands = svc.find_candidates_for_donor(d1.id, min_score=0.0)
    assert len(d_cands) >= 1
    assert d_cands[0].recipient_id == r1.id

    # Search candidates for Recipient 1
    r_cands = svc.find_candidates_for_recipient(r1.id, min_score=0.0)
    assert len(r_cands) >= 1
    assert r_cands[0].donor_id == d1.id


def test_evaluate_all_pairs_dataframe(compat_env):
    svc = compat_env["compat_svc"]
    df = svc.evaluate_all_pairs(prefilter=False)
    assert df is not None
    assert len(df) == 4  # 2 donors x 2 recipients
    assert "score" in df.columns
    assert "status" in df.columns


def test_candidate_edges_phase4_interface(compat_env):
    svc = compat_env["compat_svc"]
    d1 = compat_env["d1"]
    r1 = compat_env["r1"]

    svc.evaluate_pair(d1.id, r1.id, persist=True)
    edges = svc.get_candidate_edges(min_score=0.0, include_review=True)
    assert len(edges) >= 1
    edge = edges[0]
    assert "donor_id" in edge
    assert "recipient_id" in edge
    assert "score" in edge
    assert "metadata" in edge
    assert edge["score"] > 0


def test_cache_invalidation_on_entity_change(compat_env):
    svc = compat_env["compat_svc"]
    repo = compat_env["compat_repo"]
    d1 = compat_env["d1"]
    r1 = compat_env["r1"]

    svc.evaluate_pair(d1.id, r1.id, persist=True)
    assert repo.count() > 0

    # Invalidate donor
    deleted = svc.invalidate_entity_results("DONOR", d1.id)
    assert deleted >= 1
    assert repo.get_by_pair(d1.id, r1.id) is None
