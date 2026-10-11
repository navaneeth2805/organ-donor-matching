"""Business service layer for Organ Donor management."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, Donor
from database.repositories import AuditLogRepository, DonorRepository, HospitalRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_age,
    validate_availability,
    validate_blood_group,
    validate_email,
    validate_hospital_id,
    validate_id,
    validate_location,
    validate_name,
    validate_organ,
    validate_phone,
)

logger = get_logger("modules.donor")


class DonorService:
    """Service handling donor business logic, validations, statistics, and audit logging."""

    def __init__(
        self,
        donor_repo: DonorRepository,
        hospital_repo: HospitalRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = donor_repo
        self.hospital_repo = hospital_repo
        self.audit_repo = audit_repo

    def create_donor(
        self,
        donor_id: int | None,
        name: str,
        age: int,
        blood_group: str,
        organ: str,
        hospital_id: int | None,
        location: str,
        availability: str,
        phone: str | None = None,
        email: str | None = None,
        registration_date: str | None = None,
    ) -> Donor:
        """Validate input parameters and register a new donor."""
        valid_id = validate_id(donor_id, "Donor ID") if donor_id is not None else None
        valid_name = validate_name(name, "Donor Name")
        valid_age = validate_age(age)
        valid_bg = validate_blood_group(blood_group)
        valid_organ = validate_organ(organ)
        valid_hid = validate_hospital_id(hospital_id)
        valid_loc = validate_location(location, "Location")
        valid_avail = validate_availability(availability)
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)
        valid_reg_date = registration_date.strip() if registration_date else current_date()

        # Validate hospital existence if specified
        if valid_hid is not None:
            hosp = self.hospital_repo.get_by_id(valid_hid)
            if not hosp:
                raise ValidationError(f"Hospital with ID {valid_hid} does not exist.")

        now = current_timestamp()
        donor = Donor(
            id=valid_id,
            name=valid_name,
            age=valid_age,
            blood_group=valid_bg,
            organ=valid_organ,
            hospital_id=valid_hid,
            location=valid_loc,
            availability=valid_avail,
            phone=valid_phone,
            email=valid_email,
            registration_date=valid_reg_date,
            created_at=now,
            updated_at=now,
        )

        saved = self.repo.create(donor)
        logger.info("Registered donor: ID %s, Name: '%s'", saved.id, saved.name)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="donor",
                entity_id=saved.id,
                action="CREATE",
                details=f"Registered donor '{saved.name}' ({saved.blood_group}, {saved.organ}) - {saved.availability}.",
                created_at=now,
            )
        )
        return saved

    def get_donor_by_id(self, donor_id: int) -> Donor:
        """Retrieve donor by ID or raise RecordNotFoundError."""
        donor = self.repo.get_by_id(donor_id)
        if not donor:
            raise RecordNotFoundError(f"Donor with ID {donor_id} does not exist.")
        return donor

    def list_donors(
        self,
        sort_by: str = "id",
        sort_asc: bool = True,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Donor]:
        """List all donors sorted and optionally paginated."""
        return self.repo.get_all(sort_by=sort_by, sort_asc=sort_asc, limit=limit, offset=offset)

    def search_donors(
        self,
        search_query: str,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Donor]:
        """Search donors by text."""
        if not search_query or not search_query.strip():
            return self.list_donors(sort_by=sort_by, sort_asc=sort_asc)
        return self.repo.search(search_query.strip(), sort_by=sort_by, sort_asc=sort_asc)

    def filter_donors(
        self,
        hospital_id: int | None = None,
        blood_group: str | None = None,
        organ: str | None = None,
        availability: str | None = None,
        min_age: int | None = None,
        max_age: int | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        search_term: str | None = None,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Donor]:
        """Filter donors across multiple parameters."""
        return self.repo.filter(
            hospital_id=hospital_id,
            blood_group=blood_group,
            organ=organ,
            availability=availability,
            min_age=min_age,
            max_age=max_age,
            start_date=start_date,
            end_date=end_date,
            search_term=search_term,
            sort_by=sort_by,
            sort_asc=sort_asc,
        )

    def update_donor(
        self,
        donor_id: int,
        name: str,
        age: int,
        blood_group: str,
        organ: str,
        hospital_id: int | None,
        location: str,
        availability: str,
        phone: str | None = None,
        email: str | None = None,
        registration_date: str | None = None,
    ) -> Donor:
        """Validate and update existing donor."""
        existing = self.get_donor_by_id(donor_id)

        valid_name = validate_name(name, "Donor Name")
        valid_age = validate_age(age)
        valid_bg = validate_blood_group(blood_group)
        valid_organ = validate_organ(organ)
        valid_hid = validate_hospital_id(hospital_id)
        valid_loc = validate_location(location, "Location")
        valid_avail = validate_availability(availability)
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)
        valid_reg_date = registration_date.strip() if registration_date else existing.registration_date

        if valid_hid is not None:
            hosp = self.hospital_repo.get_by_id(valid_hid)
            if not hosp:
                raise ValidationError(f"Hospital with ID {valid_hid} does not exist.")

        now = current_timestamp()
        updated = Donor(
            id=existing.id,
            name=valid_name,
            age=valid_age,
            blood_group=valid_bg,
            organ=valid_organ,
            hospital_id=valid_hid,
            location=valid_loc,
            availability=valid_avail,
            phone=valid_phone,
            email=valid_email,
            registration_date=valid_reg_date,
            created_at=existing.created_at,
            updated_at=now,
        )

        self.repo.update(updated)
        logger.info("Updated donor ID %s", donor_id)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="donor",
                entity_id=donor_id,
                action="UPDATE",
                details=f"Updated donor '{updated.name}' ({updated.blood_group}, {updated.organ}) - {updated.availability}.",
                created_at=now,
            )
        )
        return updated

    def delete_donor(self, donor_id: int) -> bool:
        """Delete donor and write audit entry."""
        existing = self.get_donor_by_id(donor_id)
        now = current_timestamp()
        success = self.repo.delete(donor_id)
        if success:
            logger.info("Deleted donor ID %s", donor_id)
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type="donor",
                    entity_id=donor_id,
                    action="DELETE",
                    details=f"Deleted donor '{existing.name}' (ID: {donor_id}).",
                    created_at=now,
                )
            )
        return success

    def get_statistics(self) -> dict[str, Any]:
        """Compute donor distribution metrics."""
        donors = self.repo.get_all()
        total = len(donors)
        available = sum(1 for d in donors if d.availability == "Available")
        pending = sum(1 for d in donors if d.availability == "Pending")
        unavailable = sum(1 for d in donors if d.availability == "Unavailable")

        by_organ: dict[str, int] = {}
        by_blood_group: dict[str, int] = {}

        for d in donors:
            by_organ[d.organ] = by_organ.get(d.organ, 0) + 1
            by_blood_group[d.blood_group] = by_blood_group.get(d.blood_group, 0) + 1

        return {
            "total_donors": total,
            "available_donors": available,
            "pending_donors": pending,
            "unavailable_donors": unavailable,
            "by_organ": by_organ,
            "by_blood_group": by_blood_group,
        }
