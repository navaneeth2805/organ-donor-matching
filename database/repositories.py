"""Repository layer implementing the Repository Pattern for database access."""

import json
import sqlite3
from typing import Any, Sequence
from config.logging_config import get_logger
from database.database import DatabaseManager
from database.models import (
    AuditLog,
    Donor,
    Hospital,
    Recipient,
    MedicalProfile,
    VitalSigns,
    LaboratoryResults,
    CardiacAssessment,
    MedicalHistory,
    HLAProfile,
    CrossmatchResult,
    OrganAssessment,
    CompatibilityResult,
    MatchingRun,
)
from utils.exceptions import DatabaseError, DuplicateRecordError

logger = get_logger("database.repositories")


def _row_to_donor(row: sqlite3.Row) -> Donor:
    """Convert SQLite Row to Donor model."""
    d = dict(row)
    return Donor(
        id=d["id"],
        name=d["name"],
        age=d["age"],
        blood_group=d["blood_group"],
        organ=d["organ"],
        hospital_id=d["hospital_id"],
        location=d["location"],
        availability=d["availability"],
        phone=d.get("phone"),
        email=d.get("email"),
        registration_date=d["registration_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        hospital_name=d.get("hospital_name"),
    )


def _row_to_recipient(row: sqlite3.Row) -> Recipient:
    """Convert SQLite Row to Recipient model."""
    d = dict(row)
    return Recipient(
        id=d["id"],
        name=d["name"],
        age=d["age"],
        blood_group=d["blood_group"],
        organ_needed=d["organ_needed"],
        hospital_id=d["hospital_id"],
        location=d["location"],
        urgency=d["urgency"],
        waiting_time_days=d["waiting_time_days"],
        phone=d.get("phone"),
        email=d.get("email"),
        registration_date=d["registration_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        hospital_name=d.get("hospital_name"),
    )


def _row_to_hospital(row: sqlite3.Row) -> Hospital:
    """Convert SQLite Row to Hospital model."""
    d = dict(row)
    return Hospital(
        id=d["id"],
        name=d["name"],
        city=d["city"],
        state=d["state"],
        country=d["country"],
        phone=d.get("phone"),
        email=d.get("email"),
        active=d["active"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_audit_log(row: sqlite3.Row) -> AuditLog:
    """Convert SQLite Row to AuditLog model."""
    d = dict(row)
    return AuditLog(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        action=d["action"],
        details=d.get("details"),
        created_at=d["created_at"],
    )


class DonorRepository:
    """Repository handling persistence and queries for Donor entities."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, donor: Donor) -> Donor:
        """Insert a new donor record."""
        query = """
        INSERT INTO donors (
            id, name, age, blood_group, organ, hospital_id,
            location, availability, phone, email,
            registration_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            donor.id,
            donor.name,
            donor.age,
            donor.blood_group,
            donor.organ,
            donor.hospital_id,
            donor.location,
            donor.availability,
            donor.phone,
            donor.email,
            donor.registration_date,
            donor.created_at,
            donor.updated_at,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                if donor.id is None:
                    donor.id = cursor.lastrowid
            return donor
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "primary key" in err_msg or "unique" in err_msg:
                raise DuplicateRecordError(
                    f"Donor ID {donor.id} already exists. Please use another ID."
                ) from err
            if "foreign key" in err_msg:
                raise DatabaseError(
                    f"Selected Hospital ID {donor.hospital_id} does not exist."
                ) from err
            raise DatabaseError(f"Database constraint violation: {err}") from err

    def get_by_id(self, donor_id: int) -> Donor | None:
        """Fetch donor by unique identifier."""
        query = """
        SELECT d.*, h.name as hospital_name
        FROM donors d
        LEFT JOIN hospitals h ON d.hospital_id = h.id
        WHERE d.id = ?
        """
        row = self.db.fetch_one(query, (donor_id,))
        return _row_to_donor(row) if row else None

    def get_all(
        self,
        sort_by: str = "id",
        sort_asc: bool = True,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Donor]:
        """Fetch all donors with sorting and optional pagination."""
        allowed_sort = {
            "id": "d.id",
            "name": "d.name",
            "age": "d.age",
            "blood_group": "d.blood_group",
            "organ": "d.organ",
            "hospital": "hospital_name",
            "location": "d.location",
            "availability": "d.availability",
            "registration_date": "d.registration_date",
        }
        col = allowed_sort.get(sort_by.lower(), "d.id")
        direction = "ASC" if sort_asc else "DESC"

        query = f"""
        SELECT d.*, h.name as hospital_name
        FROM donors d
        LEFT JOIN hospitals h ON d.hospital_id = h.id
        ORDER BY {col} {direction}
        """
        params: list[Any] = []
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])

        rows = self.db.fetch_all(query, params)
        return [_row_to_donor(r) for r in rows]

    def update(self, donor: Donor) -> bool:
        """Update existing donor record."""
        query = """
        UPDATE donors SET
            name = ?,
            age = ?,
            blood_group = ?,
            organ = ?,
            hospital_id = ?,
            location = ?,
            availability = ?,
            phone = ?,
            email = ?,
            registration_date = ?,
            updated_at = ?
        WHERE id = ?
        """
        params = (
            donor.name,
            donor.age,
            donor.blood_group,
            donor.organ,
            donor.hospital_id,
            donor.location,
            donor.availability,
            donor.phone,
            donor.email,
            donor.registration_date,
            donor.updated_at,
            donor.id,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "foreign key" in err_msg:
                raise DatabaseError(
                    f"Selected Hospital ID {donor.hospital_id} does not exist."
                ) from err
            raise DatabaseError(f"Database constraint error: {err}") from err

    def delete(self, donor_id: int) -> bool:
        """Delete donor by identifier."""
        query = "DELETE FROM donors WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (donor_id,))
            conn.commit()
            return cursor.rowcount > 0

    def search(
        self,
        search_query: str,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Donor]:
        """Case-insensitive search across ID, Name, Hospital, and Location."""
        pattern = f"%{search_query.strip()}%"
        # Check if search is numeric id
        try:
            numeric_id = int(search_query.strip().lstrip("D-").lstrip("d-"))
        except ValueError:
            numeric_id = -1

        query = """
        SELECT d.*, h.name as hospital_name
        FROM donors d
        LEFT JOIN hospitals h ON d.hospital_id = h.id
        WHERE d.id = ?
           OR LOWER(d.name) LIKE LOWER(?)
           OR LOWER(d.location) LIKE LOWER(?)
           OR LOWER(h.name) LIKE LOWER(?)
        """
        direction = "ASC" if sort_asc else "DESC"
        query += f" ORDER BY d.id {direction}"
        rows = self.db.fetch_all(query, (numeric_id, pattern, pattern, pattern))
        return [_row_to_donor(r) for r in rows]

    def filter(
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
        """Multi-criteria filtered query at database level."""
        conditions = ["1=1"]
        params: list[Any] = []

        if hospital_id is not None:
            conditions.append("d.hospital_id = ?")
            params.append(hospital_id)
        if blood_group:
            conditions.append("d.blood_group = ?")
            params.append(blood_group)
        if organ:
            conditions.append("d.organ = ?")
            params.append(organ)
        if availability:
            conditions.append("d.availability = ?")
            params.append(availability)
        if min_age is not None:
            conditions.append("d.age >= ?")
            params.append(min_age)
        if max_age is not None:
            conditions.append("d.age <= ?")
            params.append(max_age)
        if start_date:
            conditions.append("d.registration_date >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("d.registration_date <= ?")
            params.append(end_date)
        if search_term and search_term.strip():
            pat = f"%{search_term.strip()}%"
            try:
                nid = int(search_term.strip().lstrip("D-").lstrip("d-"))
            except ValueError:
                nid = -1
            conditions.append(
                "(d.id = ? OR LOWER(d.name) LIKE LOWER(?) OR LOWER(d.location) LIKE LOWER(?) OR LOWER(h.name) LIKE LOWER(?))"
            )
            params.extend([nid, pat, pat, pat])

        allowed_sort = {
            "id": "d.id",
            "name": "d.name",
            "age": "d.age",
            "blood_group": "d.blood_group",
            "organ": "d.organ",
            "hospital": "hospital_name",
            "location": "d.location",
            "availability": "d.availability",
            "registration_date": "d.registration_date",
        }
        col = allowed_sort.get(sort_by.lower(), "d.id")
        direction = "ASC" if sort_asc else "DESC"

        where_clause = " AND ".join(conditions)
        query = f"""
        SELECT d.*, h.name as hospital_name
        FROM donors d
        LEFT JOIN hospitals h ON d.hospital_id = h.id
        WHERE {where_clause}
        ORDER BY {col} {direction}
        """
        rows = self.db.fetch_all(query, params)
        return [_row_to_donor(r) for r in rows]

    def count(self, availability: str | None = None) -> int:
        """Count donors, optionally filtered by availability."""
        if availability:
            query = "SELECT COUNT(*) as count FROM donors WHERE availability = ?"
            row = self.db.fetch_one(query, (availability,))
        else:
            query = "SELECT COUNT(*) as count FROM donors"
            row = self.db.fetch_one(query)
        return row["count"] if row else 0


class RecipientRepository:
    """Repository handling persistence and queries for Recipient entities."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, recipient: Recipient) -> Recipient:
        """Insert a new recipient record."""
        query = """
        INSERT INTO recipients (
            id, name, age, blood_group, organ_needed, hospital_id,
            location, urgency, waiting_time_days, phone, email,
            registration_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            recipient.id,
            recipient.name,
            recipient.age,
            recipient.blood_group,
            recipient.organ_needed,
            recipient.hospital_id,
            recipient.location,
            recipient.urgency,
            recipient.waiting_time_days,
            recipient.phone,
            recipient.email,
            recipient.registration_date,
            recipient.created_at,
            recipient.updated_at,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                if recipient.id is None:
                    recipient.id = cursor.lastrowid
            return recipient
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "primary key" in err_msg or "unique" in err_msg:
                raise DuplicateRecordError(
                    f"Recipient ID {recipient.id} already exists. Please use another ID."
                ) from err
            if "foreign key" in err_msg:
                raise DatabaseError(
                    f"Selected Hospital ID {recipient.hospital_id} does not exist."
                ) from err
            raise DatabaseError(f"Database constraint error: {err}") from err

    def get_by_id(self, recipient_id: int) -> Recipient | None:
        """Fetch recipient by identifier."""
        query = """
        SELECT r.*, h.name as hospital_name
        FROM recipients r
        LEFT JOIN hospitals h ON r.hospital_id = h.id
        WHERE r.id = ?
        """
        row = self.db.fetch_one(query, (recipient_id,))
        return _row_to_recipient(row) if row else None

    def get_all(
        self,
        sort_by: str = "id",
        sort_asc: bool = True,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Recipient]:
        """Fetch all recipients with sorting and optional pagination."""
        allowed_sort = {
            "id": "r.id",
            "name": "r.name",
            "age": "r.age",
            "blood_group": "r.blood_group",
            "organ_needed": "r.organ_needed",
            "hospital": "hospital_name",
            "location": "r.location",
            "urgency": "r.urgency",
            "waiting_time": "r.waiting_time_days",
            "waiting_time_days": "r.waiting_time_days",
            "registration_date": "r.registration_date",
        }
        col = allowed_sort.get(sort_by.lower(), "r.id")
        direction = "ASC" if sort_asc else "DESC"

        query = f"""
        SELECT r.*, h.name as hospital_name
        FROM recipients r
        LEFT JOIN hospitals h ON r.hospital_id = h.id
        ORDER BY {col} {direction}
        """
        params: list[Any] = []
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])

        rows = self.db.fetch_all(query, params)
        return [_row_to_recipient(r) for r in rows]

    def update(self, recipient: Recipient) -> bool:
        """Update existing recipient record."""
        query = """
        UPDATE recipients SET
            name = ?,
            age = ?,
            blood_group = ?,
            organ_needed = ?,
            hospital_id = ?,
            location = ?,
            urgency = ?,
            waiting_time_days = ?,
            phone = ?,
            email = ?,
            registration_date = ?,
            updated_at = ?
        WHERE id = ?
        """
        params = (
            recipient.name,
            recipient.age,
            recipient.blood_group,
            recipient.organ_needed,
            recipient.hospital_id,
            recipient.location,
            recipient.urgency,
            recipient.waiting_time_days,
            recipient.phone,
            recipient.email,
            recipient.registration_date,
            recipient.updated_at,
            recipient.id,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "foreign key" in err_msg:
                raise DatabaseError(
                    f"Selected Hospital ID {recipient.hospital_id} does not exist."
                ) from err
            raise DatabaseError(f"Database constraint error: {err}") from err

    def delete(self, recipient_id: int) -> bool:
        """Delete recipient record."""
        query = "DELETE FROM recipients WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (recipient_id,))
            conn.commit()
            return cursor.rowcount > 0

    def search(
        self,
        search_query: str,
        sort_by: str = "id",
        sort_asc: bool = True,
    ) -> list[Recipient]:
        """Case-insensitive search across ID, Name, Hospital, and Location."""
        pattern = f"%{search_query.strip()}%"
        try:
            numeric_id = int(search_query.strip().lstrip("R-").lstrip("r-"))
        except ValueError:
            numeric_id = -1

        query = """
        SELECT r.*, h.name as hospital_name
        FROM recipients r
        LEFT JOIN hospitals h ON r.hospital_id = h.id
        WHERE r.id = ?
           OR LOWER(r.name) LIKE LOWER(?)
           OR LOWER(r.location) LIKE LOWER(?)
           OR LOWER(h.name) LIKE LOWER(?)
        """
        direction = "ASC" if sort_asc else "DESC"
        query += f" ORDER BY r.id {direction}"
        rows = self.db.fetch_all(query, (numeric_id, pattern, pattern, pattern))
        return [_row_to_recipient(r) for r in rows]

    def filter(
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
        """Multi-criteria filtered query at database level."""
        conditions = ["1=1"]
        params: list[Any] = []

        if hospital_id is not None:
            conditions.append("r.hospital_id = ?")
            params.append(hospital_id)
        if blood_group:
            conditions.append("r.blood_group = ?")
            params.append(blood_group)
        if organ_needed:
            conditions.append("r.organ_needed = ?")
            params.append(organ_needed)
        if urgency:
            conditions.append("r.urgency = ?")
            params.append(urgency)
        if min_waiting_time is not None:
            conditions.append("r.waiting_time_days >= ?")
            params.append(min_waiting_time)
        if max_waiting_time is not None:
            conditions.append("r.waiting_time_days <= ?")
            params.append(max_waiting_time)
        if min_age is not None:
            conditions.append("r.age >= ?")
            params.append(min_age)
        if max_age is not None:
            conditions.append("r.age <= ?")
            params.append(max_age)
        if start_date:
            conditions.append("r.registration_date >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("r.registration_date <= ?")
            params.append(end_date)
        if search_term and search_term.strip():
            pat = f"%{search_term.strip()}%"
            try:
                nid = int(search_term.strip().lstrip("R-").lstrip("r-"))
            except ValueError:
                nid = -1
            conditions.append(
                "(r.id = ? OR LOWER(r.name) LIKE LOWER(?) OR LOWER(r.location) LIKE LOWER(?) OR LOWER(h.name) LIKE LOWER(?))"
            )
            params.extend([nid, pat, pat, pat])

        allowed_sort = {
            "id": "r.id",
            "name": "r.name",
            "age": "r.age",
            "blood_group": "r.blood_group",
            "organ_needed": "r.organ_needed",
            "hospital": "hospital_name",
            "location": "r.location",
            "urgency": "r.urgency",
            "waiting_time": "r.waiting_time_days",
            "waiting_time_days": "r.waiting_time_days",
            "registration_date": "r.registration_date",
        }
        col = allowed_sort.get(sort_by.lower(), "r.id")
        direction = "ASC" if sort_asc else "DESC"

        where_clause = " AND ".join(conditions)
        query = f"""
        SELECT r.*, h.name as hospital_name
        FROM recipients r
        LEFT JOIN hospitals h ON r.hospital_id = h.id
        WHERE {where_clause}
        ORDER BY {col} {direction}
        """
        rows = self.db.fetch_all(query, params)
        return [_row_to_recipient(r) for r in rows]

    def count(self, urgency: str | None = None) -> int:
        """Count recipients, optionally filtered by urgency level."""
        if urgency:
            query = "SELECT COUNT(*) as count FROM recipients WHERE urgency = ?"
            row = self.db.fetch_one(query, (urgency,))
        else:
            query = "SELECT COUNT(*) as count FROM recipients"
            row = self.db.fetch_one(query)
        return row["count"] if row else 0


class HospitalRepository:
    """Repository handling persistence and queries for Hospital entities."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, hospital: Hospital) -> Hospital:
        """Insert a new hospital facility record."""
        query = """
        INSERT INTO hospitals (name, city, state, country, phone, email, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            hospital.name,
            hospital.city,
            hospital.state,
            hospital.country,
            hospital.phone,
            hospital.email,
            hospital.active,
            hospital.created_at,
            hospital.updated_at,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                hospital.id = cursor.lastrowid
            return hospital
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "unique" in err_msg:
                raise DuplicateRecordError(
                    f"Hospital with name '{hospital.name}' already exists. Please use a unique name."
                ) from err
            raise DatabaseError(f"Database constraint error: {err}") from err

    def get_by_id(self, hospital_id: int) -> Hospital | None:
        """Fetch hospital by identifier."""
        query = "SELECT * FROM hospitals WHERE id = ?"
        row = self.db.fetch_one(query, (hospital_id,))
        return _row_to_hospital(row) if row else None

    def get_by_name(self, name: str) -> Hospital | None:
        """Fetch hospital by name."""
        query = "SELECT * FROM hospitals WHERE LOWER(name) = LOWER(?)"
        row = self.db.fetch_one(query, (name.strip(),))
        return _row_to_hospital(row) if row else None

    def get_all(
        self,
        active_only: bool = False,
        sort_by: str = "name",
        sort_asc: bool = True,
    ) -> list[Hospital]:
        """Fetch all hospitals."""
        allowed_sort = {
            "id": "id",
            "name": "name",
            "city": "city",
            "state": "state",
            "active": "active",
        }
        col = allowed_sort.get(sort_by.lower(), "name")
        direction = "ASC" if sort_asc else "DESC"

        if active_only:
            query = f"SELECT * FROM hospitals WHERE active = 1 ORDER BY {col} {direction}"
            rows = self.db.fetch_all(query)
        else:
            query = f"SELECT * FROM hospitals ORDER BY {col} {direction}"
            rows = self.db.fetch_all(query)
        return [_row_to_hospital(r) for r in rows]

    def update(self, hospital: Hospital) -> bool:
        """Update existing hospital."""
        query = """
        UPDATE hospitals SET
            name = ?,
            city = ?,
            state = ?,
            country = ?,
            phone = ?,
            email = ?,
            active = ?,
            updated_at = ?
        WHERE id = ?
        """
        params = (
            hospital.name,
            hospital.city,
            hospital.state,
            hospital.country,
            hospital.phone,
            hospital.email,
            hospital.active,
            hospital.updated_at,
            hospital.id,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.IntegrityError as err:
            err_msg = str(err).lower()
            if "unique" in err_msg:
                raise DuplicateRecordError(
                    f"Hospital with name '{hospital.name}' already exists."
                ) from err
            raise DatabaseError(f"Database constraint error: {err}") from err

    def delete(self, hospital_id: int) -> bool:
        """Physically delete a hospital if no references exist, or raise DatabaseError."""
        query = "DELETE FROM hospitals WHERE id = ?"
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (hospital_id,))
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.IntegrityError as err:
            raise DatabaseError(
                "Cannot delete hospital because donors or recipients are registered with it. Deactivate instead."
            ) from err

    def set_active(self, hospital_id: int, active: int, updated_at: str) -> bool:
        """Safely activate or deactivate a hospital."""
        query = "UPDATE hospitals SET active = ?, updated_at = ? WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (active, updated_at, hospital_id))
            conn.commit()
            return cursor.rowcount > 0

    def search(self, query_str: str, active_only: bool = False) -> list[Hospital]:
        """Search hospitals by name, city, or state."""
        pattern = f"%{query_str.strip()}%"
        active_filter = "AND active = 1" if active_only else ""
        query = f"""
        SELECT * FROM hospitals
        WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(city) LIKE LOWER(?) OR LOWER(state) LIKE LOWER(?))
        {active_filter}
        ORDER BY name ASC
        """
        rows = self.db.fetch_all(query, (pattern, pattern, pattern))
        return [_row_to_hospital(r) for r in rows]

    def count(self, active_only: bool = False) -> int:
        """Count registered hospitals."""
        if active_only:
            query = "SELECT COUNT(*) as count FROM hospitals WHERE active = 1"
        else:
            query = "SELECT COUNT(*) as count FROM hospitals"
        row = self.db.fetch_one(query)
        return row["count"] if row else 0


class AuditLogRepository:
    """Repository handling persistence and retrieval of AuditLog entries."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, log: AuditLog) -> AuditLog:
        """Record an audit log entry."""
        query = """
        INSERT INTO audit_logs (entity_type, entity_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """
        params = (
            log.entity_type,
            log.entity_id,
            log.action,
            log.details,
            log.created_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            log.id = cursor.lastrowid
        return log

    def get_all(self, limit: int = 100) -> list[AuditLog]:
        """Fetch latest audit log entries."""
        query = "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?"
        rows = self.db.fetch_all(query, (limit,))
        return [_row_to_audit_log(r) for r in rows]

    def get_by_entity(self, entity_type: str, entity_id: int) -> list[AuditLog]:
        """Fetch audit logs for a specific entity."""
        query = "SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC"
        rows = self.db.fetch_all(query, (entity_type, entity_id))
        return [_row_to_audit_log(r) for r in rows]


# ============================================================================
# Phase 2: Medical Intelligence Row Converters
# ============================================================================


def _row_to_medical_profile(row: sqlite3.Row) -> MedicalProfile:
    d = dict(row)
    return MedicalProfile(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        assessment_date=d["assessment_date"],
        notes=d.get("notes"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_vital_signs(row: sqlite3.Row) -> VitalSigns:
    d = dict(row)
    return VitalSigns(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        systolic_bp=d.get("systolic_bp"),
        diastolic_bp=d.get("diastolic_bp"),
        heart_rate=d.get("heart_rate"),
        respiratory_rate=d.get("respiratory_rate"),
        temperature=d.get("temperature"),
        spo2=d.get("spo2"),
        height_cm=d.get("height_cm"),
        weight_kg=d.get("weight_kg"),
        bmi=d.get("bmi"),
        recorded_at=d["recorded_at"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_laboratory_results(row: sqlite3.Row) -> LaboratoryResults:
    d = dict(row)
    return LaboratoryResults(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        blood_glucose=d.get("blood_glucose"),
        hba1c=d.get("hba1c"),
        hemoglobin=d.get("hemoglobin"),
        wbc=d.get("wbc"),
        platelets=d.get("platelets"),
        creatinine=d.get("creatinine"),
        egfr=d.get("egfr"),
        bun=d.get("bun"),
        sodium=d.get("sodium"),
        potassium=d.get("potassium"),
        calcium=d.get("calcium"),
        ast=d.get("ast"),
        alt=d.get("alt"),
        bilirubin=d.get("bilirubin"),
        albumin=d.get("albumin"),
        inr=d.get("inr"),
        test_date=d["test_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_cardiac_assessment(row: sqlite3.Row) -> CardiacAssessment:
    d = dict(row)
    return CardiacAssessment(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        ecg_status=d.get("ecg_status"),
        ecg_findings=d.get("ecg_findings"),
        heart_rate=d.get("heart_rate"),
        pr_interval=d.get("pr_interval"),
        qrs_duration=d.get("qrs_duration"),
        qt_interval=d.get("qt_interval"),
        qtc=d.get("qtc"),
        echocardiogram_available=d.get("echocardiogram_available", 0),
        ejection_fraction=d.get("ejection_fraction"),
        assessment_date=d["assessment_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_medical_history(row: sqlite3.Row) -> MedicalHistory:
    d = dict(row)
    return MedicalHistory(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        diabetes=d.get("diabetes", 0),
        hypertension=d.get("hypertension", 0),
        heart_disease=d.get("heart_disease", 0),
        kidney_disease=d.get("kidney_disease", 0),
        liver_disease=d.get("liver_disease", 0),
        lung_disease=d.get("lung_disease", 0),
        cancer_history=d.get("cancer_history", 0),
        infectious_disease_status=d.get("infectious_disease_status"),
        smoking_status=d.get("smoking_status"),
        medication_history=d.get("medication_history"),
        previous_surgery=d.get("previous_surgery"),
        notes=d.get("notes"),
        assessment_date=d["assessment_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_hla_profile(row: sqlite3.Row) -> HLAProfile:
    d = dict(row)
    return HLAProfile(
        id=d["id"],
        entity_type=d["entity_type"],
        entity_id=d["entity_id"],
        hla_a=d.get("hla_a"),
        hla_b=d.get("hla_b"),
        hla_c=d.get("hla_c"),
        hla_dr=d.get("hla_dr"),
        hla_dq=d.get("hla_dq"),
        antibody_information=d.get("antibody_information"),
        test_date=d["test_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _row_to_crossmatch_result(row: sqlite3.Row) -> CrossmatchResult:
    d = dict(row)
    return CrossmatchResult(
        id=d["id"],
        donor_id=d["donor_id"],
        recipient_id=d["recipient_id"],
        result=d.get("result"),
        antibody_information=d.get("antibody_information"),
        test_date=d["test_date"],
        notes=d.get("notes"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        donor_name=d.get("donor_name"),
        recipient_name=d.get("recipient_name"),
    )


def _row_to_organ_assessment(row: sqlite3.Row) -> OrganAssessment:
    d = dict(row)
    return OrganAssessment(
        id=d["id"],
        donor_id=d["donor_id"],
        organ=d["organ"],
        assessment_status=d["assessment_status"],
        assessment_notes=d.get("assessment_notes"),
        assessment_date=d["assessment_date"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        donor_name=d.get("donor_name"),
    )


# ============================================================================
# Phase 2: Medical Intelligence Repositories
# ============================================================================


class MedicalProfileRepository:
    """Repository handling persistence for MedicalProfile overview metadata."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, profile: MedicalProfile) -> MedicalProfile:
        query = """
        INSERT INTO medical_profiles (entity_type, entity_id, assessment_date, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (
            profile.entity_type.upper(),
            profile.entity_id,
            profile.assessment_date,
            profile.notes,
            profile.created_at,
            profile.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            profile.id = cursor.lastrowid
        return profile

    def get_by_id(self, profile_id: int) -> MedicalProfile | None:
        query = "SELECT * FROM medical_profiles WHERE id = ?"
        row = self.db.fetch_one(query, (profile_id,))
        return _row_to_medical_profile(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> MedicalProfile | None:
        """Fetch latest medical profile record for a given entity."""
        query = """
        SELECT * FROM medical_profiles
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_medical_profile(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[MedicalProfile]:
        """Fetch chronological assessment records."""
        query = """
        SELECT * FROM medical_profiles
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_medical_profile(r) for r in rows]

    def update(self, profile: MedicalProfile) -> bool:
        query = """
        UPDATE medical_profiles SET
            assessment_date = ?, notes = ?, updated_at = ?
        WHERE id = ?
        """
        params = (profile.assessment_date, profile.notes, profile.updated_at, profile.id)
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, profile_id: int) -> bool:
        query = "DELETE FROM medical_profiles WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (profile_id,))
            conn.commit()
            return cursor.rowcount > 0


class VitalSignsRepository:
    """Repository handling persistence and historical tracking for VitalSigns."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, vitals: VitalSigns) -> VitalSigns:
        query = """
        INSERT INTO vital_signs (
            entity_type, entity_id, systolic_bp, diastolic_bp, heart_rate,
            respiratory_rate, temperature, spo2, height_cm, weight_kg,
            bmi, recorded_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            vitals.entity_type.upper(),
            vitals.entity_id,
            vitals.systolic_bp,
            vitals.diastolic_bp,
            vitals.heart_rate,
            vitals.respiratory_rate,
            vitals.temperature,
            vitals.spo2,
            vitals.height_cm,
            vitals.weight_kg,
            vitals.bmi,
            vitals.recorded_at,
            vitals.created_at,
            vitals.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            vitals.id = cursor.lastrowid
        return vitals

    def get_by_id(self, vitals_id: int) -> VitalSigns | None:
        query = "SELECT * FROM vital_signs WHERE id = ?"
        row = self.db.fetch_one(query, (vitals_id,))
        return _row_to_vital_signs(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> VitalSigns | None:
        """Fetch latest vital signs for an entity."""
        query = """
        SELECT * FROM vital_signs
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY recorded_at DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_vital_signs(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[VitalSigns]:
        """Fetch historical vital signs in chronological order."""
        query = """
        SELECT * FROM vital_signs
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY recorded_at DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_vital_signs(r) for r in rows]

    def update(self, vitals: VitalSigns) -> bool:
        query = """
        UPDATE vital_signs SET
            systolic_bp = ?, diastolic_bp = ?, heart_rate = ?, respiratory_rate = ?,
            temperature = ?, spo2 = ?, height_cm = ?, weight_kg = ?, bmi = ?,
            recorded_at = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            vitals.systolic_bp,
            vitals.diastolic_bp,
            vitals.heart_rate,
            vitals.respiratory_rate,
            vitals.temperature,
            vitals.spo2,
            vitals.height_cm,
            vitals.weight_kg,
            vitals.bmi,
            vitals.recorded_at,
            vitals.updated_at,
            vitals.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, vitals_id: int) -> bool:
        query = "DELETE FROM vital_signs WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (vitals_id,))
            conn.commit()
            return cursor.rowcount > 0


class LaboratoryRepository:
    """Repository handling persistence and historical biomarker tracking."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, labs: LaboratoryResults) -> LaboratoryResults:
        query = """
        INSERT INTO laboratory_results (
            entity_type, entity_id, blood_glucose, hba1c, hemoglobin,
            wbc, platelets, creatinine, egfr, bun,
            sodium, potassium, calcium, ast, alt,
            bilirubin, albumin, inr, test_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            labs.entity_type.upper(),
            labs.entity_id,
            labs.blood_glucose,
            labs.hba1c,
            labs.hemoglobin,
            labs.wbc,
            labs.platelets,
            labs.creatinine,
            labs.egfr,
            labs.bun,
            labs.sodium,
            labs.potassium,
            labs.calcium,
            labs.ast,
            labs.alt,
            labs.bilirubin,
            labs.albumin,
            labs.inr,
            labs.test_date,
            labs.created_at,
            labs.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            labs.id = cursor.lastrowid
        return labs

    def get_by_id(self, lab_id: int) -> LaboratoryResults | None:
        query = "SELECT * FROM laboratory_results WHERE id = ?"
        row = self.db.fetch_one(query, (lab_id,))
        return _row_to_laboratory_results(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> LaboratoryResults | None:
        """Fetch latest lab results for an entity."""
        query = """
        SELECT * FROM laboratory_results
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY test_date DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_laboratory_results(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[LaboratoryResults]:
        """Fetch chronological laboratory history."""
        query = """
        SELECT * FROM laboratory_results
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY test_date DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_laboratory_results(r) for r in rows]

    def update(self, labs: LaboratoryResults) -> bool:
        query = """
        UPDATE laboratory_results SET
            blood_glucose = ?, hba1c = ?, hemoglobin = ?, wbc = ?, platelets = ?,
            creatinine = ?, egfr = ?, bun = ?, sodium = ?, potassium = ?, calcium = ?,
            ast = ?, alt = ?, bilirubin = ?, albumin = ?, inr = ?, test_date = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            labs.blood_glucose,
            labs.hba1c,
            labs.hemoglobin,
            labs.wbc,
            labs.platelets,
            labs.creatinine,
            labs.egfr,
            labs.bun,
            labs.sodium,
            labs.potassium,
            labs.calcium,
            labs.ast,
            labs.alt,
            labs.bilirubin,
            labs.albumin,
            labs.inr,
            labs.test_date,
            labs.updated_at,
            labs.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, lab_id: int) -> bool:
        query = "DELETE FROM laboratory_results WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (lab_id,))
            conn.commit()
            return cursor.rowcount > 0


class CardiacAssessmentRepository:
    """Repository handling persistence for cardiac assessments and ECGs."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, cardiac: CardiacAssessment) -> CardiacAssessment:
        query = """
        INSERT INTO cardiac_assessments (
            entity_type, entity_id, ecg_status, ecg_findings, heart_rate,
            pr_interval, qrs_duration, qt_interval, qtc, echocardiogram_available,
            ejection_fraction, assessment_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            cardiac.entity_type.upper(),
            cardiac.entity_id,
            cardiac.ecg_status,
            cardiac.ecg_findings,
            cardiac.heart_rate,
            cardiac.pr_interval,
            cardiac.qrs_duration,
            cardiac.qt_interval,
            cardiac.qtc,
            cardiac.echocardiogram_available,
            cardiac.ejection_fraction,
            cardiac.assessment_date,
            cardiac.created_at,
            cardiac.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            cardiac.id = cursor.lastrowid
        return cardiac

    def get_by_id(self, cardiac_id: int) -> CardiacAssessment | None:
        query = "SELECT * FROM cardiac_assessments WHERE id = ?"
        row = self.db.fetch_one(query, (cardiac_id,))
        return _row_to_cardiac_assessment(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> CardiacAssessment | None:
        """Fetch latest cardiac assessment for an entity."""
        query = """
        SELECT * FROM cardiac_assessments
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_cardiac_assessment(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[CardiacAssessment]:
        query = """
        SELECT * FROM cardiac_assessments
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_cardiac_assessment(r) for r in rows]

    def update(self, cardiac: CardiacAssessment) -> bool:
        query = """
        UPDATE cardiac_assessments SET
            ecg_status = ?, ecg_findings = ?, heart_rate = ?, pr_interval = ?,
            qrs_duration = ?, qt_interval = ?, qtc = ?, echocardiogram_available = ?,
            ejection_fraction = ?, assessment_date = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            cardiac.ecg_status,
            cardiac.ecg_findings,
            cardiac.heart_rate,
            cardiac.pr_interval,
            cardiac.qrs_duration,
            cardiac.qt_interval,
            cardiac.qtc,
            cardiac.echocardiogram_available,
            cardiac.ejection_fraction,
            cardiac.assessment_date,
            cardiac.updated_at,
            cardiac.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, cardiac_id: int) -> bool:
        query = "DELETE FROM cardiac_assessments WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (cardiac_id,))
            conn.commit()
            return cursor.rowcount > 0


class MedicalHistoryRepository:
    """Repository handling persistence for comorbidities and medical background."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, history: MedicalHistory) -> MedicalHistory:
        query = """
        INSERT INTO medical_history (
            entity_type, entity_id, diabetes, hypertension, heart_disease,
            kidney_disease, liver_disease, lung_disease, cancer_history,
            infectious_disease_status, smoking_status, medication_history,
            previous_surgery, notes, assessment_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            history.entity_type.upper(),
            history.entity_id,
            history.diabetes,
            history.hypertension,
            history.heart_disease,
            history.kidney_disease,
            history.liver_disease,
            history.lung_disease,
            history.cancer_history,
            history.infectious_disease_status,
            history.smoking_status,
            history.medication_history,
            history.previous_surgery,
            history.notes,
            history.assessment_date,
            history.created_at,
            history.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            history.id = cursor.lastrowid
        return history

    def get_by_id(self, history_id: int) -> MedicalHistory | None:
        query = "SELECT * FROM medical_history WHERE id = ?"
        row = self.db.fetch_one(query, (history_id,))
        return _row_to_medical_history(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> MedicalHistory | None:
        """Fetch latest medical history record for an entity."""
        query = """
        SELECT * FROM medical_history
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_medical_history(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[MedicalHistory]:
        query = """
        SELECT * FROM medical_history
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY assessment_date DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_medical_history(r) for r in rows]

    def update(self, history: MedicalHistory) -> bool:
        query = """
        UPDATE medical_history SET
            diabetes = ?, hypertension = ?, heart_disease = ?, kidney_disease = ?,
            liver_disease = ?, lung_disease = ?, cancer_history = ?,
            infectious_disease_status = ?, smoking_status = ?, medication_history = ?,
            previous_surgery = ?, notes = ?, assessment_date = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            history.diabetes,
            history.hypertension,
            history.heart_disease,
            history.kidney_disease,
            history.liver_disease,
            history.lung_disease,
            history.cancer_history,
            history.infectious_disease_status,
            history.smoking_status,
            history.medication_history,
            history.previous_surgery,
            history.notes,
            history.assessment_date,
            history.updated_at,
            history.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, history_id: int) -> bool:
        query = "DELETE FROM medical_history WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (history_id,))
            conn.commit()
            return cursor.rowcount > 0


class HLARepository:
    """Repository handling persistence for HLA genotyping and antibody screens."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, hla: HLAProfile) -> HLAProfile:
        query = """
        INSERT INTO hla_profiles (
            entity_type, entity_id, hla_a, hla_b, hla_c,
            hla_dr, hla_dq, antibody_information, test_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            hla.entity_type.upper(),
            hla.entity_id,
            hla.hla_a,
            hla.hla_b,
            hla.hla_c,
            hla.hla_dr,
            hla.hla_dq,
            hla.antibody_information,
            hla.test_date,
            hla.created_at,
            hla.updated_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            hla.id = cursor.lastrowid
        return hla

    def get_by_id(self, hla_id: int) -> HLAProfile | None:
        query = "SELECT * FROM hla_profiles WHERE id = ?"
        row = self.db.fetch_one(query, (hla_id,))
        return _row_to_hla_profile(row) if row else None

    def get_by_entity(self, entity_type: str, entity_id: int) -> HLAProfile | None:
        """Fetch latest HLA profile for an entity."""
        query = """
        SELECT * FROM hla_profiles
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY test_date DESC, id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (entity_type.upper(), entity_id))
        return _row_to_hla_profile(row) if row else None

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[HLAProfile]:
        query = """
        SELECT * FROM hla_profiles
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY test_date DESC, id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (entity_type.upper(), entity_id, limit))
        return [_row_to_hla_profile(r) for r in rows]

    def update(self, hla: HLAProfile) -> bool:
        query = """
        UPDATE hla_profiles SET
            hla_a = ?, hla_b = ?, hla_c = ?, hla_dr = ?, hla_dq = ?,
            antibody_information = ?, test_date = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            hla.hla_a,
            hla.hla_b,
            hla.hla_c,
            hla.hla_dr,
            hla.hla_dq,
            hla.antibody_information,
            hla.test_date,
            hla.updated_at,
            hla.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, hla_id: int) -> bool:
        query = "DELETE FROM hla_profiles WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (hla_id,))
            conn.commit()
            return cursor.rowcount > 0

    def count(self) -> int:
        query = "SELECT COUNT(*) as count FROM hla_profiles"
        row = self.db.fetch_one(query)
        return row["count"] if row else 0


class CrossmatchRepository:
    """Repository handling persistence for crossmatch assessments between donor-recipient pairs."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, crossmatch: CrossmatchResult) -> CrossmatchResult:
        query = """
        INSERT INTO crossmatch_results (
            donor_id, recipient_id, result, antibody_information,
            test_date, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            crossmatch.donor_id,
            crossmatch.recipient_id,
            crossmatch.result,
            crossmatch.antibody_information,
            crossmatch.test_date,
            crossmatch.notes,
            crossmatch.created_at,
            crossmatch.updated_at,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                crossmatch.id = cursor.lastrowid
            return crossmatch
        except sqlite3.IntegrityError as err:
            raise DatabaseError(f"Crossmatch creation failed: {err}") from err

    def get_by_id(self, crossmatch_id: int) -> CrossmatchResult | None:
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        WHERE c.id = ?
        """
        row = self.db.fetch_one(query, (crossmatch_id,))
        return _row_to_crossmatch_result(row) if row else None

    def get_by_donor(self, donor_id: int) -> list[CrossmatchResult]:
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        WHERE c.donor_id = ?
        ORDER BY c.test_date DESC, c.id DESC
        """
        rows = self.db.fetch_all(query, (donor_id,))
        return [_row_to_crossmatch_result(r) for r in rows]

    def get_by_recipient(self, recipient_id: int) -> list[CrossmatchResult]:
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        WHERE c.recipient_id = ?
        ORDER BY c.test_date DESC, c.id DESC
        """
        rows = self.db.fetch_all(query, (recipient_id,))
        return [_row_to_crossmatch_result(r) for r in rows]

    def get_by_pair(self, donor_id: int, recipient_id: int) -> CrossmatchResult | None:
        """Fetch latest crossmatch for a specific donor-recipient pair."""
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        WHERE c.donor_id = ? AND c.recipient_id = ?
        ORDER BY c.test_date DESC, c.id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (donor_id, recipient_id))
        return _row_to_crossmatch_result(row) if row else None

    def get_history(self, donor_id: int, recipient_id: int, limit: int = 50) -> list[CrossmatchResult]:
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        WHERE c.donor_id = ? AND c.recipient_id = ?
        ORDER BY c.test_date DESC, c.id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (donor_id, recipient_id, limit))
        return [_row_to_crossmatch_result(r) for r in rows]

    def get_all(self, limit: int = 100) -> list[CrossmatchResult]:
        query = """
        SELECT c.*, d.name as donor_name, r.name as recipient_name
        FROM crossmatch_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        ORDER BY c.test_date DESC, c.id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (limit,))
        return [_row_to_crossmatch_result(r) for r in rows]

    def update(self, crossmatch: CrossmatchResult) -> bool:
        query = """
        UPDATE crossmatch_results SET
            result = ?, antibody_information = ?, test_date = ?, notes = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            crossmatch.result,
            crossmatch.antibody_information,
            crossmatch.test_date,
            crossmatch.notes,
            crossmatch.updated_at,
            crossmatch.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, crossmatch_id: int) -> bool:
        query = "DELETE FROM crossmatch_results WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (crossmatch_id,))
            conn.commit()
            return cursor.rowcount > 0

    def count(self) -> int:
        query = "SELECT COUNT(*) as count FROM crossmatch_results"
        row = self.db.fetch_one(query)
        return row["count"] if row else 0


class OrganAssessmentRepository:
    """Repository handling persistence for donor organ-specific clinical assessments."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def create(self, assessment: OrganAssessment) -> OrganAssessment:
        query = """
        INSERT INTO organ_assessments (
            donor_id, organ, assessment_status, assessment_notes,
            assessment_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            assessment.donor_id,
            assessment.organ,
            assessment.assessment_status,
            assessment.assessment_notes,
            assessment.assessment_date,
            assessment.created_at,
            assessment.updated_at,
        )
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                assessment.id = cursor.lastrowid
            return assessment
        except sqlite3.IntegrityError as err:
            raise DatabaseError(f"Organ assessment creation failed: {err}") from err

    def get_by_id(self, assessment_id: int) -> OrganAssessment | None:
        query = """
        SELECT o.*, d.name as donor_name
        FROM organ_assessments o
        LEFT JOIN donors d ON o.donor_id = d.id
        WHERE o.id = ?
        """
        row = self.db.fetch_one(query, (assessment_id,))
        return _row_to_organ_assessment(row) if row else None

    def get_by_donor(self, donor_id: int) -> list[OrganAssessment]:
        query = """
        SELECT o.*, d.name as donor_name
        FROM organ_assessments o
        LEFT JOIN donors d ON o.donor_id = d.id
        WHERE o.donor_id = ?
        ORDER BY o.assessment_date DESC, o.id DESC
        """
        rows = self.db.fetch_all(query, (donor_id,))
        return [_row_to_organ_assessment(r) for r in rows]

    def get_by_entity(self, entity_type: str, entity_id: int) -> list[OrganAssessment]:
        """Support generic entity querying; organ assessment applies to donors."""
        if entity_type.upper() == "DONOR":
            return self.get_by_donor(entity_id)
        return []

    def get_latest_by_organ(self, donor_id: int, organ: str) -> OrganAssessment | None:
        """Fetch latest assessment for a specific donor and organ."""
        query = """
        SELECT o.*, d.name as donor_name
        FROM organ_assessments o
        LEFT JOIN donors d ON o.donor_id = d.id
        WHERE o.donor_id = ? AND LOWER(o.organ) = LOWER(?)
        ORDER BY o.assessment_date DESC, o.id DESC LIMIT 1
        """
        row = self.db.fetch_one(query, (donor_id, organ.strip()))
        return _row_to_organ_assessment(row) if row else None

    def get_history(self, donor_id: int, organ: str | None = None, limit: int = 50) -> list[OrganAssessment]:
        if organ:
            query = """
            SELECT o.*, d.name as donor_name
            FROM organ_assessments o
            LEFT JOIN donors d ON o.donor_id = d.id
            WHERE o.donor_id = ? AND LOWER(o.organ) = LOWER(?)
            ORDER BY o.assessment_date DESC, o.id DESC LIMIT ?
            """
            rows = self.db.fetch_all(query, (donor_id, organ.strip(), limit))
        else:
            query = """
            SELECT o.*, d.name as donor_name
            FROM organ_assessments o
            LEFT JOIN donors d ON o.donor_id = d.id
            WHERE o.donor_id = ?
            ORDER BY o.assessment_date DESC, o.id DESC LIMIT ?
            """
            rows = self.db.fetch_all(query, (donor_id, limit))
        return [_row_to_organ_assessment(r) for r in rows]

    def get_all(self, limit: int = 100) -> list[OrganAssessment]:
        query = """
        SELECT o.*, d.name as donor_name
        FROM organ_assessments o
        LEFT JOIN donors d ON o.donor_id = d.id
        ORDER BY o.assessment_date DESC, o.id DESC LIMIT ?
        """
        rows = self.db.fetch_all(query, (limit,))
        return [_row_to_organ_assessment(r) for r in rows]

    def update(self, assessment: OrganAssessment) -> bool:
        query = """
        UPDATE organ_assessments SET
            organ = ?, assessment_status = ?, assessment_notes = ?,
            assessment_date = ?, updated_at = ?
        WHERE id = ?
        """
        params = (
            assessment.organ,
            assessment.assessment_status,
            assessment.assessment_notes,
            assessment.assessment_date,
            assessment.updated_at,
            assessment.id,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete(self, assessment_id: int) -> bool:
        query = "DELETE FROM organ_assessments WHERE id = ?"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (assessment_id,))
            conn.commit()
            return cursor.rowcount > 0

    def count(self) -> int:
        query = "SELECT COUNT(*) as count FROM organ_assessments"
        row = self.db.fetch_one(query)
        return row["count"] if row else 0


def _row_to_compatibility_result(row: sqlite3.Row) -> CompatibilityResult:
    """Convert SQLite Row with optional join columns to CompatibilityResult model."""
    d = dict(row)

    def _load_json_list(val: Any) -> list[str]:
        if not val:
            return []
        if isinstance(val, list):
            return val
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else [str(parsed)]
        except Exception:
            return [str(val)]

    return CompatibilityResult(
        id=d.get("id"),
        donor_id=d["donor_id"],
        recipient_id=d["recipient_id"],
        status=d["status"],
        score=float(d["score"]) if d.get("score") is not None else 0.0,
        blood_score=float(d["blood_score"]) if d.get("blood_score") is not None else 0.0,
        organ_score=float(d["organ_score"]) if d.get("organ_score") is not None else 0.0,
        clinical_score=float(d["clinical_score"]) if d.get("clinical_score") is not None else 0.0,
        urgency_score=float(d["urgency_score"]) if d.get("urgency_score") is not None else 0.0,
        waiting_time_score=float(d["waiting_time_score"]) if d.get("waiting_time_score") is not None else 0.0,
        hla_score=float(d["hla_score"]) if d.get("hla_score") is not None else 0.0,
        geographic_score=float(d["geographic_score"]) if d.get("geographic_score") is not None else 0.0,
        data_quality_score=float(d["data_quality_score"]) if d.get("data_quality_score") is not None else 0.0,
        hard_failures=_load_json_list(d.get("hard_failures")),
        warnings=_load_json_list(d.get("warnings")),
        explanations=_load_json_list(d.get("explanations")),
        rule_version=d.get("rule_version", "3.0.0"),
        source_updated_at=d.get("source_updated_at"),
        evaluated_at=d["evaluated_at"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        donor_name=d.get("donor_name"),
        recipient_name=d.get("recipient_name"),
        organ=d.get("organ") or d.get("donor_organ"),
        donor_blood_group=d.get("donor_blood_group"),
        recipient_blood_group=d.get("recipient_blood_group"),
        donor_hospital=d.get("donor_hospital"),
        recipient_hospital=d.get("recipient_hospital"),
        urgency=d.get("urgency"),
        waiting_time_days=d.get("waiting_time_days"),
    )


class CompatibilityRepository:
    """Repository for managing evaluated compatibility results in SQLite."""

    BASE_SELECT = """
        SELECT c.*,
               d.name as donor_name, d.blood_group as donor_blood_group, d.organ as donor_organ,
               r.name as recipient_name, r.blood_group as recipient_blood_group, r.organ_needed as organ,
               r.urgency as urgency, r.waiting_time_days as waiting_time_days,
               hd.name as donor_hospital, hr.name as recipient_hospital
        FROM compatibility_results c
        LEFT JOIN donors d ON c.donor_id = d.id
        LEFT JOIN recipients r ON c.recipient_id = r.id
        LEFT JOIN hospitals hd ON d.hospital_id = hd.id
        LEFT JOIN hospitals hr ON r.hospital_id = hr.id
    """

    def __init__(self, db: DatabaseManager):
        self.db = db

    def save_result(self, result: CompatibilityResult) -> int:
        """Upsert a compatibility evaluation result for a donor-recipient pair."""
        query_check = "SELECT id FROM compatibility_results WHERE donor_id = ? AND recipient_id = ?"
        existing = self.db.fetch_one(query_check, (result.donor_id, result.recipient_id))

        hard_fail_json = json.dumps(result.hard_failures)
        warnings_json = json.dumps(result.warnings)
        explanations_json = json.dumps(result.explanations)

        if existing:
            query = """
            UPDATE compatibility_results SET
                status = ?, score = ?, blood_score = ?, organ_score = ?, clinical_score = ?,
                urgency_score = ?, waiting_time_score = ?, hla_score = ?, geographic_score = ?,
                data_quality_score = ?, hard_failures = ?, warnings = ?, explanations = ?,
                rule_version = ?, source_updated_at = ?, evaluated_at = ?, updated_at = ?
            WHERE id = ?
            """
            params = (
                result.status,
                result.score,
                result.blood_score,
                result.organ_score,
                result.clinical_score,
                result.urgency_score,
                result.waiting_time_score,
                result.hla_score,
                result.geographic_score,
                result.data_quality_score,
                hard_fail_json,
                warnings_json,
                explanations_json,
                result.rule_version,
                result.source_updated_at,
                result.evaluated_at,
                result.updated_at,
                existing["id"],
            )
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return int(existing["id"])
        else:
            query = """
            INSERT INTO compatibility_results (
                donor_id, recipient_id, status, score, blood_score, organ_score, clinical_score,
                urgency_score, waiting_time_score, hla_score, geographic_score, data_quality_score,
                hard_failures, warnings, explanations, rule_version, source_updated_at,
                evaluated_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = (
                result.donor_id,
                result.recipient_id,
                result.status,
                result.score,
                result.blood_score,
                result.organ_score,
                result.clinical_score,
                result.urgency_score,
                result.waiting_time_score,
                result.hla_score,
                result.geographic_score,
                result.data_quality_score,
                hard_fail_json,
                warnings_json,
                explanations_json,
                result.rule_version,
                result.source_updated_at,
                result.evaluated_at,
                result.created_at,
                result.updated_at,
            )
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return int(cursor.lastrowid)

    def get_result(self, result_id: int) -> CompatibilityResult | None:
        """Fetch a specific compatibility result by ID."""
        query = f"{self.BASE_SELECT} WHERE c.id = ?"
        row = self.db.fetch_one(query, (result_id,))
        return _row_to_compatibility_result(row) if row else None

    def get_by_pair(self, donor_id: int, recipient_id: int) -> CompatibilityResult | None:
        """Fetch result for a specific donor and recipient pair."""
        query = f"{self.BASE_SELECT} WHERE c.donor_id = ? AND c.recipient_id = ?"
        row = self.db.fetch_one(query, (donor_id, recipient_id))
        return _row_to_compatibility_result(row) if row else None

    def get_by_donor(self, donor_id: int, min_score: float = 0.0) -> list[CompatibilityResult]:
        """Fetch evaluated pairs for a specific donor."""
        query = f"{self.BASE_SELECT} WHERE c.donor_id = ? AND c.score >= ? ORDER BY c.score DESC"
        rows = self.db.fetch_all(query, (donor_id, min_score))
        return [_row_to_compatibility_result(r) for r in rows]

    def get_by_recipient(self, recipient_id: int, min_score: float = 0.0) -> list[CompatibilityResult]:
        """Fetch evaluated pairs for a specific recipient."""
        query = f"{self.BASE_SELECT} WHERE c.recipient_id = ? AND c.score >= ? ORDER BY c.score DESC"
        rows = self.db.fetch_all(query, (recipient_id, min_score))
        return [_row_to_compatibility_result(r) for r in rows]

    def get_candidates(
        self,
        status: str | None = None,
        min_score: float = 0.0,
        organ: str | None = None,
        limit: int = 200,
    ) -> list[CompatibilityResult]:
        """Fetch compatible or candidate pairs with optional filtering."""
        conditions = ["c.score >= ?"]
        params: list[Any] = [min_score]

        if status:
            conditions.append("c.status = ?")
            params.append(status)

        if organ:
            conditions.append("(r.organ_needed = ? OR d.organ = ?)")
            params.extend([organ, organ])

        where_clause = " WHERE " + " AND ".join(conditions)
        query = f"{self.BASE_SELECT} {where_clause} ORDER BY c.score DESC LIMIT ?"
        params.append(limit)

        rows = self.db.fetch_all(query, tuple(params))
        return [_row_to_compatibility_result(r) for r in rows]

    def get_highest_ranked(self, limit: int = 10) -> list[CompatibilityResult]:
        """Retrieve the top software-ranked candidate pairs."""
        query = f"""
            {self.BASE_SELECT}
            WHERE c.status IN ('POTENTIAL_CANDIDATE', 'REQUIRES_REVIEW')
            ORDER BY c.score DESC
            LIMIT ?
        """
        rows = self.db.fetch_all(query, (limit,))
        return [_row_to_compatibility_result(r) for r in rows]

    def get_by_status(self, status: str, limit: int = 100) -> list[CompatibilityResult]:
        """Retrieve results filtered by matching status."""
        query = f"{self.BASE_SELECT} WHERE c.status = ? ORDER BY c.score DESC LIMIT ?"
        rows = self.db.fetch_all(query, (status, limit))
        return [_row_to_compatibility_result(r) for r in rows]

    def delete_by_entity(self, entity_type: str, entity_id: int) -> int:
        """Invalidate results involving an updated or deleted donor or recipient."""
        clean = entity_type.strip().upper()
        if clean == "DONOR":
            query = "DELETE FROM compatibility_results WHERE donor_id = ?"
        elif clean == "RECIPIENT":
            query = "DELETE FROM compatibility_results WHERE recipient_id = ?"
        else:
            return 0

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (entity_id,))
            conn.commit()
            return cursor.rowcount

    def delete_all(self) -> int:
        """Clear all stored compatibility evaluations."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM compatibility_results")
            conn.commit()
            return cursor.rowcount

    def count(self, status: str | None = None) -> int:
        """Count total evaluated compatibility records, optionally by status."""
        if status:
            query = "SELECT COUNT(*) as count FROM compatibility_results WHERE status = ?"
            row = self.db.fetch_one(query, (status,))
        else:
            query = "SELECT COUNT(*) as count FROM compatibility_results"
            row = self.db.fetch_one(query)
        return row["count"] if row else 0

    def get_status_counts(self) -> dict[str, int]:
        """Return counts grouped by status."""
        query = "SELECT status, COUNT(*) as count FROM compatibility_results GROUP BY status"
        rows = self.db.fetch_all(query)
        return {r["status"]: r["count"] for r in rows}


def _row_to_matching_run(row: sqlite3.Row) -> MatchingRun:
    """Convert SQLite Row to MatchingRun model."""
    d = dict(row)
    return MatchingRun(
        id=d["id"],
        algorithm=d["algorithm"],
        graph_nodes=d["graph_nodes"],
        graph_edges=d["graph_edges"],
        matched_pairs=d["matched_pairs"],
        total_score=d.get("total_score"),
        average_score=d.get("average_score"),
        execution_time_ms=d.get("execution_time_ms"),
        rule_version=d.get("rule_version"),
        created_at=d["created_at"],
    )


class MatchingRunRepository:
    """Repository managing persistence for bipartite graph matching run records."""

    def __init__(self, db: DatabaseManager):
        self.db = db

    def save_run(self, run: MatchingRun) -> int:
        """Persist a new matching run record."""
        query = """
            INSERT INTO matching_runs (
                algorithm, graph_nodes, graph_edges, matched_pairs,
                total_score, average_score, execution_time_ms, rule_version, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            run.algorithm,
            run.graph_nodes,
            run.graph_edges,
            run.matched_pairs,
            run.total_score,
            run.average_score,
            run.execution_time_ms,
            run.rule_version,
            run.created_at,
        )
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.lastrowid

    def get_run(self, run_id: int) -> MatchingRun | None:
        """Retrieve a specific matching run by primary ID."""
        query = "SELECT * FROM matching_runs WHERE id = ?"
        row = self.db.fetch_one(query, (run_id,))
        return _row_to_matching_run(row) if row else None

    def get_by_id(self, run_id: int) -> MatchingRun | None:
        """Alias for get_run."""
        return self.get_run(run_id)

    def get_recent_runs(self, limit: int = 50) -> list[MatchingRun]:
        """Fetch historical matching runs ordered chronologically descending."""
        query = "SELECT * FROM matching_runs ORDER BY id DESC LIMIT ?"
        rows = self.db.fetch_all(query, (limit,))
        return [_row_to_matching_run(r) for r in rows]

    def get_runs_by_algorithm(self, algorithm: str, limit: int = 50) -> list[MatchingRun]:
        """Fetch historical matching runs for a specific algorithm."""
        query = "SELECT * FROM matching_runs WHERE algorithm = ? ORDER BY id DESC LIMIT ?"
        rows = self.db.fetch_all(query, (algorithm, limit))
        return [_row_to_matching_run(r) for r in rows]

    def count(self) -> int:
        """Count total matching runs recorded."""
        query = "SELECT COUNT(*) as count FROM matching_runs"
        row = self.db.fetch_one(query)
        return row["count"] if row else 0

    def delete_all(self) -> int:
        """Clear all historical matching runs."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM matching_runs")
            conn.commit()
            return cursor.rowcount



