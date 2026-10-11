"""Custom application exceptions for defensive error handling."""


class OrganMatchingError(Exception):
    """Base domain exception for the Organ Donor Matching Network."""
    pass


class DatabaseError(OrganMatchingError):
    """Raised when an error occurs during database operations."""
    pass


class ValidationError(OrganMatchingError):
    """Raised when input data fails domain or structural validation."""
    pass


class DuplicateRecordError(ValidationError):
    """Raised when a unique constraint or primary key conflict occurs."""
    pass


class RecordNotFoundError(OrganMatchingError):
    """Raised when an entity with a specific identifier cannot be found."""
    pass


class ServiceError(OrganMatchingError):
    """Raised when a business-logic service operation fails."""
    pass


class MedicalProfileError(OrganMatchingError):
    """Raised when an error occurs during medical profile operations."""
    pass


class VitalSignsError(MedicalProfileError):
    """Raised when an error occurs during vital signs validation or recording."""
    pass


class LaboratoryError(MedicalProfileError):
    """Raised when an error occurs during laboratory data operations."""
    pass


class CardiacAssessmentError(MedicalProfileError):
    """Raised when an error occurs during cardiac assessment recording."""
    pass


class ImmunologyError(MedicalProfileError):
    """Raised when an error occurs during HLA or crossmatch operations."""
    pass


class OrganAssessmentError(MedicalProfileError):
    """Raised when an error occurs during organ assessment operations."""
    pass


class DataQualityError(MedicalProfileError):
    """Raised when an error occurs during data completeness or quality assessment."""
    pass
