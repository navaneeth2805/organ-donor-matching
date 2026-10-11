"""Software configuration and centralized weights for Phase 3 Compatibility & Candidate Ranking."""

from typing import Any
from utils.exceptions import ValidationError

# Engine Rule Version
RULE_VERSION = "3.0.0"

# Safety Disclaimer (Mandatory Display Across Decision Support Interfaces)
SAFETY_DISCLAIMER = (
    "NOTICE: The Organ Matching Compatibility & Candidate Ranking Engine is a software decision-support system. "
    "It does not independently determine clinical eligibility or make autonomous transplant allocation decisions. "
    "All software compatibility evaluations and candidate rankings must be reviewed and validated by qualified "
    "transplant medical professionals under applicable clinical protocols."
)

# Standard Matching Statuses
STATUS_POTENTIAL_CANDIDATE = "POTENTIAL_CANDIDATE"
STATUS_REQUIRES_REVIEW = "REQUIRES_REVIEW"
STATUS_INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
STATUS_INCOMPATIBLE = "INCOMPATIBLE"

COMPATIBILITY_STATUSES = [
    STATUS_POTENTIAL_CANDIDATE,
    STATUS_REQUIRES_REVIEW,
    STATUS_INSUFFICIENT_DATA,
    STATUS_INCOMPATIBLE,
]

# Centralized Blood Group Compatibility Matrix (Donor -> Set of Compatible Recipient Groups)
BLOOD_COMPATIBILITY_MAP: dict[str, set[str]] = {
    "O-": {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"},
    "O+": {"O+", "A+", "B+", "AB+"},
    "A-": {"A-", "A+", "AB-", "AB+"},
    "A+": {"A+", "AB+"},
    "B-": {"B-", "B+", "AB-", "AB+"},
    "B+": {"B+", "AB+"},
    "AB-": {"AB-", "AB+"},
    "AB+": {"AB+"},
}

# Software Urgency Priority Score Mapping (0 - 100 scale)
URGENCY_SCORE_MAP: dict[str, float] = {
    "Low": 25.0,
    "Medium": 50.0,
    "High": 75.0,
    "Critical": 100.0,
}

# Default Soft-Ranking Weights (Must Sum Exactly to 100)
DEFAULT_WEIGHTS: dict[str, float] = {
    "blood": 20.0,
    "organ": 20.0,
    "clinical": 15.0,
    "urgency": 15.0,
    "waiting_time": 10.0,
    "hla": 10.0,
    "geographic": 5.0,
    "data_quality": 5.0,
}

# Configurable Weight Presets
WEIGHT_PRESETS: dict[str, dict[str, float]] = {
    "Balanced": {
        "blood": 20.0,
        "organ": 20.0,
        "clinical": 15.0,
        "urgency": 15.0,
        "waiting_time": 10.0,
        "hla": 10.0,
        "geographic": 5.0,
        "data_quality": 5.0,
    },
    "Urgency Focus": {
        "blood": 20.0,
        "organ": 20.0,
        "clinical": 10.0,
        "urgency": 30.0,
        "waiting_time": 10.0,
        "hla": 5.0,
        "geographic": 3.0,
        "data_quality": 2.0,
    },
    "Logistics Focus": {
        "blood": 20.0,
        "organ": 20.0,
        "clinical": 10.0,
        "urgency": 15.0,
        "waiting_time": 10.0,
        "hla": 5.0,
        "geographic": 15.0,
        "data_quality": 5.0,
    },
    "Data Completeness Focus": {
        "blood": 20.0,
        "organ": 20.0,
        "clinical": 20.0,
        "urgency": 10.0,
        "waiting_time": 5.0,
        "hla": 10.0,
        "geographic": 5.0,
        "data_quality": 10.0,
    },
}

REQUIRED_WEIGHT_KEYS = {
    "blood",
    "organ",
    "clinical",
    "urgency",
    "waiting_time",
    "hla",
    "geographic",
    "data_quality",
}


def validate_matching_weights(weights: dict[str, Any]) -> dict[str, float]:
    """Validate that weights dictionary contains all required keys, has non-negative numbers, and sums to 100."""
    if not isinstance(weights, dict):
        raise ValidationError("Weights configuration must be a dictionary.")

    clean_weights: dict[str, float] = {}
    missing_keys = REQUIRED_WEIGHT_KEYS - set(weights.keys())
    if missing_keys:
        raise ValidationError(f"Missing required weight keys: {', '.join(sorted(missing_keys))}.")

    for k in REQUIRED_WEIGHT_KEYS:
        val = weights.get(k)
        try:
            num = float(val)
        except (ValueError, TypeError):
            raise ValidationError(f"Weight for '{k}' must be numeric.")

        if num < 0.0:
            raise ValidationError(f"Weight for '{k}' cannot be negative ({num}).")
        clean_weights[k] = num

    total = sum(clean_weights.values())
    if abs(total - 100.0) > 0.01:
        raise ValidationError(f"Sum of software ranking weights must equal 100.0 (current sum: {total:.2f}).")

    return clean_weights
