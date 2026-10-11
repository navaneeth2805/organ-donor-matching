"""Blood group compatibility rule implementing standard donor-to-recipient immunological matching."""

from typing import Any
from config.matching_config import BLOOD_COMPATIBILITY_MAP
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


class BloodCompatibilityRule(CompatibilityRule):
    """Evaluates ABO and Rh factor compatibility between donor and recipient."""

    def __init__(self):
        super().__init__(rule_name="Blood Group Compatibility", is_hard_constraint=True)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        """Check if donor blood group is compatible with recipient blood group."""
        d_bg = str(donor.blood_group or "").strip().upper()
        r_bg = str(recipient.blood_group or "").strip().upper()

        if not d_bg or not r_bg:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="BLOOD_MISSING",
                message="Blood group is missing on donor or recipient record.",
                score=0.0,
                metadata={"donor_blood_group": d_bg, "recipient_blood_group": r_bg},
            )

        allowed_recipients = BLOOD_COMPATIBILITY_MAP.get(d_bg)
        if allowed_recipients is None:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="BLOOD_UNKNOWN_DONOR",
                message=f"Unrecognized donor blood group '{d_bg}'.",
                score=0.0,
                metadata={"donor_blood_group": d_bg, "recipient_blood_group": r_bg},
            )

        if r_bg not in BLOOD_COMPATIBILITY_MAP:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="BLOOD_UNKNOWN_RECIPIENT",
                message=f"Unrecognized recipient blood group '{r_bg}'.",
                score=0.0,
                metadata={"donor_blood_group": d_bg, "recipient_blood_group": r_bg},
            )

        if r_bg in allowed_recipients:
            return RuleResult(
                passed=True,
                severity="PASS",
                code="BLOOD_COMPATIBLE",
                message=f"Configured blood-group compatibility rule passed: Donor ({d_bg}) is compatible with Recipient ({r_bg}).",
                score=100.0,
                metadata={"donor_blood_group": d_bg, "recipient_blood_group": r_bg, "compatible": True},
            )
        else:
            return RuleResult(
                passed=False,
                severity="FAIL",
                code="BLOOD_INCOMPATIBLE",
                message=f"Configured blood-group compatibility rule does not permit Donor ({d_bg}) to Recipient ({r_bg}) pair.",
                score=0.0,
                metadata={"donor_blood_group": d_bg, "recipient_blood_group": r_bg, "compatible": False},
            )
