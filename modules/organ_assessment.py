"""Business service layer for Donor Organ-Specific Assessments."""

from config.logging_config import get_logger
from database.models import AuditLog, OrganAssessment
from database.repositories import AuditLogRepository, DonorRepository, OrganAssessmentRepository
from utils.exceptions import RecordNotFoundError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_date_iso,
    validate_id,
    validate_organ,
    validate_organ_assessment_status,
)

logger = get_logger("modules.organ_assessment")


class OrganAssessmentService:
    """Service handling organ-specific structural, functional, and procurement suitability assessments."""

    def __init__(
        self,
        assessment_repo: OrganAssessmentRepository,
        donor_repo: DonorRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = assessment_repo
        self.donor_repo = donor_repo
        self.audit_repo = audit_repo

    def record_organ_assessment(
        self,
        donor_id: int,
        organ: str,
        assessment_status: str,
        assessment_notes: str | None = None,
        assessment_date: str | None = None,
    ) -> OrganAssessment:
        """Validate donor, organ type, assessment status, and record clinical evaluation."""
        valid_donor_id = validate_id(donor_id, "Donor ID")
        if not self.donor_repo.get_by_id(valid_donor_id):
            raise RecordNotFoundError(f"Donor with ID {valid_donor_id} not found.")

        valid_organ = validate_organ(organ)
        valid_status = validate_organ_assessment_status(assessment_status)
        date_val = validate_date_iso(assessment_date or current_date(), "Assessment date", allow_future=False)
        ts = current_timestamp()

        assessment = OrganAssessment(
            id=None,
            donor_id=valid_donor_id,
            organ=valid_organ,
            assessment_status=valid_status,
            assessment_notes=str(assessment_notes or "").strip() or None,
            assessment_date=date_val,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(assessment)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="ORGAN_ASSESSMENT",
                entity_id=saved.id,
                action="RECORD_ORGAN_ASSESSMENT",
                details=f"Organ assessment for Donor {valid_donor_id} ({valid_organ}): Status={valid_status}",
                created_at=ts,
            )
        )

        logger.info("Organ assessment recorded: Donor %d, Organ %s, Status %s", valid_donor_id, valid_organ, valid_status)
        return saved

    def get_latest_by_organ(self, donor_id: int, organ: str) -> OrganAssessment | None:
        """Fetch latest assessment for a specific organ of a donor."""
        return self.repo.get_latest_by_organ(donor_id, organ)

    def get_by_donor(self, donor_id: int) -> list[OrganAssessment]:
        """Fetch all assessments for a donor."""
        return self.repo.get_by_donor(donor_id)

    def get_all(self, limit: int = 100) -> list[OrganAssessment]:
        return self.repo.get_all(limit=limit)

    def delete_organ_assessment(self, assessment_id: int) -> bool:
        """Remove an organ assessment record."""
        existing = self.repo.get_by_id(assessment_id)
        if not existing:
            raise RecordNotFoundError(f"Organ assessment {assessment_id} not found.")

        success = self.repo.delete(assessment_id)
        if success:
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type="ORGAN_ASSESSMENT",
                    entity_id=assessment_id,
                    action="DELETE_ORGAN_ASSESSMENT",
                    details=f"Deleted organ assessment ID {assessment_id}",
                    created_at=current_timestamp(),
                )
            )
        return success
