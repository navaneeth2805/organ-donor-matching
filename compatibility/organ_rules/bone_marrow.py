"""Bone marrow clinical assessment and cellularity readiness rule hook."""

from typing import Any
from compatibility.base_rule import RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from database.models import Donor, Recipient


class BoneMarrowAssessmentRule(BaseOrganAssessmentRule):
    """Evaluates bone marrow / hematopoietic stem cell harvest suitability and cellularity."""

    def __init__(self):
        super().__init__(organ_name="Bone Marrow")

    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        organ_assessments = donor_profile.get("organ_assessments") or []
        hla = donor_profile.get("hla")

        assessment = next(
            (a for a in organ_assessments if str(getattr(a, "organ", "")).lower() == "bone marrow"),
            None,
        )

        status = getattr(assessment, "assessment_status", "Not Assessed") if assessment else "Not Assessed"
        has_hla = hla is not None and getattr(hla, "hla_a", None) is not None

        if status == "Assessment Complete":
            score = 100.0 if has_hla else 85.0
            return RuleResult(
                passed=True,
                severity="PASS",
                code="BONE_MARROW_ASSESSED",
                message=f"Bone marrow assessment complete: {getattr(assessment, 'assessment_notes', 'Cellularity and CD34+ count verified')}.",
                score=score,
                metadata={"assessment_status": status, "has_hla_genotyping": has_hla},
            )
        elif status == "Assessment Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="BONE_MARROW_PENDING",
                message="Bone marrow harvest workup pending laboratory verification.",
                score=60.0,
                metadata={"assessment_status": status},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="BONE_MARROW_NOT_ASSESSED",
                message="Bone marrow assessment not yet recorded.",
                score=40.0,
                metadata={"assessment_status": status},
            )
