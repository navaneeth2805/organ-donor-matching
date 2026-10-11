"""Clinical profile assessment and decision-support review flags rule."""

from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from compatibility.organ_rules import get_organ_assessment_rule
from database.models import Donor, Recipient


class ClinicalDataRule(CompatibilityRule):
    """Evaluates Phase 2 clinical medical parameters and generates non-exclusionary review flags."""

    def __init__(self):
        super().__init__(rule_name="Clinical Data Readiness & Review", is_hard_constraint=False)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_profile = ctx.get("donor_profile") or {}
        recip_profile = ctx.get("recipient_profile") or {}

        review_flags: list[str] = []
        positive_notes: list[str] = []

        # 1. Vital Signs Evaluation
        d_vitals = donor_profile.get("vitals")
        if d_vitals:
            sys_bp = getattr(d_vitals, "systolic_bp", None)
            dia_bp = getattr(d_vitals, "diastolic_bp", None)
            if sys_bp and dia_bp and (sys_bp >= 160 or dia_bp >= 100):
                review_flags.append(f"Donor Vitals: Severe arterial hypertension ({sys_bp:.0f}/{dia_bp:.0f} mmHg).")
            spo2 = getattr(d_vitals, "spo2", None)
            if spo2 and spo2 < 92.0:
                review_flags.append(f"Donor Vitals: Hypoxemia alert (SpO2 {spo2:.1f}%).")
            positive_notes.append("Donor vital signs recorded")
        else:
            review_flags.append("Donor Vitals: Baseline vitals not yet documented.")

        # 2. Laboratory Biomarkers Evaluation
        d_labs = donor_profile.get("laboratory")
        if d_labs:
            egfr = getattr(d_labs, "egfr", None)
            creat = getattr(d_labs, "creatinine", None)
            if egfr is not None and egfr < 45.0:
                review_flags.append(f"Donor Renal Labs: Significantly reduced eGFR ({egfr:.1f} mL/min/1.73m²).")
            elif creat is not None and creat > 2.0:
                review_flags.append(f"Donor Renal Labs: Elevated serum creatinine ({creat:.2f} mg/dL).")

            k = getattr(d_labs, "potassium", None)
            if k is not None and (k > 5.8 or k < 3.2):
                review_flags.append(f"Donor Electrolytes: Serum potassium imbalance ({k:.1f} mEq/L).")

            positive_notes.append("Donor laboratory panel available")
        else:
            review_flags.append("Donor Labs: Comprehensive laboratory biomarkers not yet recorded.")

        # 3. Cardiac Assessment
        d_cardiac = donor_profile.get("cardiac")
        if d_cardiac:
            ef = getattr(d_cardiac, "ejection_fraction", None)
            if ef is not None and ef < 40.0:
                review_flags.append(f"Donor Cardiac: Severely reduced ejection fraction ({ef:.0f}%).")
            qtc = getattr(d_cardiac, "qtc", None)
            if qtc is not None and qtc > 480.0:
                review_flags.append(f"Donor Cardiac: Marked QTc prolongation ({qtc:.0f} ms).")
            positive_notes.append("Cardiac assessment recorded")

        # 4. Medical History / Comorbidities
        d_hist = donor_profile.get("medical_history")
        if d_hist:
            if getattr(d_hist, "cancer_history", 0) == 1:
                review_flags.append("Donor History: Prior history of malignancy documented; oncological review required.")
            infect = str(getattr(d_hist, "infectious_disease_status", "") or "").lower()
            if "positive" in infect or "active" in infect:
                review_flags.append(f"Donor Infectious Disease: {getattr(d_hist, 'infectious_disease_status')} documented.")
            positive_notes.append("Medical history reviewed")

        # 5. Organ-Specific Assessment Hook
        organ_rule = get_organ_assessment_rule(donor.organ)
        if organ_rule:
            organ_res = organ_rule.evaluate_organ_readiness(donor, recipient, context)
            if organ_res.severity in ("REVIEW", "WARNING"):
                review_flags.append(f"Organ Assessment: {organ_res.message}")
            else:
                positive_notes.append(organ_res.message)

        # 6. Recipient Urgency and Waiting Profile
        if getattr(recipient, "urgency", "") == "Critical":
            review_flags.append("Recipient Priority: Patient is classified in Critical status.")

        # Score calculation: base 100 minus penalty for missing info or severe review flags
        # Ensures scores stay within 0 - 100
        score = 100.0
        score -= min(60.0, len(review_flags) * 12.0)
        score = max(20.0, round(score, 1))

        severity = "REVIEW" if len(review_flags) > 0 else "PASS"
        if len(review_flags) == 0:
            summary_msg = "All clinical parameters, organ assessments, and medical history are documented without alerts."
        else:
            summary_msg = f"{len(review_flags)} clinical review flags noted ({len(positive_notes)} categories documented)."

        return RuleResult(
            passed=True,
            severity=severity,
            code="CLINICAL_DATA_REVIEW",
            message=summary_msg,
            score=score,
            metadata={
                "review_flags": review_flags,
                "positive_notes": positive_notes,
                "clinical_score": score,
            },
        )
