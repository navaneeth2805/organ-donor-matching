"""Business service layer for Vital Signs and Physical Biometrics."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, VitalSigns
from database.repositories import AuditLogRepository, VitalSignsRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    calculate_bmi,
    validate_blood_pressure,
    validate_date_iso,
    validate_heart_rate,
    validate_height,
    validate_id,
    validate_respiratory_rate,
    validate_spo2,
    validate_temperature,
    validate_weight,
)

logger = get_logger("modules.vital_signs")


class VitalSignsService:
    """Service handling vital signs validation, BMI computation, trending, and audit trails."""

    def __init__(
        self,
        vitals_repo: VitalSignsRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = vitals_repo
        self.audit_repo = audit_repo

    def record_vitals(
        self,
        entity_type: str,
        entity_id: int,
        systolic_bp: Any,
        diastolic_bp: Any,
        heart_rate: Any,
        respiratory_rate: Any,
        temperature: Any,
        spo2: Any,
        height_cm: Any,
        weight_kg: Any,
        recorded_at: str | None = None,
    ) -> tuple[VitalSigns, list[str]]:
        """Validate input parameters, calculate BMI, record vitals, and log audit event."""
        all_warnings: list[str] = []

        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be either 'DONOR' or 'RECIPIENT'.")

        valid_entity_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        # Blood pressure
        sys_val, dia_val, bp_warns = validate_blood_pressure(systolic_bp, diastolic_bp)
        all_warnings.extend(bp_warns)

        # Heart rate
        hr_val, hr_warns = validate_heart_rate(heart_rate)
        all_warnings.extend(hr_warns)

        # Respiratory rate
        rr_val, rr_warns = validate_respiratory_rate(respiratory_rate)
        all_warnings.extend(rr_warns)

        # Temperature
        temp_val, temp_warns = validate_temperature(temperature)
        all_warnings.extend(temp_warns)

        # SpO2
        spo2_val, spo2_warns = validate_spo2(spo2)
        all_warnings.extend(spo2_warns)

        # Anthropometrics
        ht_val = validate_height(height_cm)
        wt_val = validate_weight(weight_kg)
        bmi_val = calculate_bmi(ht_val, wt_val)

        # Recording timestamp
        rec_time = validate_date_iso(recorded_at or current_date(), "Recorded date", allow_future=False)
        ts = current_timestamp()

        vitals = VitalSigns(
            id=None,
            entity_type=clean_entity_type,
            entity_id=valid_entity_id,
            systolic_bp=sys_val,
            diastolic_bp=dia_val,
            heart_rate=hr_val,
            respiratory_rate=rr_val,
            temperature=temp_val,
            spo2=spo2_val,
            height_cm=ht_val,
            weight_kg=wt_val,
            bmi=bmi_val,
            recorded_at=rec_time,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(vitals)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_entity_id,
                action="RECORD_VITALS",
                details=f"Recorded vitals: BP {sys_val:.0f}/{dia_val:.0f}, HR {hr_val:.0f}, SpO2 {spo2_val:.0f}%, BMI {bmi_val}",
                created_at=ts,
            )
        )

        logger.info(
            "Vitals recorded for %s ID %d with BMI %.1f",
            clean_entity_type,
            valid_entity_id,
            bmi_val if bmi_val is not None else 0.0,
        )
        return saved, all_warnings

    def get_latest(self, entity_type: str, entity_id: int) -> VitalSigns | None:
        """Fetch latest vital signs for an entity."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_by_entity(clean_entity_type, entity_id)

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[VitalSigns]:
        """Fetch historical vital signs records."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_history(clean_entity_type, entity_id, limit=limit)

    def delete_vitals(self, vitals_id: int) -> bool:
        """Remove a vital sign entry."""
        existing = self.repo.get_by_id(vitals_id)
        if not existing:
            raise RecordNotFoundError(f"Vital signs record {vitals_id} not found.")

        success = self.repo.delete(vitals_id)
        if success:
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type=existing.entity_type,
                    entity_id=existing.entity_id,
                    action="DELETE_VITALS",
                    details=f"Deleted vitals record ID {vitals_id}",
                    created_at=current_timestamp(),
                )
            )
        return success
