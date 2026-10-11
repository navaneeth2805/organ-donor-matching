"""Unified Orchestrator service layer for Medical Profiles and Health Intelligence."""

from typing import Any
from config.logging_config import get_logger
from database.models import (
    AuditLog,
    CardiacAssessment,
    CrossmatchResult,
    HLAProfile,
    LaboratoryResults,
    MedicalHistory,
    MedicalProfile,
    OrganAssessment,
    VitalSigns,
)
from database.repositories import (
    AuditLogRepository,
    DonorRepository,
    MedicalProfileRepository,
    RecipientRepository,
)
from modules.cardiac_assessment import CardiacAssessmentService
from modules.data_quality import DataQualityReport, DataQualityService
from modules.immunology import CrossmatchService, HLAService
from modules.laboratory import LaboratoryService
from modules.medical_history import MedicalHistoryService
from modules.organ_assessment import OrganAssessmentService
from modules.vital_signs import VitalSignsService
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import validate_date_iso, validate_id

logger = get_logger("modules.medical_profile")


class MedicalProfileService:
    """Orchestrates comprehensive medical profile creation, synchronization, cross-specialty review, and audits."""

    def __init__(
        self,
        profile_repo: MedicalProfileRepository,
        donor_repo: DonorRepository,
        recipient_repo: RecipientRepository,
        vitals_service: VitalSignsService,
        lab_service: LaboratoryService,
        cardiac_service: CardiacAssessmentService,
        history_service: MedicalHistoryService,
        hla_service: HLAService,
        crossmatch_service: CrossmatchService,
        organ_service: OrganAssessmentService,
        data_quality_service: DataQualityService,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.profile_repo = profile_repo
        self.donor_repo = donor_repo
        self.recipient_repo = recipient_repo
        self.vitals_service = vitals_service
        self.lab_service = lab_service
        self.cardiac_service = cardiac_service
        self.history_service = history_service
        self.hla_service = hla_service
        self.crossmatch_service = crossmatch_service
        self.organ_service = organ_service
        self.data_quality_service = data_quality_service
        self.audit_repo = audit_repo

    def get_complete_profile(self, entity_type: str, entity_id: int) -> dict[str, Any]:
        """Fetch unified medical bundle across all clinical specialty domains."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be 'DONOR' or 'RECIPIENT'.")

        valid_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        if clean_entity_type == "DONOR":
            entity = self.donor_repo.get_by_id(valid_id)
            if not entity:
                raise RecordNotFoundError(f"Donor with ID {valid_id} does not exist.")
        else:
            entity = self.recipient_repo.get_by_id(valid_id)
            if not entity:
                raise RecordNotFoundError(f"Recipient with ID {valid_id} does not exist.")

        # Sub-records
        overview = self.profile_repo.get_by_entity(clean_entity_type, valid_id)
        vitals = self.vitals_service.get_latest(clean_entity_type, valid_id)
        labs = self.lab_service.get_latest(clean_entity_type, valid_id)
        cardiac = self.cardiac_service.get_latest(clean_entity_type, valid_id)
        history = self.history_service.get_latest(clean_entity_type, valid_id)
        hla = self.hla_service.get_latest(clean_entity_type, valid_id)

        organs = self.organ_service.get_by_donor(valid_id) if clean_entity_type == "DONOR" else []
        crossmatches = (
            self.crossmatch_service.get_by_donor(valid_id)
            if clean_entity_type == "DONOR"
            else self.crossmatch_service.get_by_recipient(valid_id)
        )

        quality_report = self.data_quality_service.evaluate_entity_quality(clean_entity_type, valid_id)

        return {
            "entity_type": clean_entity_type,
            "entity_id": valid_id,
            "entity": entity,
            "overview": overview,
            "vitals": vitals,
            "laboratory": labs,
            "cardiac": cardiac,
            "history": history,
            "hla": hla,
            "organ_assessments": organs,
            "crossmatches": crossmatches,
            "quality_report": quality_report,
        }

    def record_overview_notes(
        self,
        entity_type: str,
        entity_id: int,
        notes: str | None,
        assessment_date: str | None = None,
    ) -> MedicalProfile:
        """Create or update physician clinical overview assessment summary notes."""
        clean_entity_type = str(entity_type).strip().upper()
        valid_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")
        date_val = validate_date_iso(assessment_date or current_date(), "Assessment date", allow_future=False)
        ts = current_timestamp()

        existing = self.profile_repo.get_by_entity(clean_entity_type, valid_id)
        if existing:
            existing.notes = notes
            existing.assessment_date = date_val
            existing.updated_at = ts
            self.profile_repo.update(existing)
            saved = existing
        else:
            profile = MedicalProfile(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_id,
                assessment_date=date_val,
                notes=notes,
                created_at=ts,
                updated_at=ts,
            )
            saved = self.profile_repo.create(profile)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_id,
                action="UPDATE_MEDICAL_OVERVIEW",
                details=f"Physician overview assessment notes updated on {date_val}",
                created_at=ts,
            )
        )
        return saved
