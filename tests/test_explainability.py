"""Unit tests for ExplainabilityEngine verifying transparent rationales."""

import pytest
from database.models import Donor, Recipient
from modules.explainability import ExplainabilityEngine


@pytest.fixture
def explain_engine():
    return ExplainabilityEngine()


def make_donor_and_recipient():
    d = Donor(101, "Donor Alice", 30, "O+", "Kidney", 1, "Boston", "Available", None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    r = Recipient(201, "Recipient Bob", 40, "O+", "Kidney", 1, "Boston", "High", 120, None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    return d, r


def test_incompatible_pair_explanation(explain_engine):
    d, r = make_donor_and_recipient()
    hard_failures = ["Organ mismatch: Donor offers Kidney, but Recipient requires Heart."]
    res = explain_engine.generate_explanation(
        donor=d,
        recipient=r,
        status="INCOMPATIBLE",
        hard_failures=hard_failures,
        warnings=[],
        explanations=[],
        scores={"overall_score": 0.0},
    )
    assert len(res["why_not"]) > 0
    assert "Organ mismatch" in res["why_not"][0]
    assert "INELIGIBLE" in res["header"]


def test_review_pair_explanation(explain_engine):
    d, r = make_donor_and_recipient()
    warnings = ["Crossmatch is Positive: Donor-specific antibodies present."]
    explanations = ["Organ match confirmed", "Blood compatibility passed"]
    res = explain_engine.generate_explanation(
        donor=d,
        recipient=r,
        status="REQUIRES_REVIEW",
        hard_failures=[],
        warnings=warnings,
        explanations=explanations,
        scores={"overall_score": 75.0},
    )
    assert len(res["review_requirements"]) > 0
    assert "Crossmatch is Positive" in res["review_requirements"][0]
    assert len(res["why_candidate"]) > 0


def test_candidate_pair_explanation(explain_engine):
    d, r = make_donor_and_recipient()
    explanations = ["Organ match confirmed", "Blood compatibility passed", "Donor available"]
    res = explain_engine.generate_explanation(
        donor=d,
        recipient=r,
        status="POTENTIAL_CANDIDATE",
        hard_failures=[],
        warnings=[],
        explanations=explanations,
        scores={"overall_score": 88.0},
    )
    assert len(res["why_candidate"]) == 3
    assert "POTENTIAL CANDIDATE" in res["header"]
