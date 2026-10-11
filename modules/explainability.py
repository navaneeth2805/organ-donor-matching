"""Explainability engine generating transparent 'Why This Candidate?' and 'Why Not?' clinical narratives."""

from typing import Any
from config.matching_config import (
    STATUS_INCOMPATIBLE,
    STATUS_INSUFFICIENT_DATA,
    STATUS_POTENTIAL_CANDIDATE,
    STATUS_REQUIRES_REVIEW,
)
from database.models import Donor, Recipient


class ExplainabilityEngine:
    """Produces detailed, auditable rationales explaining software compatibility and ranking outcomes."""

    @staticmethod
    def generate_explanation(
        donor: Donor,
        recipient: Recipient,
        status: str,
        hard_failures: list[str],
        warnings: list[str],
        explanations: list[str],
        scores: dict[str, Any],
    ) -> dict[str, Any]:
        """Synthesize structured explanations and executive summary strings."""
        d_name = donor.name if donor else "Unknown Donor"
        r_name = recipient.name if recipient else "Unknown Recipient"
        d_id = f"D-{donor.id}" if donor and donor.id else "Unknown"
        r_id = f"R-{recipient.id}" if recipient and recipient.id else "Unknown"

        why_not: list[str] = []
        why_candidate: list[str] = []
        review_requirements: list[str] = []

        overall_score = scores.get("overall_score", 0.0)

        if status == STATUS_INCOMPATIBLE:
            header = f"INELIGIBLE: Pair {d_id} ({d_name}) → {r_id} ({r_name}) is incompatible under software rules."
            for failure in hard_failures:
                why_not.append(f"✕ {failure}")
            summary = (
                f"Candidate pairing was excluded by the rule engine due to {len(hard_failures)} "
                f"failed hard constraint(s). Overall software ranking is 0.0."
            )

        elif status == STATUS_INSUFFICIENT_DATA:
            header = f"INSUFFICIENT DATA: Pair {d_id} → {r_id} lacks critical clinical records."
            for failure in hard_failures:
                why_not.append(f"⚠ {failure}")
            summary = (
                "Essential demographic or clinical profile information is unrecorded. "
                "Pair cannot be ranked until mandatory records are entered."
            )

        elif status == STATUS_REQUIRES_REVIEW:
            header = f"REVIEW REQUIRED: Pair {d_id} → {r_id} (Score: {overall_score:.1f} / 100)."
            for expl in explanations:
                why_candidate.append(expl)
            for warn in warnings:
                review_requirements.append(f"⚠ {warn}")
            summary = (
                f"All mandatory hard constraints (organ, blood group, availability) passed. "
                f"However, {len(warnings)} clinical or immunological item(s) require clinical verification."
            )

        else:  # STATUS_POTENTIAL_CANDIDATE
            header = f"POTENTIAL CANDIDATE: Pair {d_id} → {r_id} (Score: {overall_score:.1f} / 100)."
            for expl in explanations:
                why_candidate.append(expl)
            summary = (
                f"The pair satisfies all configured hard constraints without active review flags. "
                f"Software ranking score is {overall_score:.1f} / 100 based on configured weights."
            )

        return {
            "header": header,
            "status": status,
            "summary": summary,
            "why_not": why_not,
            "why_candidate": why_candidate,
            "review_requirements": review_requirements,
            "passed_rules": explanations,
            "active_warnings": warnings,
            "hard_failures": hard_failures,
        }
