"""Pancreas-specific clinical assessment and endocrine readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class PancreasAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates pancreas-specific anatomical assessments and glycemic control records."""

    def __init__(self):
        super().__init__(organ_name="Pancreas")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        labs = donor_profile.get("laboratory")

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "pancreas"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"
        has_glucose = labs is not None and getattr(labs, "blood_glucose", None) is not None

        if status == "Assessment Complete":
            score = 100.0 if has_glucose else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="PANCREAS_ASSESSED",
                message=f"Pancreas assessment complete: {getattr(assessment, 'assessment_notes', 'Parenchyma preserved')}.",
                score=score,
                metadata={"assessment_status": status, "has_glycemic_records": has_glucose},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="PANCREAS_PENDING",
                message="Pancreas assessment pending laboratory islet review.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="PANCREAS_NOT_ASSESSED",
                message="Pancreas morphological assessment not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
