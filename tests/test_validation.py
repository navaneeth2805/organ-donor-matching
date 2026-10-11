"""Automated unit tests for validation utilities and clinical business rules."""

import pytest
from utils.exceptions import ValidationError
from utils.validators import (
    validate_age,
    validate_availability,
    validate_blood_group,
    validate_email,
    validate_name,
    validate_organ,
    validate_phone,
    validate_urgency,
    validate_waiting_time,
)


def test_validate_name():
    """Test valid and invalid names."""
    assert validate_name("  John Doe  ") == "John Doe"
    with pytest.raises(ValidationError):
        validate_name("")
    with pytest.raises(ValidationError):
        validate_name("   ")
    with pytest.raises(ValidationError):
        validate_name("J")
    with pytest.raises(ValidationError):
        validate_name("A" * 105)


def test_validate_age():
    """Test age boundaries and invalid types."""
    assert validate_age(0) == 0
    assert validate_age(45) == 45
    assert validate_age(120) == 120
    assert validate_age("35") == 35

    with pytest.raises(ValidationError):
        validate_age(-1)
    with pytest.raises(ValidationError):
        validate_age(125)
    with pytest.raises(ValidationError):
        validate_age("not-a-number")
    with pytest.raises(ValidationError):
        validate_age(None)


def test_validate_blood_group():
    """Test blood group validation."""
    assert validate_blood_group("o+") == "O+"
    assert validate_blood_group("AB-") == "AB-"

    with pytest.raises(ValidationError):
        validate_blood_group("C+")
    with pytest.raises(ValidationError):
        validate_blood_group("invalid")
    with pytest.raises(ValidationError):
        validate_blood_group("")


def test_validate_organ():
    """Test organ compatibility validation."""
    assert validate_organ("kidney") == "Kidney"
    assert validate_organ("HEART") == "Heart"
    assert validate_organ("bone marrow") == "Bone Marrow"

    with pytest.raises(ValidationError):
        validate_organ("Brain")
    with pytest.raises(ValidationError):
        validate_organ("")


def test_validate_availability():
    """Test donor availability validation."""
    assert validate_availability("available") == "Available"
    assert validate_availability("Pending") == "Pending"
    assert validate_availability("Unavailable") == "Unavailable"

    with pytest.raises(ValidationError):
        validate_availability("Inactive")
    with pytest.raises(ValidationError):
        validate_availability("")


def test_validate_urgency():
    """Test recipient clinical urgency classification."""
    assert validate_urgency("critical") == "Critical"
    assert validate_urgency("high") == "High"
    assert validate_urgency("medium") == "Medium"
    assert validate_urgency("low") == "Low"

    with pytest.raises(ValidationError):
        validate_urgency("Emergency")
    with pytest.raises(ValidationError):
        validate_urgency("")


def test_validate_waiting_time():
    """Test recipient waiting time in days."""
    assert validate_waiting_time(0) == 0
    assert validate_waiting_time(365) == 365
    assert validate_waiting_time("120") == 120
    assert validate_waiting_time(None) == 0

    with pytest.raises(ValidationError):
        validate_waiting_time(-5)
    with pytest.raises(ValidationError):
        validate_waiting_time("abc")


def test_validate_email():
    """Test optional email formatting."""
    assert validate_email(None) is None
    assert validate_email("") is None
    assert validate_email("user@example.com") == "user@example.com"
    assert validate_email("Doctor.Transplant@Clinic.org") == "doctor.transplant@clinic.org"

    with pytest.raises(ValidationError):
        validate_email("invalid-email-address")
    with pytest.raises(ValidationError):
        validate_email("missing@domain")


def test_validate_phone():
    """Test optional phone number formats."""
    assert validate_phone(None) is None
    assert validate_phone("") is None
    assert validate_phone("+91 9876543210") == "+91 9876543210"
    assert validate_phone("(022) 2658-8500") == "(022) 2658-8500"

    with pytest.raises(ValidationError):
        validate_phone("123")  # too short
    with pytest.raises(ValidationError):
        validate_phone("letters-in-phone-number")
