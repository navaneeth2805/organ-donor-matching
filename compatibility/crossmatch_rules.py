"""Crossmatch compatibility and donor-specific antibody assessment rule."""

from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


class CrossmatchRule(CompatibilityRule):
    """Evaluates crossmatch testing status and prospective/virtual antibody compatibility."""

    def __init__(self):
        super().__init__(rule_name="Crossmatch Evaluation", is_hard_constraint=False)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        # Context may provide crossmatch either as a single CrossmatchResult or a list
        xm = ctx.get("crossmatch")
        if not xm:
            xm_list = ctx.get("crossmatches") or []
            # Find crossmatch specifically between this donor and recipient
            xm = next(
                (
                    x
                    for x in xm_list
                    if getattr(x, "donor_id", None) == donor.id
                    and getattr(x, "recipient_id", None) == recipient.id
                ),
                None,
            )

        if not xm or not getattr(xm, "result", None):
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CROSSMATCH_NOT_TESTED",
                message="Prospective/virtual crossmatch has not yet been performed for this pair.",
                score=50.0,
                metadata={"crossmatch_status": "Not Tested", "tested": False},
            )

        res = str(xm.result or "").strip().title()
        ab_info = getattr(xm, "antibody_information", None) or "None recorded"

        if res == "Negative":
            return RuleResult(
                passed=True,
                severity="PASS",
                code="CROSSMATCH_NEGATIVE",
                message="Crossmatch result is Negative: No donor-specific cytotoxic antibodies identified.",
                score=100.0,
                metadata={
                    "crossmatch_status": "Negative",
                    "antibody_information": ab_info,
                    "tested": True,
                },
            )
        elif res == "Positive":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CROSSMATCH_POSITIVE",
                message=f"Crossmatch is Positive ({ab_info}). Potential donor-specific antibodies; clinical review required.",
                score=20.0,
                metadata={
                    "crossmatch_status": "Positive",
                    "antibody_information": ab_info,
                    "tested": True,
                },
            )
        elif res == "Pending":
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CROSSMATCH_PENDING",
                message="Crossmatch laboratory assay is currently pending processing.",
                score=60.0,
                metadata={"crossmatch_status": "Pending", "tested": False},
            )
        else:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="CROSSMATCH_REVIEW_NEEDED",
                message=f"Crossmatch status is '{res}'. Clinical review or repeat testing recommended.",
                score=40.0,
                metadata={"crossmatch_status": res, "tested": True},
            )
