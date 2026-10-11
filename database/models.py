"""Typed model representations for domain entities using dataclasses."""

from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class Donor:
    """Represents a registered organ donor."""

    id: int | None
    name: str
    age: int
    blood_group: str
    organ: str
    hospital_id: int | None
    location: str
    availability: str
    phone: str | None
    email: str | None
    registration_date: str
    created_at: str
    updated_at: str
    hospital_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary representation."""
        return asdict(self)


@dataclass
class Recipient:
    """Represents a registered organ recipient waiting for transplant."""

    id: int | None
    name: str
    age: int
    blood_group: str
    organ_needed: str
    hospital_id: int | None
    location: str
    urgency: str
    waiting_time_days: int
    phone: str | None
    email: str | None
    registration_date: str
    created_at: str
    updated_at: str
    hospital_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary representation."""
        return asdict(self)


@dataclass
class Hospital:
    """Represents a healthcare or transplant partner facility."""

    id: int | None
    name: str
    city: str
    state: str
    country: str
    phone: str | None
    email: str | None
    active: int
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary representation."""
        return asdict(self)


@dataclass
class AuditLog:
    """Represents an immutable record of system actions and modifications."""

    id: int | None
    entity_type: str
    entity_id: int | None
    action: str
    details: str | None
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary representation."""
        return asdict(self)


# ============================================================================
# Phase 2: Medical Intelligence & Health Profile Models
# ============================================================================


@dataclass
class MedicalProfile:
    """Represents high-level clinical assessment metadata for a donor or recipient."""

    id: int | None
    entity_type: str
    entity_id: int
    assessment_date: str
    notes: str | None
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class VitalSigns:
    """Structured vital signs and physical biometric measurements."""

    id: int | None
    entity_type: str
    entity_id: int
    systolic_bp: float | None
    diastolic_bp: float | None
    heart_rate: float | None
    respiratory_rate: float | None
    temperature: float | None
    spo2: float | None
    height_cm: float | None
    weight_kg: float | None
    bmi: float | None
    recorded_at: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class LaboratoryResults:
    """Structured laboratory biomarker panel."""

    id: int | None
    entity_type: str
    entity_id: int
    blood_glucose: float | None
    hba1c: float | None
    hemoglobin: float | None
    wbc: float | None
    platelets: float | None
    creatinine: float | None
    egfr: float | None
    bun: float | None
    sodium: float | None
    potassium: float | None
    calcium: float | None
    ast: float | None
    alt: float | None
    bilirubin: float | None
    albumin: float | None
    inr: float | None
    test_date: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CardiacAssessment:
    """Structured cardiac evaluation and electrophysiological parameters."""

    id: int | None
    entity_type: str
    entity_id: int
    ecg_status: str | None
    ecg_findings: str | None
    heart_rate: float | None
    pr_interval: float | None
    qrs_duration: float | None
    qt_interval: float | None
    qtc: float | None
    echocardiogram_available: int
    ejection_fraction: float | None
    assessment_date: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MedicalHistory:
    """Systematic comorbidities, medical background, and lifestyle factors."""

    id: int | None
    entity_type: str
    entity_id: int
    diabetes: int
    hypertension: int
    heart_disease: int
    kidney_disease: int
    liver_disease: int
    lung_disease: int
    cancer_history: int
    infectious_disease_status: str | None
    smoking_status: str | None
    medication_history: str | None
    previous_surgery: str | None
    notes: str | None
    assessment_date: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class HLAProfile:
    """Human Leukocyte Antigen (HLA) genotyping and antibody screen."""

    id: int | None
    entity_type: str
    entity_id: int
    hla_a: str | None
    hla_b: str | None
    hla_c: str | None
    hla_dr: str | None
    hla_dq: str | None
    antibody_information: str | None
    test_date: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CrossmatchResult:
    """Prospective or virtual crossmatch result between a specific donor-recipient pair."""

    id: int | None
    donor_id: int
    recipient_id: int
    result: str | None
    antibody_information: str | None
    test_date: str
    notes: str | None
    created_at: str
    updated_at: str
    donor_name: str | None = None
    recipient_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class OrganAssessment:
    """Organ-specific morphological and functional clinical assessment for donors."""

    id: int | None
    donor_id: int
    organ: str
    assessment_status: str
    assessment_notes: str | None
    assessment_date: str
    created_at: str
    updated_at: str
    donor_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CompatibilityResult:
    """Structured compatibility assessment and software ranking result between a donor and recipient."""

    id: int | None
    donor_id: int
    recipient_id: int
    status: str
    score: float
    blood_score: float
    organ_score: float
    clinical_score: float
    urgency_score: float
    waiting_time_score: float
    hla_score: float
    geographic_score: float
    data_quality_score: float
    hard_failures: list[str]
    warnings: list[str]
    explanations: list[str]
    rule_version: str
    evaluated_at: str
    created_at: str
    updated_at: str
    source_updated_at: str | None = None
    donor_name: str | None = None
    recipient_name: str | None = None
    organ: str | None = None
    donor_blood_group: str | None = None
    recipient_blood_group: str | None = None
    donor_hospital: str | None = None
    recipient_hospital: str | None = None
    urgency: str | None = None
    waiting_time_days: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert result model to dictionary."""
        return asdict(self)


@dataclass
class MatchingRun:
    """Represents an execution record of a bipartite graph matching run."""

    id: int | None
    algorithm: str
    graph_nodes: int
    graph_edges: int
    matched_pairs: int
    total_score: float | None
    average_score: float | None
    execution_time_ms: float | None
    rule_version: str | None
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        """Convert matching run to dictionary."""
        return asdict(self)


