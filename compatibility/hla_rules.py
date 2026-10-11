"""HLA histocompatibility typing and loci comparison rule."""

import re
from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


class HLARule(CompatibilityRule):
    """Evaluates HLA profile availability, locus typing completeness, and allele comparisons."""

    LOCI = ["hla_a", "hla_b", "hla_c", "hla_dr", "hla_dq"]

    def __init__(self):
        super().__init__(rule_name="HLA Histocompatibility", is_hard_constraint=False)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        recip_profile = ctx.get("recipient_profile") or {}

        d_hla = donor_profile.get("hla")
        r_hla = recip_profile.get("hla")

        if not d_hla and not r_hla:
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="HLA_NOT_RECORDED",
                message="HLA typing is not recorded for either donor or recipient.",
                score=30.0,
                metadata={"hla_status": "Missing for both", "evaluated_loci": 0},
            )

        if not d_hla or not r_hla:
            missing_party = "Donor" if not d_hla else "Recipient"
            return RuleResult(
                passed=True,
                severity="REVIEW",
                code="HLA_PARTIAL",
                message=f"HLA typing is available for one candidate but missing for {missing_party}.",
                score=50.0,
                metadata={"hla_status": f"Missing for {missing_party}", "evaluated_loci": 0},
            )

        # Both profiles present: inspect loci and calculate transparent comparison
        loci_results: dict[str, dict[str, Any]] = {}
        matched_loci = 0
        evaluated_loci = 0
        missing_donor_loci: list[str] = []
        missing_recip_loci: list[str] = []

        def split_tokens(val: str | None) -> set[str]:
            if not val:
                return set()
            return {t.strip().upper() for t in re.split(r"[,/;\s]+", val) if t.strip()}

        for locus in self.LOCI:
            locus_name = locus.replace("hla_", "HLA-").upper()
            d_val = getattr(d_hla, locus, None)
            r_val = getattr(r_hla, locus, None)

            if not d_val:
                missing_donor_loci.append(locus_name)
            if not r_val:
                missing_recip_loci.append(locus_name)

            if d_val and r_val:
                evaluated_loci += 1
                d_set = split_tokens(d_val)
                r_set = split_tokens(r_val)
                shared = d_set.intersection(r_set)
                is_match = len(shared) > 0
                if is_match:
                    matched_loci += 1
                loci_results[locus_name] = {
                    "donor": d_val,
                    "recipient": r_val,
                    "matched": is_match,
                    "shared_alleles": list(shared),
                }
            else:
                loci_results[locus_name] = {
                    "donor": d_val or "Missing",
                    "recipient": r_val or "Missing",
                    "matched": False,
                    "shared_alleles": [],
                }

        # Calculate HLA data readiness score
        # 5 loci evaluated: base score 50% for complete data + up to 50% for loci compatibility
        completeness_ratio = evaluated_loci / len(self.LOCI)
        match_ratio = (matched_loci / evaluated_loci) if evaluated_loci > 0 else 0.0
        hla_score = round((completeness_ratio * 40.0) + (match_ratio * 60.0), 1)

        if evaluated_loci < 3:
            severity = "REVIEW"
            code = "HLA_INCOMPLETE_TYPING"
            msg = f"HLA typing is incomplete ({evaluated_loci}/5 loci evaluated). Clinical review advised."
        elif matched_loci >= 3:
            severity = "PASS"
            code = "HLA_HIGH_COMPATIBILITY"
            msg = f"Strong HLA compatibility: {matched_loci}/{evaluated_loci} evaluated loci share alleles."
        else:
            severity = "REVIEW"
            code = "HLA_PARTIAL_MATCH"
            msg = f"Moderate HLA overlap: {matched_loci}/{evaluated_loci} loci match ({match_ratio * 100:.0f}%)."

        return RuleResult(
            passed=True,
            severity=severity,
            code=code,
            message=msg,
            score=hla_score,
            metadata={
                "matched_loci_count": matched_loci,
                "evaluated_loci_count": evaluated_loci,
                "match_percentage": round(match_ratio * 100.0, 1),
                "loci_comparison": loci_results,
                "missing_donor_loci": missing_donor_loci,
                "missing_recipient_loci": missing_recip_loci,
            },
        )
