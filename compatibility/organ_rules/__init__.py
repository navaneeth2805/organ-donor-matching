"""Organ-specific clinical assessment rule hooks registry and exports."""

from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from compatibility.organ_rules.base import BaseOrganAssessmentRule
from compatibility.organ_rules.bone_marrow import BoneMarrowAssessmentRule
from compatibility.organ_rules.cornea import CorneaAssessmentRule
from compatibility.organ_rules.heart import HeartAssessmentRule
from compatibility.organ_rules.kidney import KidneyAssessmentRule
from compatibility.organ_rules.liver import LiverAssessmentRule
from compatibility.organ_rules.lung import LungAssessmentRule
from compatibility.organ_rules.pancreas import PancreasAssessmentRule
from database.models import Donor, Recipient


class OrganCompatibilityRule(CompatibilityRule):
    """Evaluates anatomical organ match between offered organ and requested organ."""

    def __init__(self):
        super().__init__(rule_name="Organ Compatibility", is_hard_constraint=True)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        """Check if donor organ matches recipient required organ."""
        d_organ = str(donor.organ or "").strip()
        r_organ = str(recipient.organ_needed or "").strip()

        if not d_organ or not r_organ:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="ORGAN_MISSING",
                message="Organ specification missing on donor or recipient record.",
                score=0.0,
                metadata={"donor_organ": d_organ, "recipient_organ": r_organ},
            )

        d_clean = d_organ.lower()
        r_clean = r_organ.lower()

        if d_clean == r_clean:
            return RuleResult(
                passed=True,
                severity="PASS",
                code="ORGAN_MATCH",
                message=f"Organ match confirmed: Donor ({d_organ}) matches Recipient requirement ({r_organ}).",
                score=100.0,
                metadata={"donor_organ": d_organ, "recipient_organ": r_organ, "matched": True},
            )
        else:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="ORGAN_MISMATCH",
                message=f"Organ mismatch: Donor offers {d_organ}, but Recipient requires {r_organ}.",
                score=0.0,
                metadata={"donor_organ": d_organ, "recipient_organ": r_organ, "matched": False},
            )


ORGAN_RULE_REGISTRY: dict[str, BaseOrganAssessmentRule] = {
    "kidney": KidneyAssessmentRule(),
    "liver": LiverAssessmentRule(),
    "heart": HeartAssessmentRule(),
    "lung": LungAssessmentRule(),
    "pancreas": PancreasAssessmentRule(),
    "cornea": CorneaAssessmentRule(),
    "bone marrow": BoneMarrowAssessmentRule(),
}


def get_organ_assessment_rule(organ_name: str) -> BaseOrganAssessmentRule | None:
    """Return the organ-specific assessment rule hook for the given organ."""
    if not organ_name:
        return None
    return ORGAN_RULE_REGISTRY.get(organ_name.strip().lower())

