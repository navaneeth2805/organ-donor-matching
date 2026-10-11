"""Donor availability verification rule."""

from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


class AvailabilityRule(CompatibilityRule):
    """Evaluates donor availability state to ensure candidates are currently allocatable."""

    def __init__(self):
        super().__init__(rule_name="Donor Availability", is_hard_constraint=True)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        avail = str(donor.availability or "").strip()

        if avail.lower() == "available":
            return RuleResult(
                passed=True,
                severity="PASS",
                code="DONOR_AVAILABLE",
                message="Donor status is currently 'Available'.",
                score=100.0,
                metadata={"availability": avail},
            )
        elif avail.lower() == "pending":
            return RuleResult(
                passed=False,
                severity="REVIEW",
                code="DONOR_PENDING",
                message="Donor status is 'Pending' clinical verification; review required before matching.",
                score=50.0,
                metadata={"availability": avail},
            )
        else:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="DONOR_UNAVAILABLE",
                message=f"Donor is currently '{avail or 'Unavailable'}' and not eligible for candidate pairing.",
                score=0.0,
                metadata={"availability": avail},
            )
