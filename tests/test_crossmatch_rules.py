"""Unit tests for CrossmatchRule evaluating prospective/virtual antibody compatibility."""

import pytest
from compatibility.crossmatch_rules import CrossmatchRule
from database.models import CrossmatchResult, Donor, Recipient


@pytest.fixture
def xm_rule():
    return CrossmatchRule()


def make_donor_and_recipient():
    d = Donor(1, "Donor", 30, "O+", "Kidney", 1, "Boston", "Available", None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    r = Recipient(2, "Recipient", 40, "O+", "Kidney", 1, "Boston", "High", 120, None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    return d, r


def test_crossmatch_negative_pass(xm_rule):
    d, r = make_donor_and_recipient()
    xm = CrossmatchResult(None, 1, 2, "Negative", "No DSA", "2026-01-01", None, "2026-01-01", "2026-01-01")
    res = xm_rule.evaluate(d, r, context={"crossmatch": xm})
    assert res.passed is True
    assert res.severity == "PASS"
    assert res.score == 100.0
    assert res.code == "CROSSMATCH_NEGATIVE"


def test_crossmatch_positive_review(xm_rule):
    d, r = make_donor_and_recipient()
    xm = CrossmatchResult(None, 1, 2, "Positive", "Anti-HLA-A*02 (MFI 4500)", "2026-01-01", None, "2026-01-01", "2026-01-01")
    res = xm_rule.evaluate(d, r, context={"crossmatch": xm})
    assert res.passed is True
    assert res.severity == "REVIEW"
    assert res.score == 20.0
    assert res.code == "CROSSMATCH_POSITIVE"


def test_crossmatch_not_tested(xm_rule):
    d, r = make_donor_and_recipient()
    res = xm_rule.evaluate(d, r, context={})
    assert res.passed is True
    assert res.severity == "REVIEW"
    assert res.code == "CROSSMATCH_NOT_TESTED"
