"""Business service layer for Hospital facilities management."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, Hospital
from database.repositories import AuditLogRepository, HospitalRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_timestamp
from utils.validators import validate_email, validate_location, validate_name, validate_phone

logger = get_logger("modules.hospital")


class HospitalService:
    """Service orchestrating hospital facility operations, validation, and audit logging."""

    def __init__(
        self,
        hospital_repo: HospitalRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = hospital_repo
        self.audit_repo = audit_repo

    def add_hospital(
        self,
        name: str,
        city: str,
        state: str,
        country: str = "India",
        phone: str | None = None,
        email: str | None = None,
        active: int = 1,
    ) -> Hospital:
        """Validate and create a new hospital record."""
        valid_name = validate_name(name, "Hospital Name")
        valid_city = validate_location(city, "City")
        valid_state = validate_location(state, "State")
        valid_country = validate_location(country, "Country") if country else "India"
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)

        now = current_timestamp()
        hospital = Hospital(
            id=None,
            name=valid_name,
            city=valid_city,
            state=valid_state,
            country=valid_country,
            phone=valid_phone,
            email=valid_email,
            active=1 if active else 0,
            created_at=now,
            updated_at=now,
        )

        saved = self.repo.create(hospital)
        logger.info("Hospital created: ID %s, Name: '%s'", saved.id, saved.name)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="hospital",
                entity_id=saved.id,
                action="CREATE",
                details=f"Registered hospital '{saved.name}' in {saved.city}, {saved.state}.",
                created_at=now,
            )
        )
        return saved

    def get_hospital_by_id(self, hospital_id: int) -> Hospital:
        """Fetch hospital or raise RecordNotFoundError."""
        hospital = self.repo.get_by_id(hospital_id)
        if not hospital:
            raise RecordNotFoundError(f"Hospital with ID {hospital_id} not found.")
        return hospital

    def list_hospitals(
        self,
        active_only: bool = False,
        sort_by: str = "name",
        sort_asc: bool = True,
    ) -> list[Hospital]:
        """List hospitals with optional filtering and sorting."""
        return self.repo.get_all(active_only=active_only, sort_by=sort_by, sort_asc=sort_asc)

    def search_hospitals(self, query: str, active_only: bool = False) -> list[Hospital]:
        """Search hospitals by term."""
        if not query or not query.strip():
            return self.list_hospitals(active_only=active_only)
        return self.repo.search(query.strip(), active_only=active_only)

    def update_hospital(
        self,
        hospital_id: int,
        name: str,
        city: str,
        state: str,
        country: str = "India",
        phone: str | None = None,
        email: str | None = None,
        active: int = 1,
    ) -> Hospital:
        """Update existing hospital."""
        existing = self.get_hospital_by_id(hospital_id)

        valid_name = validate_name(name, "Hospital Name")
        valid_city = validate_location(city, "City")
        valid_state = validate_location(state, "State")
        valid_country = validate_location(country, "Country") if country else "India"
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)

        now = current_timestamp()
        updated_hospital = Hospital(
            id=existing.id,
            name=valid_name,
            city=valid_city,
            state=valid_state,
            country=valid_country,
            phone=valid_phone,
            email=valid_email,
            active=1 if active else 0,
            created_at=existing.created_at,
            updated_at=now,
        )

        self.repo.update(updated_hospital)
        logger.info("Hospital updated: ID %s", hospital_id)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="hospital",
                entity_id=hospital_id,
                action="UPDATE",
                details=f"Updated hospital '{updated_hospital.name}' (Active: {updated_hospital.active}).",
                created_at=now,
            )
        )
        return updated_hospital

    def toggle_active(self, hospital_id: int, active: bool) -> bool:
        """Activate or deactivate a hospital safely."""
        existing = self.get_hospital_by_id(hospital_id)
        now = current_timestamp()
        status_val = 1 if active else 0
        success = self.repo.set_active(hospital_id, status_val, now)

        status_text = "Activated" if active else "Deactivated"
        logger.info("%s hospital ID %s", status_text, hospital_id)
        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="hospital",
                entity_id=hospital_id,
                action="STATUS_CHANGE",
                details=f"{status_text} hospital '{existing.name}'.",
                created_at=now,
            )
        )
        return success

    def delete_hospital(self, hospital_id: int) -> bool:
        """Attempt deletion or deactivate if foreign references exist."""
        existing = self.get_hospital_by_id(hospital_id)
        now = current_timestamp()
        success = self.repo.delete(hospital_id)
        if success:
            logger.info("Deleted hospital ID %s", hospital_id)
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type="hospital",
                    entity_id=hospital_id,
                    action="DELETE",
                    details=f"Permanently deleted hospital '{existing.name}'.",
                    created_at=now,
                )
            )
        return success

    # Compatibility alias for create_hospital
    create_hospital = add_hospital
