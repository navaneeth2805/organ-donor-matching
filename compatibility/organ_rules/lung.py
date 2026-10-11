"""Lung-specific clinical assessment and pulmonary readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class LungAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates lung-specific anatomical assessments and oxygenation records."""

    def __init__(self):
        super().__init__(organ_name="Lung")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        vitals = donor_profile.get("vitals")

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "lung"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"
        has_spo2 = vitals is not None and getattr(vitals, "spo2", None) is not None

        if status == "Assessment Complete":
            score = 100.0 if has_spo2 else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="LUNG_ASSESSED",
                message=f"Lung assessment complete: {getattr(assessment, 'assessment_notes', 'Clear lung fields')}.",
                score=score,
                metadata={"assessment_status": status, "has_pulmonary_vitals": has_spo2},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="LUNG_PENDING",
                message="Pulmonary assessment pending arterial blood gas verification.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="LUNG_NOT_ASSESSED",
                message="Lung morphological assessment not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
