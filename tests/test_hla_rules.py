"""Unit tests for HLARule evaluating histocompatibility and loci comparison."""

import pytest
from compatibility.hla_rules import HLARule
from database.models import Donor, HLAProfile, Recipient


@pytest.fixture
def hla_rule():
    return HLARule()


def make_donor_and_recipient():
    d = Donor(1, "Donor", 30, "O+", "Kidney", 1, "Boston", "Available", None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    r = Recipient(2, "Recipient", 40, "O+", "Kidney", 1, "Boston", "High", 120, None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    return d, r


def test_hla_missing_for_both(hla_rule):
    d, r = make_donor_and_recipient()
    res = hla_rule.evaluate(d, r, context={})
    assert res.passed is True
    assert res.severity == "REVIEW"
    assert res.code == "HLA_NOT_RECORDED"


def test_hla_full_match(hla_rule):
    d, r = make_donor_and_recipient()
    d_hla = HLAProfile(
        id=None,
        entity_type="DONOR",
        entity_id=1,
        hla_a="A*02, A*24",
        hla_b="B*07, B*08",
        hla_c="C*07",
        hla_dr="DRB1*04",
        hla_dq="DQB1*03",
        antibody_information=None,
        test_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    r_hla = HLAProfile(
        id=None,
        entity_type="RECIPIENT",
        entity_id=2,
        hla_a="A*02, A*03",
        hla_b="B*07, B*14",
        hla_c="C*07",
        hla_dr="DRB1*04",
        hla_dq="DQB1*03",
        antibody_information=None,
        test_date="2026-01-01",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )

    ctx = {
        "donor_profile": {"hla": d_hla},
        "recipient_profile": {"hla": r_hla},
    }
    res = hla_rule.evaluate(d, r, context=ctx)
    assert res.passed is True
    assert res.severity == "PASS"
    assert res.score >= 80.0
    assert res.metadata["matched_loci_count"] == 5
