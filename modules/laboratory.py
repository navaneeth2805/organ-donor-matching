"""Business service layer for Laboratory Results and Biomarker panels."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, LaboratoryResults
from database.repositories import AuditLogRepository, LaboratoryRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_date_iso,
    validate_id,
    validate_laboratory_results,
)

logger = get_logger("modules.laboratory")


class LaboratoryService:
    """Service handling laboratory biomarkers, safety boundary checks, alerts, and audit trails."""

    def __init__(
        self,
        lab_repo: LaboratoryRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = lab_repo
        self.audit_repo = audit_repo

    def record_laboratory_results(
        self,
        entity_type: str,
        entity_id: int,
        results_data: dict[str, Any],
        test_date: str | None = None,
    ) -> tuple[LaboratoryResults, list[str]]:
        """Validate biomarker panel, identify clinical warnings, and persist results."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be either 'DONOR' or 'RECIPIENT'.")

        valid_entity_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        # Validate lab data values
        validated_fields = validate_laboratory_results(results_data)

        # Generate clinical alerts / flags
        alerts = self.analyze_biomarker_alerts(validated_fields)

        date_val = validate_date_iso(test_date or current_date(), "Laboratory test date", allow_future=False)
        ts = current_timestamp()

        labs = LaboratoryResults(
            id=None,
            entity_type=clean_entity_type,
            entity_id=valid_entity_id,
            blood_glucose=validated_fields.get("blood_glucose"),
            hba1c=validated_fields.get("hba1c"),
            hemoglobin=validated_fields.get("hemoglobin"),
            wbc=validated_fields.get("wbc"),
            platelets=validated_fields.get("platelets"),
            creatinine=validated_fields.get("creatinine"),
            egfr=validated_fields.get("egfr"),
            bun=validated_fields.get("bun"),
            sodium=validated_fields.get("sodium"),
            potassium=validated_fields.get("potassium"),
            calcium=validated_fields.get("calcium"),
            ast=validated_fields.get("ast"),
            alt=validated_fields.get("alt"),
            bilirubin=validated_fields.get("bilirubin"),
            albumin=validated_fields.get("albumin"),
            inr=validated_fields.get("inr"),
            test_date=date_val,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(labs)

        # Log audit trail
        alert_summary = f" ({len(alerts)} alerts: {'; '.join(alerts[:2])})" if alerts else ""
        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_entity_id,
                action="RECORD_LAB_RESULTS",
                details=f"Laboratory panel recorded on {date_val}{alert_summary}",
                created_at=ts,
            )
        )

        logger.info("Laboratory results saved for %s ID %d with %d alerts.", clean_entity_type, valid_entity_id, len(alerts))
        return saved, alerts

    @staticmethod
    def analyze_biomarker_alerts(labs: dict[str, Any]) -> list[str]:
        """Check for critical or out-of-range clinical biomarker findings."""
        alerts: list[str] = []

        # Renal Function
        cr = labs.get("creatinine")
        if cr is not None and cr > 1.5:
            alerts.append(f"Elevated Serum Creatinine: {cr:.2f} mg/dL (Renal impairment alert)")

        egfr = labs.get("egfr")
        if egfr is not None and egfr < 60.0:
            alerts.append(f"Reduced eGFR: {egfr:.1f} mL/min/1.73m² (Chronic kidney dysfunction tier)")

        # Electrolytes
        k = labs.get("potassium")
        if k is not None:
            if k > 5.5:
                alerts.append(f"Hyperkalemia warning: Potassium {k:.1f} mEq/L")
            elif k < 3.5:
                alerts.append(f"Hypokalemia warning: Potassium {k:.1f} mEq/L")

        na = labs.get("sodium")
        if na is not None:
            if na < 135.0:
                alerts.append(f"Hyponatremia warning: Sodium {na:.0f} mEq/L")
            elif na > 145.0:
                alerts.append(f"Hypernatremia warning: Sodium {na:.0f} mEq/L")

        # Glycemic
        glu = labs.get("blood_glucose")
        if glu is not None:
            if glu > 200.0:
                alerts.append(f"Hyperglycemia alert: Blood Glucose {glu:.0f} mg/dL")
            elif glu < 70.0:
                alerts.append(f"Hypoglycemia alert: Blood Glucose {glu:.0f} mg/dL")

        # Hepatic
        ast = labs.get("ast")
        if ast is not None and ast > 60.0:
            alerts.append(f"Elevated AST: {ast:.0f} U/L (Hepatic transaminase elevation)")

        alt = labs.get("alt")
        if alt is not None and alt > 60.0:
            alerts.append(f"Elevated ALT: {alt:.0f} U/L (Hepatic transaminase elevation)")

        bili = labs.get("bilirubin")
        if bili is not None and bili > 1.5:
            alerts.append(f"Elevated Total Bilirubin: {bili:.2f} mg/dL")

        # Hematology
        hb = labs.get("hemoglobin")
        if hb is not None and hb < 10.0:
            alerts.append(f"Anemia warning: Hemoglobin {hb:.1f} g/dL")

        plt = labs.get("platelets")
        if plt is not None and plt < 100.0:
            alerts.append(f"Thrombocytopenia warning: Platelets {plt:.0f} x10³/µL")

        inr = labs.get("inr")
        if inr is not None and inr > 1.5:
            alerts.append(f"Coagulopathy warning: INR {inr:.2f}")

        return alerts

    def get_latest(self, entity_type: str, entity_id: int) -> LaboratoryResults | None:
        """Fetch latest lab result for an entity."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_by_entity(clean_entity_type, entity_id)

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[LaboratoryResults]:
        """Fetch historical laboratory tests."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_history(clean_entity_type, entity_id, limit=limit)

    def delete_lab_result(self, lab_id: int) -> bool:
        """Remove a laboratory record."""
        existing = self.repo.get_by_id(lab_id)
        if not existing:
            raise RecordNotFoundError(f"Laboratory record {lab_id} not found.")

        success = self.repo.delete(lab_id)
        if success:
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type=existing.entity_type,
                    entity_id=existing.entity_id,
                    action="DELETE_LAB_RESULTS",
                    details=f"Deleted laboratory test ID {lab_id}",
                    created_at=current_timestamp(),
                )
            )
        return success
