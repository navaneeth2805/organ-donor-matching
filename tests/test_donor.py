"""Automated tests for Donor domain entity, service, and repository."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.repositories import AuditLogRepository, DonorRepository, HospitalRepository
from modules.donor import DonorService
from modules.hospital import HospitalService
from utils.exceptions import DuplicateRecordError, RecordNotFoundError, ValidationError


@pytest.fixture
def donor_env():
    """Create isolated test environment with temporary database and hospital dependency."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()
    hosp_repo = HospitalRepository(db)
    audit_repo = AuditLogRepository(db)
    donor_repo = DonorRepository(db)

    hosp_svc = HospitalService(hosp_repo, audit_repo)
    donor_svc = DonorService(donor_repo, hosp_repo, audit_repo)

    # Seed an active hospital
    hospital = hosp_svc.add_hospital("Base Hospital", "New Delhi", "Delhi")

    yield donor_svc, hospital.id, audit_repo
    if os.path.exists(path):
        os.remove(path)


def test_create_and_get_donor(donor_env):
    """Test registering and retrieving a donor."""
    donor_svc, hosp_id, audit_repo = donor_env
    donor = donor_svc.create_donor(
        donor_id=501,
        name="James Wilson",
        age=32,
        blood_group="O+",
        organ="Kidney",
        hospital_id=hosp_id,
        location="New Delhi",
        availability="Available",
        phone="+91 9988776655",
        email="james@example.org",
        registration_date="2026-09-01",
    )
    assert donor.id == 501
    assert donor.name == "James Wilson"
    assert donor.blood_group == "O+"

    fetched = donor_svc.get_donor_by_id(501)
    assert fetched.organ == "Kidney"
    assert fetched.hospital_id == hosp_id

    # Check audit log
    logs = audit_repo.get_by_entity("donor", 501)
    assert len(logs) >= 1
    assert logs[0].action == "CREATE"


def test_duplicate_donor_id(donor_env):
    """Test that registering duplicate donor IDs raises DuplicateRecordError."""
    donor_svc, hosp_id, _ = donor_env
    donor_svc.create_donor(
        donor_id=502,
        name="Donor Alpha",
        age=25,
        blood_group="A+",
        organ="Liver",
        hospital_id=hosp_id,
        location="Delhi",
        availability="Available",
    )
    with pytest.raises(DuplicateRecordError):
        donor_svc.create_donor(
            donor_id=502,
            name="Donor Beta",
            age=40,
            blood_group="B+",
            organ="Kidney",
            hospital_id=hosp_id,
            location="Delhi",
            availability="Available",
        )


def test_update_and_delete_donor(donor_env):
    """Test updating and deleting a donor record."""
    donor_svc, hosp_id, audit_repo = donor_env
    donor = donor_svc.create_donor(
        donor_id=503,
        name="Robert Chase",
        age=30,
        blood_group="B+",
        organ="Heart",
        hospital_id=hosp_id,
        location="Noida",
        availability="Available",
    )
    updated = donor_svc.update_donor(
        donor_id=503,
        name="Robert Chase",
        age=31,
        blood_group="B+",
        organ="Heart",
        hospital_id=hosp_id,
        location="Gurugram",
        availability="Pending",
    )
    assert updated.age == 31
    assert updated.availability == "Pending"

    deleted = donor_svc.delete_donor(503)
    assert deleted is True

    with pytest.raises(RecordNotFoundError):
        donor_svc.get_donor_by_id(503)

    # Check audit log for deletion
    logs = audit_repo.get_by_entity("donor", 503)
    actions = [l.action for l in logs]
    assert "DELETE" in actions


def test_search_and_filter_donors(donor_env):
    """Test multi-parameter filtering and case-insensitive text search."""
    donor_svc, hosp_id, _ = donor_env
    donor_svc.create_donor(504, "Alice Green", 22, "O-", "Kidney", hosp_id, "South Delhi", "Available")
    donor_svc.create_donor(505, "Bob Vance", 55, "AB+", "Liver", hosp_id, "North Delhi", "Unavailable")

    # Search by name
    res_search = donor_svc.search_donors("alice")
    assert len(res_search) == 1
    assert res_search[0].id == 504

    # Filter by availability
    res_filter = donor_svc.filter_donors(availability="Available")
    assert any(d.id == 504 for d in res_filter)
    assert not any(d.id == 505 for d in res_filter)

    # Filter by age range
    res_age = donor_svc.filter_donors(min_age=50, max_age=60)
    assert len(res_age) == 1
    assert res_age[0].id == 505
