"""Business service layer for Medical History, Comorbidities, and Infectious Disease Screening."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, MedicalHistory
from database.repositories import AuditLogRepository, MedicalHistoryRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_date_iso,
    validate_id,
)

logger = get_logger("modules.medical_history")


class MedicalHistoryService:
    """Service handling systemic comorbidities, infection screens, contraindications, and audit logging."""

    def __init__(
        self,
        history_repo: MedicalHistoryRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = history_repo
        self.audit_repo = audit_repo

    def record_medical_history(
        self,
        entity_type: str,
        entity_id: int,
        history_data: dict[str, Any],
        assessment_date: str | None = None,
    ) -> tuple[MedicalHistory, list[str]]:
        """Validate medical background, detect clinical contraindication flags, and save history."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be either 'DONOR' or 'RECIPIENT'.")

        valid_entity_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        # Comorbidity boolean flags
        diabetes = 1 if bool(history_data.get("diabetes")) else 0
        hypertension = 1 if bool(history_data.get("hypertension")) else 0
        heart_disease = 1 if bool(history_data.get("heart_disease")) else 0
        kidney_disease = 1 if bool(history_data.get("kidney_disease")) else 0
        liver_disease = 1 if bool(history_data.get("liver_disease")) else 0
        lung_disease = 1 if bool(history_data.get("lung_disease")) else 0
        cancer_history = 1 if bool(history_data.get("cancer_history")) else 0

        inf_status = str(history_data.get("infectious_disease_status") or "Negative / Non-Reactive").strip()
        smoking = str(history_data.get("smoking_status") or "Unknown").strip()
        meds = str(history_data.get("medication_history") or "").strip() or None
        surgery = str(history_data.get("previous_surgery") or "").strip() or None
        notes = str(history_data.get("notes") or "").strip() or None

        date_val = validate_date_iso(assessment_date or current_date(), "Assessment date", allow_future=False)
        ts = current_timestamp()

        # Risk and contraindication detection
        flags: list[str] = []
        if cancer_history:
            flags.append("Malignancy History Alert: Potential oncologic contraindication.")
        if "Positive" in inf_status or "Pathogens Detected" in inf_status:
            flags.append(f"Infectious Disease Warning: {inf_status}. Serological transmission review required.")
        if kidney_disease and clean_entity_type == "DONOR":
            flags.append("Chronic Kidney Disease noted in donor profile.")
        if liver_disease and clean_entity_type == "DONOR":
            flags.append("Chronic Liver Disease noted in donor profile.")
        if heart_disease and clean_entity_type == "DONOR":
            flags.append("Cardiovascular Disease noted in donor profile.")

        history = MedicalHistory(
            id=None,
            entity_type=clean_entity_type,
            entity_id=valid_entity_id,
            diabetes=diabetes,
            hypertension=hypertension,
            heart_disease=heart_disease,
            kidney_disease=kidney_disease,
            liver_disease=liver_disease,
            lung_disease=lung_disease,
            cancer_history=cancer_history,
            infectious_disease_status=inf_status,
            smoking_status=smoking,
            medication_history=meds,
            previous_surgery=surgery,
            notes=notes,
            assessment_date=date_val,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(history)

        comorbidities_count = sum([diabetes, hypertension, heart_disease, kidney_disease, liver_disease, lung_disease, cancer_history])
        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_entity_id,
                action="RECORD_MEDICAL_HISTORY",
                details=f"Medical history recorded with {comorbidities_count} comorbidities, Inf={inf_status}",
                created_at=ts,
            )
        )

        logger.info("Medical history recorded for %s ID %d.", clean_entity_type, valid_entity_id)
        return saved, flags

    def get_latest(self, entity_type: str, entity_id: int) -> MedicalHistory | None:
        """Fetch latest medical history for an entity."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_by_entity(clean_entity_type, entity_id)

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[MedicalHistory]:
        """Fetch historical updates."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_history(clean_entity_type, entity_id, limit=limit)

    def delete_medical_history(self, history_id: int) -> bool:
        """Remove a medical history record."""
        existing = self.repo.get_by_id(history_id)
        if not existing:
            raise RecordNotFoundError(f"Medical history record {history_id} not found.")

        success = self.repo.delete(history_id)
        if success:
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type=existing.entity_type,
                    entity_id=existing.entity_id,
                    action="DELETE_MEDICAL_HISTORY",
                    details=f"Deleted medical history record ID {history_id}",
                    created_at=current_timestamp(),
                )
            )
        return success
