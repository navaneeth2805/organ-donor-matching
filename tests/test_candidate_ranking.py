"""Unit tests for CandidateRankingEngine multi-factor scoring and weight validation."""

import pytest
from config.matching_config import DEFAULT_WEIGHTS, validate_matching_weights
from database.models import Donor, Recipient
from modules.candidate_ranking import CandidateRankingEngine
from utils.exceptions import ValidationError


@pytest.fixture
def ranking_engine():
    return CandidateRankingEngine()


def make_donor_and_recipient():
    d = Donor(1, "Donor", 30, "O+", "Kidney", 1, "Boston", "Available", None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    r = Recipient(2, "Recipient", 40, "O+", "Kidney", 1, "Boston", "High", 120, None, None, "2026-01-01", "2026-01-01", "2026-01-01")
    return d, r


def test_weight_validation_valid():
    w = validate_matching_weights(DEFAULT_WEIGHTS)
    assert sum(w.values()) == 100.0


def test_weight_validation_invalid_sum():
    bad_weights = dict(DEFAULT_WEIGHTS)
    bad_weights["blood"] = 50.0  # Sum is now 130
    with pytest.raises(ValidationError) as exc:
        validate_matching_weights(bad_weights)
    assert "must equal 100.0" in str(exc.value)


def test_weight_validation_negative():
    bad_weights = dict(DEFAULT_WEIGHTS)
    bad_weights["blood"] = -10.0
    bad_weights["organ"] = 30.0
    with pytest.raises(ValidationError) as exc:
        validate_matching_weights(bad_weights)
    assert "cannot be negative" in str(exc.value)


def test_score_bounded_zero_to_hundred(ranking_engine):
    d, r = make_donor_and_recipient()
    rule_eval = {
        "status": "POTENTIAL_CANDIDATE",
        "component_scores": {
            "blood": 100.0,
            "organ": 100.0,
            "clinical": 100.0,
            "hla": 100.0,
            "geographic": 100.0,
            "data_quality": 100.0,
        },
    }
    scores = ranking_engine.calculate_scores(d, r, rule_eval)
    assert 0.0 <= scores["overall_score"] <= 100.0
    assert scores["overall_score"] > 80.0


def test_urgency_increases_score(ranking_engine):
    d, r_low = make_donor_and_recipient()
    r_low.urgency = "Low"
    _, r_crit = make_donor_and_recipient()
    r_crit.urgency = "Critical"

    rule_eval = {
        "status": "POTENTIAL_CANDIDATE",
        "component_scores": {
            "blood": 100.0,
            "organ": 100.0,
            "clinical": 80.0,
            "hla": 70.0,
            "geographic": 80.0,
            "data_quality": 80.0,
        },
    }
    score_low = ranking_engine.calculate_scores(d, r_low, rule_eval)["overall_score"]
    score_crit = ranking_engine.calculate_scores(d, r_crit, rule_eval)["overall_score"]
    assert score_crit > score_low


def test_waiting_time_increases_score(ranking_engine):
    d, r_short = make_donor_and_recipient()
    r_short.waiting_time_days = 10
    _, r_long = make_donor_and_recipient()
    r_long.waiting_time_days = 800

    rule_eval = {
        "status": "POTENTIAL_CANDIDATE",
        "component_scores": {
            "blood": 100.0,
            "organ": 100.0,
            "clinical": 80.0,
            "hla": 70.0,
            "geographic": 80.0,
            "data_quality": 80.0,
        },
    }
    score_short = ranking_engine.calculate_scores(d, r_short, rule_eval)["overall_score"]
    score_long = ranking_engine.calculate_scores(d, r_long, rule_eval)["overall_score"]
    assert score_long > score_short
