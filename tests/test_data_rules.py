"""Unit tests for RequiredDataRule and data completeness gates."""

import pytest
from compatibility.data_rules import RequiredDataRule
from database.models import Donor, Recipient


@pytest.fixture
def data_rule():
    return RequiredDataRule()


def test_complete_records_pass(data_rule):
    d = Donor(
        id=1,
        name="Donor",
        age=30,
        blood_group="O+",
        organ="Kidney",
        hospital_id=1,
        location="NY",
        availability="Available",
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    r = Recipient(
        id=2,
        name="Recipient",
        age=45,
        blood_group="O+",
        organ_needed="Kidney",
        hospital_id=1,
        location="NY",
        urgency="High",
        waiting_time_days=100,
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    res = data_rule.evaluate(d, r)
    assert res.passed is True
    assert res.code == "DATA_COMPLETE"


def test_missing_donor_data_fails(data_rule):
    d = Donor(
        id=1,
        name="Donor",
        age=30,
        blood_group="",  # Missing
        organ="Kidney",
        hospital_id=1,
        location="NY",
        availability="Available",
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    r = Recipient(
        id=2,
        name="Recipient",
        age=45,
        blood_group="O+",
        organ_needed="Kidney",
        hospital_id=1,
        location="NY",
        urgency="High",
        waiting_time_days=100,
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    res = data_rule.evaluate(d, r)
    assert res.passed is False
    assert res.code == "INSUFFICIENT_DATA"
    assert "Donor blood group" in res.message
