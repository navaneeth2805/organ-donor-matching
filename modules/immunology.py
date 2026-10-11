"""Business service layer for HLA Genotyping, Antibody Profiles, and Crossmatch compatibility."""

from typing import Any
from config.logging_config import get_logger
from database.models import AuditLog, CrossmatchResult, HLAProfile
from database.repositories import (
    AuditLogRepository,
    CrossmatchRepository,
    DonorRepository,
    HLARepository,
    RecipientRepository,
)
from utils.exceptions import RecordNotFoundError, ValidationError
from utils.helpers import current_date, current_timestamp
from utils.validators import (
    validate_crossmatch_status,
    validate_date_iso,
    validate_hla_allele,
    validate_id,
)

logger = get_logger("modules.immunology")


class HLAService:
    """Service handling HLA profiling, allele matching, and typing analysis."""

    def __init__(
        self,
        hla_repo: HLARepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = hla_repo
        self.audit_repo = audit_repo

    def record_hla(
        self,
        entity_type: str,
        entity_id: int,
        hla_a: str | None = None,
        hla_b: str | None = None,
        hla_c: str | None = None,
        hla_dr: str | None = None,
        hla_dq: str | None = None,
        antibody_information: str | None = None,
        test_date: str | None = None,
    ) -> HLAProfile:
        """Validate HLA allele loci strings and persist HLA profile."""
        clean_entity_type = str(entity_type).strip().upper()
        if clean_entity_type not in ("DONOR", "RECIPIENT"):
            raise ValidationError("Entity type must be either 'DONOR' or 'RECIPIENT'.")

        valid_entity_id = validate_id(entity_id, f"{clean_entity_type.title()} ID")

        # Validate loci
        val_a = validate_hla_allele("A", hla_a)
        val_b = validate_hla_allele("B", hla_b)
        val_c = validate_hla_allele("C", hla_c)
        val_dr = validate_hla_allele("DR", hla_dr)
        val_dq = validate_hla_allele("DQ", hla_dq)

        antibody_info = str(antibody_information or "").strip() or None
        date_val = validate_date_iso(test_date or current_date(), "HLA test date", allow_future=False)
        ts = current_timestamp()

        hla = HLAProfile(
            id=None,
            entity_type=clean_entity_type,
            entity_id=valid_entity_id,
            hla_a=val_a,
            hla_b=val_b,
            hla_c=val_c,
            hla_dr=val_dr,
            hla_dq=val_dq,
            antibody_information=antibody_info,
            test_date=date_val,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(hla)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type=clean_entity_type,
                entity_id=valid_entity_id,
                action="RECORD_HLA_PROFILE",
                details=f"HLA profile recorded: A={val_a}, B={val_b}, DR={val_dr}",
                created_at=ts,
            )
        )

        logger.info("HLA Profile recorded for %s ID %d.", clean_entity_type, valid_entity_id)
        return saved

    def get_latest(self, entity_type: str, entity_id: int) -> HLAProfile | None:
        """Fetch latest HLA profile for an entity."""
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_by_entity(clean_entity_type, entity_id)

    def get_history(self, entity_type: str, entity_id: int, limit: int = 50) -> list[HLAProfile]:
        clean_entity_type = str(entity_type).strip().upper()
        return self.repo.get_history(clean_entity_type, entity_id, limit=limit)

    @staticmethod
    def calculate_hla_match_score(donor_hla: HLAProfile | None, recipient_hla: HLAProfile | None) -> dict[str, Any]:
        """Compare HLA profiles across standard loci (A, B, C, DR, DQ) and return match score."""
        if not donor_hla or not recipient_hla:
            return {
                "matched_loci_count": 0,
                "total_evaluated_loci": 0,
                "match_percentage": 0.0,
                "loci_comparison": {},
                "summary": "Incomplete HLA typing on one or both profiles.",
            }

        loci = ["hla_a", "hla_b", "hla_c", "hla_dr", "hla_dq"]
        loci_comparison: dict[str, dict[str, Any]] = {}
        matches = 0
        evaluated = 0

        for locus in loci:
            d_val = getattr(donor_hla, locus, None)
            r_val = getattr(recipient_hla, locus, None)

            if d_val and r_val:
                evaluated += 1
                # Check for token overlap (e.g. split by comma, slash, or space)
                d_tokens = set(re_split(d_val))
                r_tokens = set(re_split(r_val))
                common = d_tokens.intersection(r_tokens)
                is_match = len(common) > 0
                if is_match:
                    matches += 1
                loci_comparison[locus] = {
                    "donor": d_val,
                    "recipient": r_val,
                    "matched": is_match,
                    "shared_alleles": list(common),
                }
            else:
                loci_comparison[locus] = {
                    "donor": d_val,
                    "recipient": r_val,
                    "matched": None,
                    "shared_alleles": [],
                }

        match_pct = round((matches / evaluated * 100.0), 1) if evaluated > 0 else 0.0

        return {
            "matched_loci_count": matches,
            "total_evaluated_loci": evaluated,
            "match_percentage": match_pct,
            "loci_comparison": loci_comparison,
            "summary": f"{matches}/{evaluated} loci matched ({match_pct}% immunological homology)",
        }


def re_split(s: str) -> list[str]:
    """Helper to split multi-allele strings."""
    import re
    tokens = re.split(r"[,;/\s]+", s.strip())
    return [t.strip().upper() for t in tokens if t.strip()]


class CrossmatchService:
    """Service handling prospective and virtual crossmatch testing for donor-recipient pairs."""

    def __init__(
        self,
        crossmatch_repo: CrossmatchRepository,
        donor_repo: DonorRepository,
        recipient_repo: RecipientRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self.repo = crossmatch_repo
        self.donor_repo = donor_repo
        self.recipient_repo = recipient_repo
        self.audit_repo = audit_repo

    def record_crossmatch(
        self,
        donor_id: int,
        recipient_id: int,
        result: str,
        antibody_information: str | None = None,
        test_date: str | None = None,
        notes: str | None = None,
    ) -> CrossmatchResult:
        """Validate pair existence, crossmatch status, and record crossmatch test result."""
        valid_donor_id = validate_id(donor_id, "Donor ID")
        valid_recipient_id = validate_id(recipient_id, "Recipient ID")

        # Verify existence
        if not self.donor_repo.get_by_id(valid_donor_id):
            raise RecordNotFoundError(f"Donor with ID {valid_donor_id} does not exist.")
        if not self.recipient_repo.get_by_id(valid_recipient_id):
            raise RecordNotFoundError(f"Recipient with ID {valid_recipient_id} does not exist.")

        valid_result = validate_crossmatch_status(result)
        date_val = validate_date_iso(test_date or current_date(), "Crossmatch test date", allow_future=False)
        ts = current_timestamp()

        crossmatch = CrossmatchResult(
            id=None,
            donor_id=valid_donor_id,
            recipient_id=valid_recipient_id,
            result=valid_result,
            antibody_information=str(antibody_information or "").strip() or None,
            test_date=date_val,
            notes=str(notes or "").strip() or None,
            created_at=ts,
            updated_at=ts,
        )

        saved = self.repo.create(crossmatch)

        self.audit_repo.create(
            AuditLog(
                id=None,
                entity_type="CROSSMATCH",
                entity_id=saved.id,
                action="RECORD_CROSSMATCH",
                details=f"Crossmatch recorded for Donor {valid_donor_id} -> Recipient {valid_recipient_id}: Result={valid_result}",
                created_at=ts,
            )
        )

        logger.info(
            "Crossmatch recorded: Donor %d -> Recipient %d = %s",
            valid_donor_id,
            valid_recipient_id,
            valid_result,
        )
        return saved

    def get_by_pair(self, donor_id: int, recipient_id: int) -> CrossmatchResult | None:
        """Fetch latest crossmatch for a given pair."""
        return self.repo.get_by_pair(donor_id, recipient_id)

    get_crossmatch_between = get_by_pair

    def get_by_donor(self, donor_id: int) -> list[CrossmatchResult]:
        return self.repo.get_by_donor(donor_id)

    def get_by_recipient(self, recipient_id: int) -> list[CrossmatchResult]:
        return self.repo.get_by_recipient(recipient_id)

    def get_all(self, limit: int = 100) -> list[CrossmatchResult]:
        return self.repo.get_all(limit=limit)

    @staticmethod
    def is_compatible(result_str: str | None) -> bool | None:
        """Determine if crossmatch result indicates transplant immunologic clearance."""
        if not result_str:
            return None
        res = result_str.strip().lower()
        if res == "negative":
            return True
        if res == "positive":
            return False
        return None
