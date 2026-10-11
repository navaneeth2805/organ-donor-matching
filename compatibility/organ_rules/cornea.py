"""Cornea-specific clinical assessment and ocular tissue readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class CorneaAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates corneal tissue morphological evaluation and endothelial integrity records."""

    def __init__(self):
        super().__init__(organ_name="Cornea")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "cornea"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"

        if status == "Assessment Complete":
            return RuleResult(
                passed=True,
                severity="PASS",
                code="CORNEA_ASSESSED",
                message=f"Cornea assessment complete: {getattr(assessment, 'assessment_notes', 'Clear stroma and specular microscopy verified')}.",
                score=100.0,
                metadata={"assessment_status": status},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CORNEA_PENDING",
                message="Corneal specular evaluation pending eye bank review.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CORNEA_NOT_ASSESSED",
                message="Corneal tissue evaluation not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
