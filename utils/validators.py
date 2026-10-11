"""Input validation utilities for domain entities and healthcare parameters."""

import re
from typing import Any
from config.settings import (
    BLOOD_GROUPS,
    ORGANS,
    AVAILABILITY_STATUSES,
    URGENCY_LEVELS,
    MIN_AGE,
    MAX_AGE,
    CROSSMATCH_STATUSES,
    ORGAN_ASSESSMENT_STATUSES,
    ECG_STATUSES,
    SMOKING_STATUSES,
    INFECTIOUS_DISEASE_STATUSES,
)
from datetime import datetime, timedelta
from utils.exceptions import ValidationError

# Regex patterns
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_REGEX = re.compile(r"^[+]?[\d\s\-().]{7,25}$")
HLA_ALLELE_REGEX = re.compile(r"^[A-Za-z0-9*:\-\s,/]+$")



def validate_id(record_id: Any, field_name: str = "ID") -> int:
    """Validate numeric identifier."""
    if record_id is None:
        raise ValidationError(f"{field_name} is required.")
    try:
        val = int(record_id)
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} must be a valid integer.")
    if val <= 0:
        raise ValidationError(f"{field_name} must be greater than zero.")
    return val


def validate_name(name: Any, field_name: str = "Name") -> str:
    """Validate full name string."""
    if not isinstance(name, str) or not name.strip():
        raise ValidationError(f"{field_name} cannot be empty.")
    cleaned = name.strip()
    if len(cleaned) < 2:
        raise ValidationError(f"{field_name} must be at least 2 characters long.")
    if len(cleaned) > 100:
        raise ValidationError(f"{field_name} cannot exceed 100 characters.")
    return cleaned


def validate_age(age: Any) -> int:
    """Validate age within clinical limits."""
    if age is None or age == "":
        raise ValidationError("Age is required.")
    try:
        age_int = int(age)
    except (ValueError, TypeError):
        raise ValidationError(f"Age must be an integer between {MIN_AGE} and {MAX_AGE}.")
    if age_int < MIN_AGE or age_int > MAX_AGE:
        raise ValidationError(f"Age must be between {MIN_AGE} and {MAX_AGE} years.")
    return age_int


def validate_blood_group(blood_group: Any) -> str:
    """Validate blood group against supported ABO/Rh classifications."""
    if not isinstance(blood_group, str) or not blood_group.strip():
        raise ValidationError("Blood group is required.")
    bg = blood_group.strip().upper()
    if bg not in BLOOD_GROUPS:
        raise ValidationError(
            f"Invalid blood group '{blood_group}'. Supported groups: {', '.join(BLOOD_GROUPS)}."
        )
    return bg


def validate_organ(organ: Any) -> str:
    """Validate organ against supported transplant types."""
    if not isinstance(organ, str) or not organ.strip():
        raise ValidationError("Organ is required.")
    cleaned = organ.strip().title()
    # Handle "Bone Marrow" title casing
    matching = [o for o in ORGANS if o.lower() == cleaned.lower()]
    if not matching:
        raise ValidationError(
            f"Invalid organ '{organ}'. Supported organs: {', '.join(ORGANS)}."
        )
    return matching[0]


def validate_availability(status: Any) -> str:
    """Validate donor availability status."""
    if not isinstance(status, str) or not status.strip():
        raise ValidationError("Availability status is required.")
    cleaned = status.strip().capitalize()
    if cleaned not in AVAILABILITY_STATUSES:
        raise ValidationError(
            f"Invalid availability '{status}'. Allowed: {', '.join(AVAILABILITY_STATUSES)}."
        )
    return cleaned


def validate_urgency(urgency: Any) -> str:
    """Validate recipient clinical urgency rating."""
    if not isinstance(urgency, str) or not urgency.strip():
        raise ValidationError("Urgency level is required.")
    cleaned = urgency.strip().capitalize()
    if cleaned not in URGENCY_LEVELS:
        raise ValidationError(
            f"Invalid urgency '{urgency}'. Allowed: {', '.join(URGENCY_LEVELS)}."
        )
    return cleaned


def validate_waiting_time(waiting_time: Any) -> int:
    """Validate recipient waiting time in days."""
    if waiting_time is None or waiting_time == "":
        return 0
    try:
        wt = int(waiting_time)
    except (ValueError, TypeError):
        raise ValidationError("Waiting time must be a non-negative integer.")
    if wt < 0:
        raise ValidationError("Waiting time cannot be negative.")
    return wt


def validate_email(email: Any) -> str | None:
    """Validate optional email address format."""
    if email is None:
        return None
    cleaned = str(email).strip()
    if not cleaned:
        return None
    if not EMAIL_REGEX.match(cleaned):
        raise ValidationError(f"Invalid email address format: '{cleaned}'.")
    return cleaned.lower()


def validate_phone(phone: Any) -> str | None:
    """Validate optional phone number format."""
    if phone is None:
        return None
    cleaned = str(phone).strip()
    if not cleaned:
        return None
    if not PHONE_REGEX.match(cleaned):
        raise ValidationError(f"Invalid phone number format: '{cleaned}'.")
    return cleaned


def validate_location(location: Any, field_name: str = "Location") -> str:
    """Validate city or location string."""
    if not isinstance(location, str) or not location.strip():
        raise ValidationError(f"{field_name} is required.")
    cleaned = location.strip()
    if len(cleaned) < 2:
        raise ValidationError(f"{field_name} must be at least 2 characters long.")
    return cleaned


def validate_hospital_id(hospital_id: Any) -> int | None:
    """Validate optional or mandatory hospital identifier."""
    if hospital_id is None or hospital_id == "":
        return None
    try:
        hid = int(hospital_id)
    except (ValueError, TypeError):
        raise ValidationError("Hospital ID must be an integer.")
    if hid <= 0:
        raise ValidationError("Hospital ID must be positive.")
    return hid


# ============================================================================
# Phase 2: Medical Intelligence & Clinical Laboratory Validators
# ============================================================================


def validate_date_iso(date_str: Any, field_name: str = "Date", allow_future: bool = False) -> str:
    """Validate ISO-8601 formatted date (YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS])."""
    if not isinstance(date_str, str) or not date_str.strip():
        raise ValidationError(f"{field_name} is required.")
    cleaned = date_str.strip()
    
    parsed_date = None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            parsed_date = datetime.strptime(cleaned, fmt)
            break
        except ValueError:
            continue
            
    if not parsed_date:
        raise ValidationError(
            f"{field_name} '{cleaned}' must be a valid date formatted as YYYY-MM-DD or YYYY-MM-DD HH:MM:SS."
        )
        
    if not allow_future:
        # Allow up to 1 day drift for client/server time zone variance
        tomorrow = datetime.utcnow() + timedelta(days=1)
        if parsed_date > tomorrow:
            raise ValidationError(f"{field_name} cannot be in the future.")
            
    return cleaned


def validate_blood_pressure(systolic: Any, diastolic: Any) -> tuple[float, float, list[str]]:
    """Validate blood pressure pair and return (systolic, diastolic, warnings)."""
    if systolic is None or systolic == "":
        raise ValidationError("Systolic blood pressure is required.")
    if diastolic is None or diastolic == "":
        raise ValidationError("Diastolic blood pressure is required.")
        
    try:
        sys_val = float(systolic)
        dia_val = float(diastolic)
    except (ValueError, TypeError):
        raise ValidationError("Blood pressure values must be numeric.")
        
    if sys_val < 40 or sys_val > 300:
        raise ValidationError(f"Systolic blood pressure ({sys_val} mmHg) is out of physiological range (40 - 300 mmHg).")
    if dia_val < 20 or dia_val > 200:
        raise ValidationError(f"Diastolic blood pressure ({dia_val} mmHg) is out of physiological range (20 - 200 mmHg).")
        
    if sys_val <= dia_val:
        raise ValidationError(
            f"Systolic blood pressure ({sys_val} mmHg) must be strictly greater than diastolic ({dia_val} mmHg)."
        )
        
    warnings = []
    if sys_val >= 140 or dia_val >= 90:
        warnings.append(f"Elevated Blood Pressure: {sys_val:.0f}/{dia_val:.0f} mmHg suggests Stage 2 hypertension.")
    elif sys_val < 90 or dia_val < 60:
        warnings.append(f"Low Blood Pressure: {sys_val:.0f}/{dia_val:.0f} mmHg indicates hypotension.")
        
    return sys_val, dia_val, warnings


def validate_heart_rate(hr: Any) -> tuple[float, list[str]]:
    """Validate heart rate in beats per minute (bpm)."""
    if hr is None or hr == "":
        raise ValidationError("Heart rate is required.")
    try:
        val = float(hr)
    except (ValueError, TypeError):
        raise ValidationError("Heart rate must be numeric.")
        
    if val < 20 or val > 300:
        raise ValidationError(f"Heart rate ({val} bpm) is out of physiological range (20 - 300 bpm).")
        
    warnings = []
    if val < 60:
        warnings.append(f"Bradycardia detected: {val:.0f} bpm is below standard resting rate.")
    elif val > 100:
        warnings.append(f"Tachycardia detected: {val:.0f} bpm is above standard resting rate.")
        
    return val, warnings


def validate_respiratory_rate(rr: Any) -> tuple[float, list[str]]:
    """Validate respiratory rate in breaths per minute."""
    if rr is None or rr == "":
        raise ValidationError("Respiratory rate is required.")
    try:
        val = float(rr)
    except (ValueError, TypeError):
        raise ValidationError("Respiratory rate must be numeric.")
        
    if val < 4 or val > 80:
        raise ValidationError(f"Respiratory rate ({val} breaths/min) is out of physiological range (4 - 80).")
        
    warnings = []
    if val < 12 or val > 20:
        warnings.append(f"Abnormal respiratory rate: {val:.0f} breaths/min (standard resting range: 12-20).")
        
    return val, warnings


def validate_temperature(temp: Any) -> tuple[float, list[str]]:
    """Validate body temperature in degrees Celsius (°C)."""
    if temp is None or temp == "":
        raise ValidationError("Body temperature is required.")
    try:
        val = float(temp)
    except (ValueError, TypeError):
        raise ValidationError("Body temperature must be numeric.")
        
    if val < 25.0 or val > 45.0:
        raise ValidationError(f"Temperature ({val} °C) is out of physiological limits (25.0 - 45.0 °C).")
        
    warnings = []
    if val >= 38.0:
        warnings.append(f"Pyrexia/Fever alert: {val:.1f} °C.")
    elif val < 35.5:
        warnings.append(f"Hypothermia alert: {val:.1f} °C.")
        
    return val, warnings


def validate_spo2(spo2: Any) -> tuple[float, list[str]]:
    """Validate peripheral oxygen saturation SpO2 (%)."""
    if spo2 is None or spo2 == "":
        raise ValidationError("Oxygen saturation (SpO2) is required.")
    try:
        val = float(spo2)
    except (ValueError, TypeError):
        raise ValidationError("SpO2 must be numeric.")
        
    if val < 50.0 or val > 100.0:
        raise ValidationError(f"SpO2 ({val}%) is out of possible range (50.0 - 100.0%).")
        
    warnings = []
    if val < 92.0:
        warnings.append(f"Desaturation warning: SpO2 {val:.1f}% indicates hypoxia.")
        
    return val, warnings


def validate_height(height_cm: Any) -> float:
    """Validate height in centimeters (cm)."""
    if height_cm is None or height_cm == "":
        raise ValidationError("Height is required.")
    try:
        val = float(height_cm)
    except (ValueError, TypeError):
        raise ValidationError("Height must be numeric.")
    if val < 30.0 or val > 260.0:
        raise ValidationError(f"Height ({val} cm) must be between 30.0 and 260.0 cm.")
    return val


def validate_weight(weight_kg: Any) -> float:
    """Validate weight in kilograms (kg)."""
    if weight_kg is None or weight_kg == "":
        raise ValidationError("Weight is required.")
    try:
        val = float(weight_kg)
    except (ValueError, TypeError):
        raise ValidationError("Weight must be numeric.")
    if val < 1.0 or val > 400.0:
        raise ValidationError(f"Weight ({val} kg) must be between 1.0 and 400.0 kg.")
    return val


def calculate_bmi(height_cm: float | None, weight_kg: float | None) -> float | None:
    """Calculate Body Mass Index (BMI = kg / m²)."""
    if height_cm is None or weight_kg is None:
        return None
    if height_cm <= 0 or weight_kg <= 0:
        return None
    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m * height_m)
    return round(bmi, 1)


def validate_lab_float(
    field_name: str,
    val: Any,
    min_val: float,
    max_val: float,
    unit: str = "",
    required: bool = False,
) -> float | None:
    """Generic laboratory floating-point biomarker boundary validator."""
    if val is None or val == "":
        if required:
            raise ValidationError(f"{field_name} is required.")
        return None
    try:
        num = float(val)
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} must be a valid number.")
        
    if num < min_val or num > max_val:
        u_str = f" {unit}" if unit else ""
        raise ValidationError(
            f"{field_name} ({num}{u_str}) is out of permissible clinical range ({min_val} - {max_val}{u_str})."
        )
    return num


def validate_laboratory_results(data: dict[str, Any]) -> dict[str, Any]:
    """Validate all provided laboratory biomarker values against clinical bounds."""
    validated: dict[str, Any] = {}
    
    # Blood Glucose (10 - 1200 mg/dL)
    validated["blood_glucose"] = validate_lab_float("Blood Glucose", data.get("blood_glucose"), 10.0, 1200.0, "mg/dL")
    # HbA1c (2.0 - 20.0 %)
    validated["hba1c"] = validate_lab_float("HbA1c", data.get("hba1c"), 2.0, 20.0, "%")
    # Hemoglobin (1.0 - 28.0 g/dL)
    validated["hemoglobin"] = validate_lab_float("Hemoglobin", data.get("hemoglobin"), 1.0, 28.0, "g/dL")
    # WBC (0.1 - 150.0 x10³/µL)
    validated["wbc"] = validate_lab_float("WBC", data.get("wbc"), 0.1, 150.0, "x10³/µL")
    # Platelets (5 - 2000 x10³/µL)
    validated["platelets"] = validate_lab_float("Platelets", data.get("platelets"), 5.0, 2000.0, "x10³/µL")
    # Serum Creatinine (0.1 - 30.0 mg/dL)
    validated["creatinine"] = validate_lab_float("Creatinine", data.get("creatinine"), 0.1, 30.0, "mg/dL")
    # eGFR (0 - 200 mL/min/1.73m²)
    validated["egfr"] = validate_lab_float("eGFR", data.get("egfr"), 0.0, 200.0, "mL/min/1.73m²")
    # BUN (1 - 250 mg/dL)
    validated["bun"] = validate_lab_float("BUN", data.get("bun"), 1.0, 250.0, "mg/dL")
    # Sodium (90 - 180 mEq/L)
    validated["sodium"] = validate_lab_float("Sodium", data.get("sodium"), 90.0, 180.0, "mEq/L")
    # Potassium (1.0 - 10.0 mEq/L)
    validated["potassium"] = validate_lab_float("Potassium", data.get("potassium"), 1.0, 10.0, "mEq/L")
    # Calcium (2.0 - 25.0 mg/dL)
    validated["calcium"] = validate_lab_float("Calcium", data.get("calcium"), 2.0, 25.0, "mg/dL")
    # AST (1 - 5000 U/L)
    validated["ast"] = validate_lab_float("AST", data.get("ast"), 1.0, 5000.0, "U/L")
    # ALT (1 - 5000 U/L)
    validated["alt"] = validate_lab_float("ALT", data.get("alt"), 1.0, 5000.0, "U/L")
    # Bilirubin (0.1 - 50.0 mg/dL)
    validated["bilirubin"] = validate_lab_float("Bilirubin", data.get("bilirubin"), 0.1, 50.0, "mg/dL")
    # Albumin (0.5 - 8.0 g/dL)
    validated["albumin"] = validate_lab_float("Albumin", data.get("albumin"), 0.5, 8.0, "g/dL")
    # INR (0.5 - 15.0)
    validated["inr"] = validate_lab_float("INR", data.get("inr"), 0.5, 15.0, "ratio")
    
    return validated


def validate_ecg_status(status: Any) -> str:
    """Validate ECG status."""
    if not isinstance(status, str) or not status.strip():
        return "Not Assessed"
    cleaned = status.strip()
    matching = [s for s in ECG_STATUSES if s.lower() == cleaned.lower()]
    if not matching:
        raise ValidationError(f"Invalid ECG status '{status}'. Allowed: {', '.join(ECG_STATUSES)}.")
    return matching[0]


def validate_cardiac_assessment(data: dict[str, Any]) -> dict[str, Any]:
    """Validate cardiac evaluation parameters."""
    validated: dict[str, Any] = {}
    validated["ecg_status"] = validate_ecg_status(data.get("ecg_status", "Not Assessed"))
    validated["ecg_findings"] = str(data.get("ecg_findings") or "").strip() or None
    
    # Heart Rate (20 - 300)
    hr = data.get("heart_rate")
    validated["heart_rate"] = validate_lab_float("Heart Rate", hr, 20.0, 300.0, "bpm") if hr not in (None, "") else None
    
    # PR Interval (80 - 400 ms)
    validated["pr_interval"] = validate_lab_float("PR Interval", data.get("pr_interval"), 80.0, 400.0, "ms")
    # QRS Duration (40 - 300 ms)
    validated["qrs_duration"] = validate_lab_float("QRS Duration", data.get("qrs_duration"), 40.0, 300.0, "ms")
    # QT Interval (200 - 800 ms)
    validated["qt_interval"] = validate_lab_float("QT Interval", data.get("qt_interval"), 200.0, 800.0, "ms")
    # QTc (250 - 800 ms)
    validated["qtc"] = validate_lab_float("QTc", data.get("qtc"), 250.0, 800.0, "ms")
    
    # Echocardiogram Available
    echo_avail = data.get("echocardiogram_available", 0)
    validated["echocardiogram_available"] = 1 if bool(echo_avail) else 0
    
    # Ejection Fraction (5 - 90%)
    ef = data.get("ejection_fraction")
    validated["ejection_fraction"] = validate_lab_float("Ejection Fraction", ef, 5.0, 90.0, "%") if ef not in (None, "") else None
    
    return validated


def validate_crossmatch_status(status: Any) -> str:
    """Validate crossmatch status string against standard options."""
    if not isinstance(status, str) or not status.strip():
        return "Not Tested"
    cleaned = status.strip()
    matching = [s for s in CROSSMATCH_STATUSES if s.lower() == cleaned.lower()]
    if not matching:
        raise ValidationError(f"Invalid crossmatch status '{status}'. Allowed: {', '.join(CROSSMATCH_STATUSES)}.")
    return matching[0]


def validate_organ_assessment_status(status: Any) -> str:
    """Validate organ assessment status string."""
    if not isinstance(status, str) or not status.strip():
        return "Not Assessed"
    cleaned = status.strip()
    matching = [s for s in ORGAN_ASSESSMENT_STATUSES if s.lower() == cleaned.lower()]
    if not matching:
        raise ValidationError(f"Invalid organ assessment status '{status}'. Allowed: {', '.join(ORGAN_ASSESSMENT_STATUSES)}.")
    return matching[0]


def validate_hla_allele(locus: str, val: Any) -> str | None:
    """Validate HLA allele string format for a given locus."""
    if val is None:
        return None
    cleaned = str(val).strip()
    if not cleaned:
        return None
    if not HLA_ALLELE_REGEX.match(cleaned):
        raise ValidationError(f"Invalid characters in HLA-{locus} allele specification: '{cleaned}'.")
    if len(cleaned) > 100:
        raise ValidationError(f"HLA-{locus} entry cannot exceed 100 characters.")
    return cleaned

