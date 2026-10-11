"""Exhaustive unit tests for BloodCompatibilityRule across all 64 blood group combinations."""

import pytest
from compatibility.blood_rules import BloodCompatibilityRule
from config.matching_config import BLOOD_COMPATIBILITY_MAP
from config.settings import BLOOD_GROUPS
from database.models import Donor, Recipient


@pytest.fixture
def blood_rule():
    return BloodCompatibilityRule()


def make_donor(blood_group: str) -> Donor:
    return Donor(
        id=1,
        name="Test Donor",
        age=35,
        blood_group=blood_group,
        organ="Kidney",
        hospital_id=1,
        location="New York",
        availability="Available",
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01 00:00:00",
        updated_at="2026-01-01 00:00:00",
    )


def make_recipient(blood_group: str) -> Recipient:
    return Recipient(
        id=2,
        name="Test Recipient",
        age=40,
        blood_group=blood_group,
        organ_needed="Kidney",
        hospital_id=1,
        location="New York",
        urgency="High",
        waiting_time_days=180,
        phone=None,
        email=None,
        registration_date="2026-01-01",
        created_at="2026-01-01 00:00:00",
        updated_at="2026-01-01 00:00:00",
    )


def test_all_64_blood_group_combinations(blood_rule):
    """Exhaustively verify all 64 combinations (8 donor x 8 recipient blood groups)."""
    assert len(BLOOD_GROUPS) == 8

    tested_count = 0
    for d_bg in BLOOD_GROUPS:
        expected_recipients = BLOOD_COMPATIBILITY_MAP[d_bg]
        for r_bg in BLOOD_GROUPS:
            donor = make_donor(d_bg)
            recipient = make_recipient(r_bg)
            result = blood_rule.evaluate(donor, recipient)

            should_pass = r_bg in expected_recipients
            assert result.passed == should_pass, f"Failed for {d_bg} -> {r_bg}: expected {should_pass}, got {result.passed}"
            if should_pass:
                assert result.severity == "PASS"
                assert result.score == 100.0
                assert "passed" in result.message.lower()
            else:
                assert result.severity == "FAIL"
                assert result.score == 0.0
                assert "not permit" in result.message.lower()

            tested_count += 1

    assert tested_count == 64


def test_universal_donor_o_negative(blood_rule):
    """O- donor can donate to all 8 blood groups."""
    donor = make_donor("O-")
    for r_bg in BLOOD_GROUPS:
        recipient = make_recipient(r_bg)
        res = blood_rule.evaluate(donor, recipient)
        assert res.passed is True
        assert res.score == 100.0


def test_universal_recipient_ab_positive(blood_rule):
    """AB+ recipient can receive from all 8 blood groups."""
    recipient = make_recipient("AB+")
    for d_bg in BLOOD_GROUPS:
        donor = make_donor(d_bg)
        res = blood_rule.evaluate(donor, recipient)
        assert res.passed is True
        assert res.score == 100.0


def test_ab_positive_donor_isolated(blood_rule):
    """AB+ donor can ONLY donate to AB+."""
    donor = make_donor("AB+")
    for r_bg in BLOOD_GROUPS:
        recipient = make_recipient(r_bg)
        res = blood_rule.evaluate(donor, recipient)
        if r_bg == "AB+":
            assert res.passed is True
        else:
            assert res.passed is False
            assert res.score == 0.0


def test_missing_or_invalid_blood_group(blood_rule):
    """Ensure missing or unrecognized blood groups fail safely."""
    donor_blank = make_donor("")
    recip_valid = make_recipient("A+")
    res = blood_rule.evaluate(donor_blank, recip_valid)
    assert res.passed is False
    assert res.code == "BLOOD_MISSING"

    donor_unknown = make_donor("XYZ")
    res2 = blood_rule.evaluate(donor_unknown, recip_valid)
    assert res2.passed is False
    assert res2.code == "BLOOD_UNKNOWN_DONOR"
