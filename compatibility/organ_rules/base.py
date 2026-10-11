"""Base interface for organ-specific clinical evaluation rule hooks."""

from abc import ABC, abstractmethod
from typing import Any
from compatibility.base_rule import RuleResult
from database.models import Donor, Recipient


class BaseOrganAssessmentRule(ABC):
    """Abstract interface for organ-specific anatomical and functional readiness hooks."""

    def __init__(self, organ_name: str):
        self.organ_name = organ_name

    @abstractmethod
    def evaluate_organ_readiness(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        """Evaluate organ-specific clinical measurements and readiness."""
        ...
