"""Automated tests for SQLite database manager, migrations, and transactions."""

import os
import tempfile
import pytest
from database.database import DatabaseManager
from database.models import Hospital
from utils.exceptions import DatabaseError


@pytest.fixture
def temp_db():
    """Create a temporary isolated SQLite database file."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()
    yield db
    if os.path.exists(path):
        os.remove(path)


def test_database_initialization(temp_db):
    """Test that all tables and indexes are created successfully."""
    with temp_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row["name"] for row in cursor.fetchall()]
        assert "donors" in tables
        assert "recipients" in tables
        assert "hospitals" in tables
        assert "audit_logs" in tables

        cursor.execute("SELECT name FROM sqlite_master WHERE type='index';")
        indexes = [row["name"] for row in cursor.fetchall()]
        assert "idx_donor_blood_group" in indexes
        assert "idx_recipient_organ" in indexes


def test_transaction_commit(temp_db):
    """Test that successful transactions commit changes."""
    with temp_db.transaction() as conn:
        conn.execute(
            "INSERT INTO hospitals (name, city, state, country, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("City Care", "Mumbai", "Maharashtra", "India", 1, "2026-09-01", "2026-09-01"),
        )
    row = temp_db.fetch_one("SELECT * FROM hospitals WHERE name = ?", ("City Care",))
    assert row is not None
    assert row["city"] == "Mumbai"


def test_transaction_rollback(temp_db):
    """Test that exceptions inside transactions trigger rollbacks."""
    with pytest.raises(ValueError):
        with temp_db.transaction() as conn:
            conn.execute(
                "INSERT INTO hospitals (name, city, state, country, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("Rollback Hospital", "Pune", "Maharashtra", "India", 1, "2026-09-01", "2026-09-01"),
            )
            raise ValueError("Forced error for rollback testing")

    row = temp_db.fetch_one("SELECT * FROM hospitals WHERE name = ?", ("Rollback Hospital",))
    assert row is None


def test_foreign_key_enforcement(temp_db):
    """Test that foreign key violation raises DatabaseError."""
    with pytest.raises(DatabaseError):
        # Insert donor with non-existent hospital_id=9999
        temp_db.execute(
            """
            INSERT INTO donors (
                id, name, age, blood_group, organ, hospital_id,
                location, availability, registration_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (999, "Invalid Donor", 30, "O+", "Kidney", 9999, "City", "Available", "2026-09-01", "2026-09-01", "2026-09-01"),
        )
