"""Application configuration and centralized constants."""

import os
from pathlib import Path

# Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Application Metadata
APP_NAME = "Organ Donor Matching Network"
APP_SUBTITLE = "Healthcare Decision-Support & Graph Algorithm Platform"
VERSION = "2.0.0 (Phase 2 - Medical Intelligence)"

# Database Configuration
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = str(DATA_DIR / "organ_matching.db")

# Supported Blood Groups
BLOOD_GROUPS = [
    "O-",
    "O+",
    "A-",
    "A+",
    "B-",
    "B+",
    "AB-",
    "AB+",
]

# Supported Organs
ORGANS = [
    "Kidney",
    "Heart",
    "Liver",
    "Lung",
    "Pancreas",
    "Cornea",
    "Bone Marrow",
]

# Donor Availability Statuses
AVAILABILITY_STATUSES = [
    "Available",
    "Pending",
    "Unavailable",
]

# Recipient Urgency Levels
URGENCY_LEVELS = [
    "Low",
    "Medium",
    "High",
    "Critical",
]

# Hospital Categories / Classifications
HOSPITAL_CATEGORIES = [
    "General Hospital",
    "Transplant Center",
    "Specialized Surgical Center",
    "University Medical Center",
    "Government / District Hospital",
    "Private Super-Specialty",
]

# Age Limits
MIN_AGE = 0
MAX_AGE = 120

# Medical Intelligence & Health Profile Categories (Phase 2)
CROSSMATCH_STATUSES = [
    "Not Tested",
    "Pending",
    "Positive",
    "Negative",
    "Inconclusive",
    "Requires Review",
]

ORGAN_ASSESSMENT_STATUSES = [
    "Not Assessed",
    "Assessment Pending",
    "Assessment Complete",
    "Requires Review",
]

ECG_STATUSES = [
    "Normal",
    "Borderline",
    "Abnormal",
    "Pending Review",
    "Not Assessed",
]

SMOKING_STATUSES = [
    "Never Smoked",
    "Former Smoker",
    "Active Smoker",
    "Unknown",
]

INFECTIOUS_DISEASE_STATUSES = [
    "Negative / Non-Reactive",
    "Hepatitis B Positive",
    "Hepatitis C Positive",
    "HIV Positive",
    "CMV Positive",
    "Multiple Pathogens Detected",
    "Screening Pending",
    "Unknown",
]

GLUCOSE_CONTEXTS = [
    "Fasting",
    "Random",
    "Post-meal",
    "Unknown",
]

# Freshness Thresholds (Days) - Application configuration, not clinical standards
FRESHNESS_THRESHOLDS_DAYS = {
    "CURRENT_MAX_DAYS": 30,
    "RECENT_MAX_DAYS": 90,
}

# Medical Standard Units
MEDICAL_UNITS = {
    "systolic_bp": "mmHg",
    "diastolic_bp": "mmHg",
    "heart_rate": "bpm",
    "respiratory_rate": "breaths/min",
    "temperature": "°C",
    "spo2": "%",
    "height_cm": "cm",
    "weight_kg": "kg",
    "bmi": "kg/m²",
    "blood_glucose": "mg/dL",
    "hba1c": "%",
    "hemoglobin": "g/dL",
    "wbc": "x10³/µL",
    "platelets": "x10³/µL",
    "creatinine": "mg/dL",
    "egfr": "mL/min/1.73m²",
    "bun": "mg/dL",
    "sodium": "mEq/L",
    "potassium": "mEq/L",
    "calcium": "mg/dL",
    "ast": "U/L",
    "alt": "U/L",
    "bilirubin": "mg/dL",
    "albumin": "g/dL",
    "inr": "ratio",
    "pr_interval": "ms",
    "qrs_duration": "ms",
    "qt_interval": "ms",
    "qtc": "ms",
    "ejection_fraction": "%",
}

# Pagination & Display Defaults
DEFAULT_PAGE_SIZE = 10
PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

# Logging Configuration
LOG_FILE = str(BASE_DIR / "organ_matching.log")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
