"""Data quality assessment, completeness scoring, freshness tracking, and clinical audits."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from config.settings import FRESHNESS_THRESHOLDS_DAYS
from database.models import (
    CardiacAssessment,
    HLAProfile,
    LaboratoryResults,
    MedicalHistory,
    OrganAssessment,
    VitalSigns,
)
from database.repositories import (
    CardiacAssessmentRepository,
    DonorRepository,
    HLARepository,
    LaboratoryRepository,
    MedicalHistoryRepository,
    OrganAssessmentRepository,
    RecipientRepository,
    VitalSignsRepository,
)


@dataclass
class DataQualityReport:
    """Detailed clinical data completeness and freshness evaluation for an individual entity."""

    entity_type: str
    entity_id: int
    entity_name: str
    overall_score: float
    completeness_by_category: dict[str, float]
    freshness_status: str
    days_since_assessment: int | None
    latest_assessment_date: str | None
    missing_fields: list[str]
    clinical_flags: list[str]
    clinical_summary: str


class DataQualityService:
    """Service evaluating completeness, freshness, and regulatory readiness of clinical profiles."""

    def __init__(
        self,
        donor_repo: DonorRepository,
        recipient_repo: RecipientRepository,
        vitals_repo: VitalSignsRepository,
        labs_repo: LaboratoryRepository,
        cardiac_repo: CardiacAssessmentRepository,
        history_repo: MedicalHistoryRepository,
        hla_repo: HLARepository,
        organ_repo: OrganAssessmentRepository,
    ) -> None:
        self.donor_repo = donor_repo
        self.recipient_repo = recipient_repo
        self.vitals_repo = vitals_repo
        self.labs_repo = labs_repo
        self.cardiac_repo = cardiac_repo
        self.history_repo = history_repo
        self.hla_repo = hla_repo
        self.organ_repo = organ_repo

    def evaluate_entity_quality(self, entity_type: str, entity_id: int) -> DataQualityReport:
        """Calculate complete transparent data completeness breakdown and freshness rating."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type == "DONOR":
            entity = self.donor_repo.get_by_id(entity_id)
            entity_name = entity.name if entity else f"Donor #{entity_id}"
        else:
            entity = self.recipient_repo.get_by_id(entity_id)
            entity_name = entity.name if entity else f"Recipient #{entity_id}"

        # Fetch latest records across clinical sub-domains
        vitals = self.vitals_repo.get_by_entity(clean_entity_type, entity_id)
        labs = self.labs_repo.get_by_entity(clean_entity_type, entity_id)
        cardiac = self.cardiac_repo.get_by_entity(clean_entity_type, entity_id)
        history = self.history_repo.get_by_entity(clean_entity_type, entity_id)
        hla = self.hla_repo.get_by_entity(clean_entity_type, entity_id)
        organ_assessments = (
            self.organ_repo.get_by_donor(entity_id) if clean_entity_type == "DONOR" else []
        )

        missing: list[str] = []
        flags: list[str] = []

        # 1. Vital Signs Scoring (Max 100)
        vitals_score = 0.0
        if vitals:
            v_fields = [
                ("Systolic BP", vitals.systolic_bp),
                ("Diastolic BP", vitals.diastolic_bp),
                ("Heart Rate", vitals.heart_rate),
                ("SpO2", vitals.spo2),
                ("Height", vitals.height_cm),
                ("Weight", vitals.weight_kg),
            ]
            present_v = [name for name, val in v_fields if val is not None]
            vitals_score = round(len(present_v) / len(v_fields) * 100.0, 1)
            for name, val in v_fields:
                if val is None:
                    missing.append(f"Vitals: {name}")
        else:
            missing.append("Vital Signs Panel: Not recorded")

        # 2. Laboratory Biomarker Scoring (Max 100)
        labs_score = 0.0
        if labs:
            lab_fields = [
                ("Creatinine", labs.creatinine),
                ("eGFR", labs.egfr),
                ("Blood Glucose", labs.blood_glucose),
                ("Hemoglobin", labs.hemoglobin),
                ("Platelets", labs.platelets),
                ("Potassium", labs.potassium),
                ("Sodium", labs.sodium),
                ("AST/ALT", labs.ast or labs.alt),
            ]
            present_l = [name for name, val in lab_fields if val is not None]
            labs_score = round(len(present_l) / len(lab_fields) * 100.0, 1)
            for name, val in lab_fields:
                if val is None:
                    missing.append(f"Laboratory: {name}")
        else:
            missing.append("Laboratory Biomarkers: Not recorded")

        # 3. Cardiac Assessment Scoring (Max 100)
        cardiac_score = 0.0
        if cardiac:
            c_fields = [
                ("ECG Interpretation", cardiac.ecg_status and cardiac.ecg_status != "Not Assessed"),
                ("Ejection Fraction", cardiac.ejection_fraction is not None),
                ("Heart Rate / Rhythm", cardiac.heart_rate is not None or cardiac.ecg_findings is not None),
            ]
            present_c = [name for name, has_val in c_fields if has_val]
            cardiac_score = round(len(present_c) / len(c_fields) * 100.0, 1)
            for name, has_val in c_fields:
                if not has_val:
                    missing.append(f"Cardiac: {name}")
        else:
            missing.append("Cardiac Assessment: Not recorded")

        # 4. Medical History & Infection Screening Scoring (Max 100)
        history_score = 0.0
        if history:
            h_fields = [
                ("Infectious Disease Status", bool(history.infectious_disease_status)),
                ("Smoking Status", bool(history.smoking_status)),
                ("Comorbidity Assessment", True),
            ]
            present_h = [name for name, has_val in h_fields if has_val]
            history_score = round(len(present_h) / len(h_fields) * 100.0, 1)
        else:
            missing.append("Medical History & Comorbidities: Not recorded")

        # 5. Immunology / HLA Scoring (Max 100)
        hla_score = 0.0
        if hla:
            hla_fields = [
                ("HLA-A", hla.hla_a),
                ("HLA-B", hla.hla_b),
                ("HLA-C", hla.hla_c),
                ("HLA-DR", hla.hla_dr),
                ("HLA-DQ", hla.hla_dq),
            ]
            present_hla = [name for name, val in hla_fields if val is not None]
            hla_score = round(len(present_hla) / len(hla_fields) * 100.0, 1)
            for name, val in hla_fields:
                if val is None:
                    missing.append(f"HLA: {name}")
        else:
            missing.append("Immunology: HLA Profile not recorded")

        # 6. Organ Assessment (Only for Donors)
        completeness_by_cat = {
            "Vital Signs": vitals_score,
            "Laboratory Panels": labs_score,
            "Cardiac Health": cardiac_score,
            "Medical History": history_score,
            "HLA Profile": hla_score,
        }

        if clean_entity_type == "DONOR":
            organ_score = 0.0
            if organ_assessments:
                completed = [o for o in organ_assessments if o.assessment_status == "Assessment Complete"]
                organ_score = round(len(completed) / max(len(organ_assessments), 1) * 100.0, 1)
            else:
                missing.append("Organ Procurement Assessment: Not recorded")
            completeness_by_cat["Organ Assessment"] = organ_score

        # Calculate weighted overall score
        overall_score = round(sum(completeness_by_cat.values()) / len(completeness_by_cat), 1)

        # Freshness calculation
        all_dates: list[str] = []
        if vitals and vitals.recorded_at:
            all_dates.append(vitals.recorded_at[:10])
        if labs and labs.test_date:
            all_dates.append(labs.test_date[:10])
        if cardiac and cardiac.assessment_date:
            all_dates.append(cardiac.assessment_date[:10])
        if history and history.assessment_date:
            all_dates.append(history.assessment_date[:10])
        if hla and hla.test_date:
            all_dates.append(hla.test_date[:10])

        latest_date = max(all_dates) if all_dates else None
        days_since = None
        freshness_status = "No Assessment"

        if latest_date:
            try:
                dt = datetime.strptime(latest_date, "%Y-%m-%d")
                days_since = (datetime.utcnow() - dt).days
                if days_since < 0:
                    days_since = 0

                cur_max = FRESHNESS_THRESHOLDS_DAYS.get("CURRENT_MAX_DAYS", 30)
                rec_max = FRESHNESS_THRESHOLDS_DAYS.get("RECENT_MAX_DAYS", 90)

                if days_since <= cur_max:
                    freshness_status = "Current"
                elif days_since <= rec_max:
                    freshness_status = "Recent"
                else:
                    freshness_status = "Needs Update"
            except ValueError:
                freshness_status = "Needs Update"

        if freshness_status == "Needs Update":
            flags.append(f"Data Freshness Notice: Latest clinical assessment was {days_since} days ago (> 90 days threshold).")

        summary = f"Profile completeness is {overall_score}%. Clinical records status: {freshness_status}."
        if days_since is not None:
            summary += f" ({days_since} days old)"

        return DataQualityReport(
            entity_type=clean_entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            overall_score=overall_score,
            completeness_by_category=completeness_by_cat,
            freshness_status=freshness_status,
            days_since_assessment=days_since,
            latest_assessment_date=latest_date,
            missing_fields=missing,
            clinical_flags=flags,
            clinical_summary=summary,
        )

    def evaluate_network_data_quality(self) -> dict[str, Any]:
        """Aggregate data quality across all donors and recipients in the network."""
        donors = self.donor_repo.get_all(limit=1000)
        recipients = self.recipient_repo.get_all(limit=1000)

        donor_scores: list[float] = []
        recipient_scores: list[float] = []
        freshness_counts = {"Current": 0, "Recent": 0, "Needs Update": 0, "No Assessment": 0}

        for d in donors:
            if d.id is not None:
                rep = self.evaluate_entity_quality("DONOR", d.id)
                donor_scores.append(rep.overall_score)
                freshness_counts[rep.freshness_status] = freshness_counts.get(rep.freshness_status, 0) + 1

        for r in recipients:
            if r.id is not None:
                rep = self.evaluate_entity_quality("RECIPIENT", r.id)
                recipient_scores.append(rep.overall_score)
                freshness_counts[rep.freshness_status] = freshness_counts.get(rep.freshness_status, 0) + 1

        avg_donor = round(sum(donor_scores) / max(len(donor_scores), 1), 1)
        avg_recipient = round(sum(recipient_scores) / max(len(recipient_scores), 1), 1)
        total_eval = len(donor_scores) + len(recipient_scores)
        overall_network_avg = round(
            (sum(donor_scores) + sum(recipient_scores)) / max(total_eval, 1), 1
        )

        completed_profiles = sum(1 for s in donor_scores + recipient_scores if s >= 80.0)
        incomplete_profiles = total_eval - completed_profiles

        return {
            "total_entities_evaluated": total_eval,
            "overall_network_avg_score": overall_network_avg,
            "donor_avg_score": avg_donor,
            "recipient_avg_score": avg_recipient,
            "completed_profiles_count": completed_profiles,
            "incomplete_profiles_count": incomplete_profiles,
            "freshness_breakdown": freshness_counts,
        }
