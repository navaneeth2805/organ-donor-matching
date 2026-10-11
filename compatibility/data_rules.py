"""Required data completeness and data quality gate rule."""

from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


class RequiredDataRule(CompatibilityRule):
    """Verifies that fundamental candidate information and clinical records are sufficiently complete."""

    def __init__(self, min_completeness_pct: float = 30.0):
        super().__init__(rule_name="Required Data Completeness", is_hard_constraint=True)
        self.min_completeness_pct = min_completeness_pct

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        missing_fields: list[str] = []

        if not donor or donor.id is None:
            missing_fields.append("Valid Donor record")
        if not recipient or recipient.id is None:
            missing_fields.append("Valid Recipient record")

        if donor:
            if not getattr(donor, "blood_group", None):
                missing_fields.append("Donor blood group")
            if not getattr(donor, "organ", None):
                missing_fields.append("Donor organ")
            if not getattr(donor, "availability", None):
                missing_fields.append("Donor availability status")

        if recipient:
            if not getattr(recipient, "blood_group", None):
                missing_fields.append("Recipient blood group")
            if not getattr(recipient, "organ_needed", None):
                missing_fields.append("Recipient organ needed")
            if not getattr(recipient, "urgency", None):
                missing_fields.append("Recipient urgency priority")

        if missing_fields:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="INSUFFICIENT_DATA",
                message=f"Fundamental data is missing: {', '.join(missing_fields)}.",
                score=0.0,
                metadata={"missing_fields": missing_fields},
            )

        # Evaluate Data Quality from Context if present
        ctx = context or {}
        donor_dq = ctx.get("donor_quality")
        recip_dq = ctx.get("recipient_quality")

        d_score = getattr(donor_dq, "overall_score", 100.0) if donor_dq else 100.0
        r_score = getattr(recip_dq, "overall_score", 100.0) if recip_dq else 100.0
        avg_quality = round((d_score + r_score) / 2.0, 1)

        if avg_quality < self.min_completeness_pct:
            return RuleResult(
                passed=False,
                severity="REVIEW",
                code="DATA_QUALITY_LOW",
                message=f"Clinical profile completeness is low (Donor: {d_score:.0f}%, Recipient: {r_score:.0f}%). Review required.",
                score=avg_quality,
                metadata={"donor_completeness": d_score, "recipient_completeness": r_score},
            )

        return RuleResult(
            passed=True,
            severity="PASS",
            code="DATA_COMPLETE",
            message=f"All required clinical data present (Profile completeness: {avg_quality:.0f}%).",
            score=avg_quality,
            metadata={"donor_completeness": d_score, "recipient_completeness": r_score},
        )
