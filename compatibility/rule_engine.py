"""Compatibility rule engine coordinating hard constraints and soft clinical decision-support rules."""

from typing import Any
from config.matching_config import (
    STATUS_INCOMPATIBLE,
    STATUS_INSUFFICIENT_DATA,
    STATUS_POTENTIAL_CANDIDATE,
    STATUS_REQUIRES_REVIEW,
)
from compatibility.availability_rules import AvailabilityRule
from compatibility.base_rule import RuleResult
from compatibility.blood_rules import BloodCompatibilityRule
from compatibility.clinical_rules import ClinicalDataRule
from compatibility.crossmatch_rules import CrossmatchRule
from compatibility.data_rules import RequiredDataRule
from compatibility.geographic_rules import GeographicRule
from compatibility.hla_rules import HLARule
from compatibility.organ_rules import OrganCompatibilityRule
from database.models import Donor, Recipient


class CompatibilityRuleEngine:
    """Executes the two-tiered compatibility evaluation pipeline: Hard Constraints -> Soft Evaluation."""

    def __init__(self):
        # Tier 1: Hard Constraints (Exclusionary gates)
        self.data_rule = RequiredDataRule()
        self.availability_rule = AvailabilityRule()
        self.organ_rule = OrganCompatibilityRule()
        self.blood_rule = BloodCompatibilityRule()

        # Tier 2: Soft Clinical & Immunological Rules
        self.hla_rule = HLARule()
        self.crossmatch_rule = CrossmatchRule()
        self.clinical_rule = ClinicalDataRule()
        self.geographic_rule = GeographicRule()

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute the complete rule pipeline for a donor and recipient pair."""
        ctx = context or {}

        hard_failures: list[str] = []
        warnings: list[str] = []
        explanations: list[str] = []
        rule_results: dict[str, RuleResult] = {}

        # 1. Evaluate Required Data Completeness Gate
        res_data = self.data_rule.evaluate(donor, recipient, ctx)
        rule_results["required_data"] = res_data
        if not res_data.passed:
            if res_data.code == "INSUFFICIENT_DATA":
                hard_failures.append(res_data.message)
            else:
                warnings.append(res_data.message)
        else:
            explanations.append(f"✓ {res_data.message}")

        # If data is fatally missing, exit early as INSUFFICIENT_DATA
        if not res_data.passed and res_data.code == "INSUFFICIENT_DATA":
            return {
                "status": STATUS_INSUFFICIENT_DATA,
                "rule_results": rule_results,
                "hard_failures": hard_failures,
                "warnings": warnings,
                "explanations": [f"✕ {res_data.message}"],
                "component_scores": {
                    "blood": 0.0,
                    "organ": 0.0,
                    "clinical": 0.0,
                    "urgency": 0.0,
                    "waiting_time": 0.0,
                    "hla": 0.0,
                    "geographic": 0.0,
                    "data_quality": res_data.score,
                },
            }

        # 2. Evaluate Donor Availability Gate
        res_avail = self.availability_rule.evaluate(donor, recipient, ctx)
        rule_results["availability"] = res_avail
        if not res_avail.passed:
            if res_avail.severity == "FAIL":
                hard_failures.append(res_avail.message)
            elif res_avail.severity == "REVIEW":
                warnings.append(res_avail.message)
        else:
            explanations.append(f"✓ {res_avail.message}")

        # 3. Evaluate Organ Compatibility Gate
        res_organ = self.organ_rule.evaluate(donor, recipient, ctx)
        rule_results["organ"] = res_organ
        if not res_organ.passed:
            hard_failures.append(res_organ.message)
        else:
            explanations.append(f"✓ {res_organ.message}")

        # 4. Evaluate Blood Group Compatibility Gate
        res_blood = self.blood_rule.evaluate(donor, recipient, ctx)
        rule_results["blood"] = res_blood
        if not res_blood.passed:
            hard_failures.append(res_blood.message)
        else:
            explanations.append(f"✓ {res_blood.message}")

        # 5. Evaluate Soft Rules (HLA, Crossmatch, Clinical, Geographic)
        res_hla = self.hla_rule.evaluate(donor, recipient, ctx)
        rule_results["hla"] = res_hla
        if res_hla.severity in ("WARNING", "REVIEW"):
            warnings.append(res_hla.message)
        else:
            explanations.append(f"✓ {res_hla.message}")

        res_xm = self.crossmatch_rule.evaluate(donor, recipient, ctx)
        rule_results["crossmatch"] = res_xm
        if res_xm.severity in ("WARNING", "REVIEW"):
            warnings.append(res_xm.message)
        else:
            explanations.append(f"✓ {res_xm.message}")

        res_clinical = self.clinical_rule.evaluate(donor, recipient, ctx)
        rule_results["clinical"] = res_clinical
        if res_clinical.severity in ("WARNING", "REVIEW"):
            warnings.append(res_clinical.message)
            # Add any specific review flags from metadata
            for flag in res_clinical.metadata.get("review_flags", []):
                warnings.append(flag)
        else:
            explanations.append(f"✓ {res_clinical.message}")

        res_geo = self.geographic_rule.evaluate(donor, recipient, ctx)
        rule_results["geographic"] = res_geo
        explanations.append(f"✓ {res_geo.message}")

        # Determine Final Controlled Status
        if hard_failures:
            status = STATUS_INCOMPATIBLE
        elif len(warnings) > 0:
            status = STATUS_REQUIRES_REVIEW
        else:
            status = STATUS_POTENTIAL_CANDIDATE

        component_scores = {
            "blood": res_blood.score,
            "organ": res_organ.score,
            "clinical": res_clinical.score,
            "hla": res_hla.score,
            "geographic": res_geo.score,
            "data_quality": res_data.score,
        }

        return {
            "status": status,
            "rule_results": rule_results,
            "hard_failures": hard_failures,
            "warnings": warnings,
            "explanations": explanations,
            "component_scores": component_scores,
        }
