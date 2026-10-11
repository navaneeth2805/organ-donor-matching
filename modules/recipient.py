"""Business service layer for Organ Recipient management."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, Recipient
from database.repositories import AuditLogRepository, HospitalRepository, RecipientRepository
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_age,
    validate_blood_group,
    validate_email,
    validate_hospital_id,
    validate_id,
    validate_location,
    validate_name,
    validate_organ,
    validate_phone,
    validate_urgency,
    validate_waiting_time,
)

logger = get_logger("modules.recipient")


class RecipientService:
    """Service handling recipient business logic, validations, metrics, and audit logging."""

    def __init__(
        self,
        recipient_repo: RecipientRepository,
        hospital_repo: HospitalRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = recipient_repo
        self.hospital_repo = hospital_repo
        self.audit_repo = audit_repo

    def create_recipient(
        self,
        recipient_id: int | None,
        name: str,
        age: int,
        blood_group: str,
        organ_needed: str,
        hospital_id: int | None,
        location: str,
        urgency: str,
        waiting_time_days: int = 0,
        phone: str | None = None,
        email: str | None = None,
        registration_date: str | None = None,
    ) -> Recipient:
        """Validate input and register a new recipient waiting for transplant."""
        valid_id = validate_id(recipient_id, "Recipient ID") if recipient_id is not None else None
        valid_name = validate_name(name, "Recipient Name")
        valid_age = validate_age(age)
        valid_bg = validate_blood_group(blood_group)
        valid_organ = validate_organ(organ_needed)
        valid_hid = validate_hospital_id(hospital_id)
        valid_loc = validate_location(location, "Location")
        valid_urgency = validate_urgency(urgency)
        valid_wt = validate_waiting_time(waiting_time_days)
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)
        valid_reg_date = registration_date.strip() if registration_date else current_date()

        if valid_hid is not None:
            hosp = self.hospital_repo.get_by_id(valid_hid)
            if not hosp:
                raise ValidationError(f"Hospital with ID {valid_hid} does not exist.")

        now = current_timestamp()
        recipient = Recipient(
            id=valid_id,
            name=valid_name,
            age=valid_age,
            blood_group=valid_bg,
            organ_needed=valid_organ,
            hospital_id=valid_hid,
            location=valid_loc,
            urgency=valid_urgency,
            waiting_time_days=valid_wt,
            phone=valid_phone,
            email=valid_email,
            registration_date=valid_reg_date,
            created_at=now,
            updated_at=now,
        )

        saved = self.repo.create(recipient)
        logger.info("Registered recipient: ID %s, Name: '%s'", saved.id, saved.name)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="recipient",
                entity_id=saved.id,
                action="CREATE",
                details=f"Registered recipient '{saved.name}' ({saved.blood_group}, {saved.organ_needed}) - Urgency: {saved.urgency}.",
                created_at=now,
            )
        )
        return saved

    def get_recipient_by_id(self, recipient_id: int) -> Recipient:
        """Retrieve recipient by ID or raise RecordNotFoundError."""
        recipient = self.repo.get_by_id(recipient_id)
        if not recipient:
            raise RecordNotFoundError(f"Recipient with ID {recipient_id} does not exist.")
        return recipient

    def list_recipients(
        self,
        sort_by: str = "id",
        sort_asc: bool = True,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Recipient]:
        """List all recipients sorted and optionally paginated."""
        return self.repo.get_all(sort_by=sort_by, sort_asc=sort_asc, limit=limit, offset=offset)

    def search_recipients(
        self,
        search_query: str,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Recipient]:
        """Search recipients by query."""
        if not search_query or not search_query.strip():
            return self.list_recipients(sort_by=sort_by, sort_asc=sort_asc)
        return self.repo.search(search_query.strip(), sort_by=sort_by, sort_asc=sort_asc)

    def filter_recipients(
        self,
        hospital_id: int | None = None,
        blood_group: str | None = None,
        organ_needed: str | None = None,
        urgency: str | None = None,
        min_waiting_time: int | None = None,
        max_waiting_time: int | None = None,
        min_age: int | None = None,
        max_age: int | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        search_term: str | None = None,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Recipient]:
        """Filter recipients based on criteria."""
        return self.repo.filter(
            hospital_id=hospital_id,
            blood_group=blood_group,
            organ_needed=organ_needed,
            urgency=urgency,
            min_waiting_time=min_waiting_time,
            max_waiting_time=max_waiting_time,
            min_age=min_age,
            max_age=max_age,
            start_date=start_date,
            end_date=end_date,
            search_term=search_term,
            sort_by=sort_by,
            sort_asc=sort_asc,
        )

    def update_recipient(
        self,
        recipient_id: int,
        name: str,
        age: int,
        blood_group: str,
        organ_needed: str,
        hospital_id: int | None,
        location: str,
        urgency: str,
        waiting_time_days: int = 0,
        phone: str | None = None,
        email: str | None = None,
        registration_date: str | None = None,
    ) -> Recipient:
        """Validate and update existing recipient."""
        existing = self.get_recipient_by_id(recipient_id)

        valid_name = validate_name(name, "Recipient Name")
        valid_age = validate_age(age)
        valid_bg = validate_blood_group(blood_group)
        valid_organ = validate_organ(organ_needed)
        valid_hid = validate_hospital_id(hospital_id)
        valid_loc = validate_location(location, "Location")
        valid_urgency = validate_urgency(urgency)
        valid_wt = validate_waiting_time(waiting_time_days)
        valid_phone = validate_phone(phone)
        valid_email = validate_email(email)
        valid_reg_date = registration_date.strip() if registration_date else existing.registration_date

        if valid_hid is not None:
            hosp = self.hospital_repo.get_by_id(valid_hid)
            if not hosp:
                raise ValidationError(f"Hospital with ID {valid_hid} does not exist.")

        now = current_timestamp()
        updated = Recipient(
            id=existing.id,
            name=valid_name,
            age=valid_age,
            blood_group=valid_bg,
            organ_needed=valid_organ,
            hospital_id=valid_hid,
            location=valid_loc,
            urgency=valid_urgency,
            waiting_time_days=valid_wt,
            phone=valid_phone,
            email=valid_email,
            registration_date=valid_reg_date,
            created_at=existing.created_at,
            updated_at=now,
        )

        self.repo.update(updated)
        logger.info("Updated recipient ID %s", recipient_id)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="recipient",
                entity_id=recipient_id,
                action="UPDATE",
                details=f"Updated recipient '{updated.name}' ({updated.blood_group}, {updated.organ_needed}) - Urgency: {updated.urgency}.",
                created_at=now,
            )
        )
        return updated

    def delete_recipient(self, recipient_id: int) -> bool:
        """Delete recipient record and log."""
        existing = self.get_recipient_by_id(recipient_id)
        now = current_timestamp()
        success = self.repo.delete(recipient_id)
        if success:
            logger.info("Deleted recipient ID %s", recipient_id)
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type="recipient",
                    entity_id=recipient_id,
                    action="DELETE",
                    details=f"Deleted recipient '{existing.name}' (ID: {recipient_id}).",
                    created_at=now,
                )
            )
        return success

    def get_statistics(self) -> dict[str, Any]:
        """Compute recipient metrics."""
        recipients = self.repo.get_all()
        total = len(recipients)
        critical = sum(1 for r in recipients if r.urgency == "Critical")
        high = sum(1 for r in recipients if r.urgency == "High")
        medium = sum(1 for r in recipients if r.urgency == "Medium")
        low = sum(1 for r in recipients if r.urgency == "Low")

        by_organ: dict[str, int] = {}
        by_blood_group: dict[str, int] = {}
        by_urgency: dict[str, int] = {
            "Critical": critical,
            "High": high,
            "Medium": medium,
            "Low": low,
        }

        for r in recipients:
            by_organ[r.organ_needed] = by_organ.get(r.organ_needed, 0) + 1
            by_blood_group[r.blood_group] = by_blood_group.get(r.blood_group, 0) + 1

        return {
            "total_recipients": total,
            "critical_recipients": critical,
            "by_urgency": by_urgency,
            "by_organ": by_organ,
            "by_blood_group": by_blood_group,
        }
