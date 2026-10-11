"""Unit tests for OrganCompatibilityRule and organ-specific rule hooks."""

import pytest
from compatibility.organ_rules import OrganCompatibilityRule, get_organ_assessment_rule
from config.settings import ORGANS
from database.models import Donor, Recipient


@pytest.fixture
def organ_rule():
    return OrganCompatibilityRule()


def make_donor(organ: str) -> Donor:
    return Donor(
        id=1,
        name="Donor",
        age=30,
        blood_group="O+",
        organ=organ,
        hospital_id=1,
        location="Boston",
        availability="Available",
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01 00:00:00",
        updated_at="2026-01-01 00:00:00",
    )


def make_recipient(organ: str) -> Recipient:
    return Recipient(
        id=2,
        name="Recipient",
        age=35,
        blood_group="O+",
        organ_needed=organ,
        hospital_id=1,
        location="Boston",
        urgency="Medium",
        waiting_time_days=90,
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01 00:00:00",
        updated_at="2026-01-01 00:00:00",
    )


def test_organ_matching_combinations(organ_rule):
    """Test that same organs pass and mismatched organs fail."""
    for org in ORGANS:
        d = make_donor(org)
        r = make_recipient(org)
        res = organ_rule.evaluate(d, r)
        assert res.passed is True
        assert res.score == 100.0
        assert res.code == "ORGAN_MATCH"


def test_organ_mismatches(organ_rule):
    """Mismatched organs must fail the hard constraint with score 0.0."""
    d = make_donor("Kidney")
    r = make_recipient("Heart")
    res = organ_rule.evaluate(d, r)
    assert res.passed is False
    assert res.score == 0.0
    assert res.code == "ORGAN_MISMATCH"
    assert "mismatch" in res.message.lower()


def test_organ_assessment_registry_hooks():
    """Verify each supported organ has a registered clinical assessment rule hook."""
    for org in ORGANS:
        hook = get_organ_assessment_rule(org)
        assert hook is not None
        assert hook.organ_name.lower() == org.lower()
