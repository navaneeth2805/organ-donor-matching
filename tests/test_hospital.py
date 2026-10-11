"""Automated tests for Hospital service and repository."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.repositories import AuditLogRepository, HospitalRepository
from modules.hospital import HospitalService
from utils.exceptions import DuplicateRecordError, RecordNotFoundError


@pytest.fixture
def hospital_env():
    """Create isolated hospital service with temporary test database."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()
    hosp_repo = HospitalRepository(db)
    audit_repo = AuditLogRepository(db)
    svc = HospitalService(hosp_repo, audit_repo)
    yield svc, hosp_repo, audit_repo
    if os.path.exists(path):
        os.remove(path)


def test_hospital_create_and_get(hospital_env):
    """Test creating and retrieving a hospital."""
    svc, _, _ = hospital_env
    hosp = svc.add_hospital(
        name="Metro Transplant Center",
        city="Kolkata",
        state="West Bengal",
        country="India",
        phone="+91 33 22001122",
        email="transplant@metro.org",
    )
    assert hosp.id is not None
    assert hosp.name == "Metro Transplant Center"

    fetched = svc.get_hospital_by_id(hosp.id)
    assert fetched.city == "Kolkata"
    assert fetched.active == 1


def test_duplicate_hospital_name(hospital_env):
    """Test that duplicate hospital names raise DuplicateRecordError."""
    svc, _, _ = hospital_env
    svc.add_hospital("Unique Hospital", "Delhi", "Delhi")
    with pytest.raises(DuplicateRecordError):
        svc.add_hospital("Unique Hospital", "Delhi", "Delhi")


def test_hospital_update_and_toggle(hospital_env):
    """Test updating hospital details and toggling active status."""
    svc, _, _ = hospital_env
    hosp = svc.add_hospital("Central Clinic", "Pune", "Maharashtra")
    updated = svc.update_hospital(
        hospital_id=hosp.id,
        name="Central Medical Center",
        city="Pune",
        state="Maharashtra",
        phone="+91 20 12345678",
    )
    assert updated.name == "Central Medical Center"

    svc.toggle_active(hosp.id, False)
    deactivated = svc.get_hospital_by_id(hosp.id)
    assert deactivated.active == 0


def test_hospital_search(hospital_env):
    """Test hospital searching by city or name."""
    svc, _, _ = hospital_env
    svc.add_hospital("Ruby General", "Kolkata", "West Bengal")
    svc.add_hospital("Lilavati Hospital", "Mumbai", "Maharashtra")

    results = svc.search_hospitals("Ruby")
    assert len(results) == 1
    assert results[0].name == "Ruby General"

    results_city = svc.search_hospitals("Mumbai")
    assert len(results_city) == 1
    assert results_city[0].name == "Lilavati Hospital"
