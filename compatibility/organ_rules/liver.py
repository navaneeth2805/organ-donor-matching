"""Liver-specific clinical assessment and readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class LiverAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates liver-specific anatomical assessments and hepatic biomarker records."""

    def __init__(self):
        super().__init__(organ_name="Liver")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        hepatic_labs = donor_profile.get("laboratory")

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "liver"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"
        has_hepatic_labs = hepatic_labs is not None and getattr(hepatic_labs, "bilirubin", None) is not None

        if status == "Assessment Complete":
            score = 100.0 if has_hepatic_labs else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="LIVER_ASSESSED",
                message=f"Liver assessment complete: {getattr(assessment, 'assessment_notes', 'Standard parenchymal status')}.",
                score=score,
                metadata={"assessment_status": status, "has_hepatic_biomarkers": has_hepatic_labs},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="LIVER_PENDING",
                message="Liver clinical assessment is pending finalization.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="LIVER_NOT_ASSESSED",
                message="Liver morphological assessment not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
