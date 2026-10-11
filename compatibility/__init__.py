"""Compatibility rule engine package."""

from compatibility.availability_rules import AvailabilityRule
from compatibility.base_rule import CompatibilityRule, RuleResult
from compatibility.blood_rules import BloodCompatibilityRule
from compatibility.clinical_rules import ClinicalDataRule
from compatibility.crossmatch_rules import CrossmatchRule
from compatibility.data_rules import RequiredDataRule
from compatibility.geographic_rules import GeographicRule, haversine_distance_km
from compatibility.hla_rules import HLARule
from compatibility.organ_rules import OrganCompatibilityRule
from compatibility.rule_engine import CompatibilityRuleEngine

__all__ = [
    "CompatibilityRule",
    "RuleResult",
    "BloodCompatibilityRule",
    "OrganCompatibilityRule",
    "AvailabilityRule",
    "RequiredDataRule",
    "HLARule",
    "CrossmatchRule",
    "ClinicalDataRule",
    "GeographicRule",
    "CompatibilityRuleEngine",
    "haversine_distance_km",
]
