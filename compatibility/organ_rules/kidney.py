"""Kidney-specific clinical assessment and readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class KidneyAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates kidney-specific anatomical records and renal biomarker availability."""

    def __init__(self):
        super().__init__(organ_name="Kidney")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        renal_labs = donor_profile.get("laboratory")

        # Find kidney assessment if present
        kidney_assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "kidney"),
            None,
        )

        status = getattr(kidney_assessment, "assessment_status", "Not Assessed") if kidney_assessment else "Not Assessed"
        has_renal_labs = renal_labs is not None and getattr(renal_labs, "creatinine", None) is not None

        if status == "Assessment Complete":
            score = 100.0 if has_renal_labs else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="KIDNEY_ASSESSED",
                message=f"Kidney assessment complete: {getattr(kidney_assessment, 'assessment_notes', 'Standard anatomy')}.",
                score=score,
                metadata={"assessment_status": status, "has_renal_biomarkers": has_renal_labs},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="KIDNEY_PENDING",
                message="Kidney assessment is currently pending clinical sign-off.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="KIDNEY_NOT_ASSESSED",
                message="Kidney morphological assessment is not yet recorded for this donor.",
                score=40.0,
                metadata={"assessment_status": status},
            )
