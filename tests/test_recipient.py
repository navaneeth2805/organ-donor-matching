"""Automated tests for Recipient domain entity, waitlist service, and repository."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.repositories import AuditLogRepository, HospitalRepository, RecipientRepository
from modules.hospital import HospitalService
from modules.recipient import RecipientService
from utils.exceptions import DuplicateRecordError, RecordNotFoundError


@pytest.fixture
def recipient_env():
    """Create isolated test environment with temporary database and hospital dependency."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()
    hosp_repo = HospitalRepository(db)
    audit_repo = AuditLogRepository(db)
    recip_repo = RecipientRepository(db)

    hosp_svc = HospitalService(hosp_repo, audit_repo)
    recip_svc = RecipientService(recip_repo, hosp_repo, audit_repo)

    hospital = hosp_svc.add_hospital("Regional Transplant Center", "Bengaluru", "Karnataka")

    yield recip_svc, hospital.id, audit_repo
    if os.path.exists(path):
        os.remove(path)


def test_create_and_get_recipient(recipient_env):
    """Test registering and retrieving a recipient on the waitlist."""
    recip_svc, hosp_id, audit_repo = recipient_env
    recip = recip_svc.create_recipient(
        recipient_id=601,
        name="Gregory House",
        age=45,
        blood_group="AB+",
        organ_needed="Kidney",
        hospital_id=hosp_id,
        location="Bengaluru",
        urgency="Critical",
        waiting_time_days=180,
        phone="+91 9900112233",
        email="greg@example.org",
        registration_date="2026-08-01",
    )
    assert recip.id == 601
    assert recip.name == "Gregory House"
    assert recip.urgency == "Critical"
    assert recip.waiting_time_days == 180

    fetched = recip_svc.get_recipient_by_id(601)
    assert fetched.organ_needed == "Kidney"
    assert fetched.hospital_id == hosp_id

    logs = audit_repo.get_by_entity("recipient", 601)
    assert len(logs) >= 1
    assert logs[0].action == "CREATE"


def test_duplicate_recipient_id(recipient_env):
    """Test duplicate recipient ID detection."""
    recip_svc, hosp_id, _ = recipient_env
    recip_svc.create_recipient(
        recipient_id=602,
        name="Patient A",
        age=30,
        blood_group="O+",
        organ_needed="Heart",
        hospital_id=hosp_id,
        location="Bengaluru",
        urgency="High",
    )
    with pytest.raises(DuplicateRecordError):
        recip_svc.create_recipient(
            recipient_id=602,
            name="Patient B",
            age=50,
            blood_group="A-",
            organ_needed="Liver",
            hospital_id=hosp_id,
            location="Bengaluru",
            urgency="Medium",
        )


def test_update_and_delete_recipient(recipient_env):
    """Test updating recipient urgency and deleting record."""
    recip_svc, hosp_id, audit_repo = recipient_env
    recip = recip_svc.create_recipient(
        recipient_id=603,
        name="Allison Cameron",
        age=33,
        blood_group="A+",
        organ_needed="Liver",
        hospital_id=hosp_id,
        location="Bengaluru",
        urgency="Medium",
        waiting_time_days=90,
    )
    updated = recip_svc.update_recipient(
        recipient_id=603,
        name="Allison Cameron",
        age=33,
        blood_group="A+",
        organ_needed="Liver",
        hospital_id=hosp_id,
        location="Bengaluru",
        urgency="Critical",
        waiting_time_days=105,
    )
    assert updated.urgency == "Critical"
    assert updated.waiting_time_days == 105

    deleted = recip_svc.delete_recipient(603)
    assert deleted is True

    with pytest.raises(RecordNotFoundError):
        recip_svc.get_recipient_by_id(603)

    logs = audit_repo.get_by_entity("recipient", 603)
    actions = [l.action for l in logs]
    assert "DELETE" in actions


def test_search_and_filter_recipients(recipient_env):
    """Test searching and filtering waitlist recipients."""
    recip_svc, hosp_id, _ = recipient_env
    recip_svc.create_recipient(604, "Eric Foreman", 36, "B+", "Lung", hosp_id, "Mysuru", "High", 45)
    recip_svc.create_recipient(605, "Lisa Cuddy", 42, "O-", "Heart", hosp_id, "Bengaluru", "Critical", 200)

    # Search
    search_res = recip_svc.search_recipients("foreman")
    assert len(search_res) == 1
    assert search_res[0].id == 604

    # Filter by urgency
    urg_res = recip_svc.filter_recipients(urgency="Critical")
    assert any(r.id == 605 for r in urg_res)
    assert not any(r.id == 604 for r in urg_res)

    # Filter by min waiting time
    wt_res = recip_svc.filter_recipients(min_waiting_time=100)
    assert len(wt_res) == 1
    assert wt_res[0].id == 605
