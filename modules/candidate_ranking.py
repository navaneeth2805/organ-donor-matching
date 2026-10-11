"""Candidate ranking engine implementing transparent, weighted multi-factor software scoring."""

from typing import Any
from config.matching_config import (
    DEFAULT_WEIGHTS,
    STATUS_INCOMPATIBLE,
    STATUS_INSUFFICIENT_DATA,
    URGENCY_SCORE_MAP,
    validate_matching_weights,
)
from database.models import Donor, Recipient


class CandidateRankingEngine:
    """Calculates deterministic, normalized software ranking scores (0 - 100 scale)."""

    def __init__(self, default_weights: dict[str, float] | None = None):
        self.weights = validate_matching_weights(default_weights or DEFAULT_WEIGHTS)

    def calculate_scores(
        self,
        donor: Donor,
        recipient: Recipient,
        rule_eval: dict[str, Any],
        weights_override: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """Calculate normalized component scores and overall weighted candidate ranking score."""
        active_weights = validate_matching_weights(weights_override or self.weights)
        comp_scores = rule_eval.get("component_scores", {})
        status = rule_eval.get("status")

        # 1. Blood Compatibility (0 or 100)
        blood_score = float(comp_scores.get("blood", 0.0))

        # 2. Organ Compatibility (0 or 100)
        organ_score = float(comp_scores.get("organ", 0.0))

        # 3. Clinical Data Readiness (0 - 100)
        clinical_score = float(comp_scores.get("clinical", 50.0))

        # 4. Software Urgency Priority (0 - 100)
        urgency_str = str(recipient.urgency or "").strip().title()
        urgency_score = self.map_urgency_score(urgency_str)

        # 5. Waiting Time Contribution (0 - 100)
        waiting_days = recipient.waiting_time_days if recipient.waiting_time_days is not None else 0
        waiting_score = self.normalize_waiting_time(waiting_days)

        # 6. HLA Histocompatibility & Data Readiness (0 - 100)
        hla_score = float(comp_scores.get("hla", 50.0))

        # 7. Geographic & Transit Logistics (0 - 100)
        geographic_score = float(comp_scores.get("geographic", 50.0))

        # 8. Clinical Profile Data Completeness (0 - 100)
        data_quality_score = float(comp_scores.get("data_quality", 50.0))

        # If pair is INCOMPATIBLE or INSUFFICIENT_DATA, total software candidate score is 0.0
        if status in (STATUS_INCOMPATIBLE, STATUS_INSUFFICIENT_DATA):
            overall_score = 0.0
        else:
            # Weighted calculation
            weighted_sum = (
                (blood_score * active_weights["blood"])
                + (organ_score * active_weights["organ"])
                + (clinical_score * active_weights["clinical"])
                + (urgency_score * active_weights["urgency"])
                + (waiting_score * active_weights["waiting_time"])
                + (hla_score * active_weights["hla"])
                + (geographic_score * active_weights["geographic"])
                + (data_quality_score * active_weights["data_quality"])
            ) / 100.0

            # Strictly bound between 0.0 and 100.0
            overall_score = round(max(0.0, min(100.0, weighted_sum)), 1)

        breakdown = {
            "overall_score": overall_score,
            "blood_score": round(blood_score, 1),
            "organ_score": round(organ_score, 1),
            "clinical_score": round(clinical_score, 1),
            "urgency_score": round(urgency_score, 1),
            "waiting_time_score": round(waiting_score, 1),
            "hla_score": round(hla_score, 1),
            "geographic_score": round(geographic_score, 1),
            "data_quality_score": round(data_quality_score, 1),
            "active_weights": active_weights,
            "weighted_contributions": {
                "blood": round(blood_score * active_weights["blood"] / 100.0, 1),
                "organ": round(organ_score * active_weights["organ"] / 100.0, 1),
                "clinical": round(clinical_score * active_weights["clinical"] / 100.0, 1),
                "urgency": round(urgency_score * active_weights["urgency"] / 100.0, 1),
                "waiting_time": round(waiting_score * active_weights["waiting_time"] / 100.0, 1),
                "hla": round(hla_score * active_weights["hla"] / 100.0, 1),
                "geographic": round(geographic_score * active_weights["geographic"] / 100.0, 1),
                "data_quality": round(data_quality_score * active_weights["data_quality"] / 100.0, 1),
            },
        }
        return breakdown

    def evaluate_with_weights(
        self,
        donor: Donor,
        recipient: Recipient,
        rule_eval: dict[str, Any],
        weights: dict[str, float],
    ) -> float:
        """Convenience method for simulation and sensitivity analysis."""
        scores = self.calculate_scores(donor, recipient, rule_eval, weights_override=weights)
        return scores["overall_score"]

    @staticmethod
    def map_urgency_score(urgency: str) -> float:
        """Map categorical urgency level to normalized priority score (0 - 100)."""
        clean = str(urgency or "").strip().title()
        return URGENCY_SCORE_MAP.get(clean, 25.0)

    @staticmethod
    def normalize_waiting_time(waiting_days: int) -> float:
        """Normalize waiting time in days onto a logarithmic/linear asymptotic scale (0 - 100)."""
        if waiting_days is None or waiting_days <= 0:
            return 0.0
        # Curve: 180 days (~6 months) -> ~40 pts, 365 days (~1 yr) -> ~60 pts, 730 days (~2 yrs) -> ~80 pts, 1500+ days -> 100 pts
        score = min(100.0, (waiting_days / 15.0) if waiting_days < 365 else 24.3 + (waiting_days / 20.0))
        return round(max(0.0, min(100.0, score)), 1)
