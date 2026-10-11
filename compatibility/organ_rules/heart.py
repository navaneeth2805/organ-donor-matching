"""Heart-specific clinical assessment and hemodynamic readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class HeartAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates heart-specific cardiac assessments, ECG, and echocardiogram records."""

    def __init__(self):
        super().__init__(organ_name="Heart")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        cardiac = donor_profile.get("cardiac")

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "heart"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"
        has_cardiac_eval = cardiac is not None and getattr(cardiac, "ecg_status", "Not Assessed") != "Not Assessed"

        if status == "Assessment Complete":
            score = 100.0 if has_cardiac_eval else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="HEART_ASSESSED",
                message=f"Heart structural assessment complete: {getattr(assessment, 'assessment_notes', 'Normal ventricular chambers')}.",
                score=score,
                metadata={"assessment_status": status, "has_cardiac_electrophysiology": has_cardiac_eval},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="HEART_PENDING",
                message="Heart donor clinical assessment is pending final echocardiography review.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="HEART_NOT_ASSESSED",
                message="Heart donor structural assessment not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
