"""Abstract base rule interface and result container for compatibility evaluation."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from database.models import Donor, Recipient


@dataclass
class RuleResult:
    """Standardized result returned by individual compatibility and clinical rules."""

    passed: bool
    severity: str  # "PASS", "WARNING", "FAIL", "REVIEW"
    code: str
    message: str
    score: float = 100.0  # Normalized 0.0 - 100.0 component score
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "score": self.score,
            "metadata": self.metadata,
        }


class CompatibilityRule(ABC):
    """Abstract base class for all hard constraint and soft scoring rules."""

    def __init__(self, rule_name: str, is_hard_constraint: bool = False):
        self.rule_name = rule_name
        self.is_hard_constraint = is_hard_constraint

    @abstractmethod
    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        """Evaluate the rule against the donor-recipient pair in the provided clinical context."""
        ...
