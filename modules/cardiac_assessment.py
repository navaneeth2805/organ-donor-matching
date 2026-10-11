"""Business service layer for Cardiac Assessments, ECG interpretation, and hemodynamic telemetry."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, CardiacAssessment
from database.repositories import AuditLogRepository, CardiacAssessmentRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_cardiac_assessment,
    validate_date_iso,
    validate_id,
)

logger = get_logger("modules.cardiac_assessment")


class CardiacAssessmentService:
    """Service handling cardiac electrophysiology, ejection fraction validation, and alerts."""

    def __init__(
        self,
        cardiac_repo: CardiacAssessmentRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = cardiac_repo
        self.audit_repo = audit_repo

    def record_cardiac_assessment(
        self,
        entity_type: str,
        entity_id: int,
        cardiac_data: dict[str, Any],
        assessment_date: str | None = None,
    ) -> tuple[CardiacAssessment, list[str]]:
        """Validate cardiac metrics, assess QT/EF safety parameters, and persist assessment."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be either 'DONOR' or 'RECIPIENT'.")

        valid_entity_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        # Validate structured parameters
        validated = validate_cardiac_assessment(cardiac_data)

        # Generate cardiac alerts
        alerts = self.analyze_cardiac_findings(validated)

        date_val = validate_date_iso(assessment_date or current_date(), "Assessment date", allow_future=False)
        ts = current_timestamp()

        cardiac = CardiacAssessment(
            id=None,
            entity_type=clean_entity_type,
            entity_id=valid_entity_id,
            ecg_status=validated["ecg_status"],
            ecg_findings=validated["ecg_findings"],
            heart_rate=validated["heart_rate"],
            pr_interval=validated["pr_interval"],
            qrs_duration=validated["qrs_duration"],
            qt_interval=validated["qt_interval"],
            qtc=validated["qtc"],
            echocardiogram_available=validated["echocardiogram_available"],
            ejection_fraction=validated["ejection_fraction"],
            assessment_date=date_val,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(cardiac)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_entity_id,
                action="RECORD_CARDIAC_ASSESSMENT",
                details=f"Cardiac assessment recorded: ECG={cardiac.ecg_status}, EF={cardiac.ejection_fraction}%",
                created_at=ts,
            )
        )

        logger.info("Cardiac assessment recorded for %s ID %d.", clean_entity_type, valid_entity_id)
        return saved, alerts

    @staticmethod
    def analyze_cardiac_findings(cardiac: dict[str, Any]) -> list[str]:
        """Check for electrophysiological or structural cardiac abnormalities."""
        alerts: list[str] = []

        status = cardiac.get("ecg_status")
        if status in ("Abnormal", "Borderline"):
            alerts.append(f"ECG Flag: {status} status requires specialized cardiologist sign-off.")

        qtc = cardiac.get("qtc")
        if qtc is not None and qtc > 470.0:
            alerts.append(f"Prolonged QTc interval: {qtc:.0f} ms (Risk of ventricular arrhythmia/Torsades).")

        ef = cardiac.get("ejection_fraction")
        if ef is not None:
            if ef < 40.0:
                alerts.append(f"Severely Depressed Ejection Fraction: {ef:.0f}% (Contraindication flag).")
            elif ef < 50.0:
                alerts.append(f"Reduced Left Ventricular Ejection Fraction: {ef:.0f}% (Heart failure tier).")

        pr = cardiac.get("pr_interval")
        if pr is not None and pr > 200.0:
            alerts.append(f"First-degree AV Block warning: PR interval {pr:.0f} ms.")

        qrs = cardiac.get("qrs_duration")
        if qrs is not None and qrs > 120.0:
            alerts.append(f"Intraventricular conduction delay / Bundle Branch Block: QRS {qrs:.0f} ms.")

        return alerts

    def get_latest(self, entity_type: str, entity_id: int) -> CardiacAssessment | None:
        """Fetch latest cardiac assessment for an entity."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_by_entity(clean_entity_type, entity_id)

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[CardiacAssessment]:
        """Fetch historical cardiac assessments."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_history(clean_entity_type, entity_id, limit=limit)

    def delete_cardiac_assessment(self, cardiac_id: int) -> bool:
        """Remove a cardiac assessment record."""
        existing = self.repo.get_by_id(cardiac_id)
        if not existing:
            raise RecordNotFoundError(f"Cardiac record {cardiac_id} not found.")

        success = self.repo.delete(cardiac_id)
        if success:
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type=existing.entity_type,
                    entity_id=existing.entity_id,
                    action="DELETE_CARDIAC_ASSESSMENT",
                    details=f"Deleted cardiac assessment ID {cardiac_id}",
                    created_at=current_timestamp(),
                )
            )
        return success
