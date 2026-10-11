"""Compatibility Service coordinating pair evaluations, candidate search, and batch analysis."""

from typing import Any

try:
    import pandas as pd
except ImportError:
    class _SimpleDataFrame:
        def __init__(self, records: list[dict[str, Any]]):
            self._records = records
            self.columns = list(records[0].keys()) if records else []

        def __len__(self):
            return len(self._records)

        def __iter__(self):
            return iter(self._records)

        def __getitem__(self, item):
            return [r[item] for r in self._records]

        @property
        def empty(self):
            return len(self._records) == 0

        def to_dict(self, orient: str = "records"):
            return self._records

    class _PandasModule:
        DataFrame = _SimpleDataFrame

    pd = _PandasModule()

from config.logging_config import get_logger
from config.matching_config import (
    BLOOD_COMPATIBILITY_MAP,
    DEFAULT_WEIGHTS,
    RULE_VERSION,
    STATUS_INCOMPATIBLE,
    STATUS_INSUFFICIENT_DATA,
    STATUS_POTENTIAL_CANDIDATE,
    STATUS_REQUIRES_REVIEW,
)
from compatibility.rule_engine import CompatibilityRuleEngine
from database.models import AuditLog, CompatibilityResult, Donor, Recipient
from database.repositories import (
    AuditLogRepository,
    CompatibilityRepository,
    DonorRepository,
    HospitalRepository,
    RecipientRepository,
)
from modules.candidate_ranking import CandidateRankingEngine
from modules.data_quality import DataQualityService
from modules.explainability import ExplainabilityEngine
from modules.medical_profile import MedicalProfileService
from utils.exceptions import RecordNotFoundError
from utils.helpers import current_timestamp

logger = get_logger("modules.compatibility")


class CompatibilityService:
    """Core domain service for organ compatibility testing, software candidate ranking, and batch analysis."""

    def __init__(
        self,
        compatibility_repo: CompatibilityRepository,
        donor_repo: DonorRepository,
        recipient_repo: RecipientRepository,
        hospital_repo: HospitalRepository,
        medical_profile_service: MedicalProfileService,
        data_quality_service: DataQualityService,
        audit_repo: AuditLogRepository,
        default_weights: dict[str, float] | None = None,
    ):
        self.repo = compatibility_repo
        self.donor_repo = donor_repo
        self.recip_repo = recipient_repo
        self.hosp_repo = hospital_repo
        self.medical_svc = medical_profile_service
        self.dq_svc = data_quality_service
        self.audit_repo = audit_repo

        self.rule_engine = CompatibilityRuleEngine()
        self.ranking_engine = CandidateRankingEngine(default_weights or DEFAULT_WEIGHTS)
        self.explainability_engine = ExplainabilityEngine()

    def evaluate_pair(
        self,
        donor_id: int,
        recipient_id: int,
        persist: bool = True,
        weights_override: dict[str, float] | None = None,
    ) -> CompatibilityResult:
        """Evaluate compatibility and calculate software candidate score for a specific donor and recipient pair."""
        donor = self.donor_repo.get_by_id(donor_id)
        if not donor:
            raise RecordNotFoundError(f"Donor ID {donor_id} does not exist.")

        recipient = self.recip_repo.get_by_id(recipient_id)
        if not recipient:
            raise RecordNotFoundError(f"Recipient ID {recipient_id} does not exist.")

        # Build clinical evaluation context from Phase 2 services
        donor_profile = self.medical_svc.get_complete_profile("DONOR", donor_id)
        recip_profile = self.medical_svc.get_complete_profile("RECIPIENT", recipient_id)
        donor_dq = self.dq_svc.evaluate_entity_quality("DONOR", donor_id)
        recip_dq = self.dq_svc.evaluate_entity_quality("RECIPIENT", recipient_id)

        donor_hosp = self.hosp_repo.get_by_id(donor.hospital_id) if donor.hospital_id else None
        recip_hosp = self.hosp_repo.get_by_id(recipient.hospital_id) if recipient.hospital_id else None

        # Crossmatch specifically for this pair
        xm = self.medical_svc.crossmatch_service.get_crossmatch_between(donor_id, recipient_id)

        context: dict[str, Any] = {
            "donor_profile": donor_profile,
            "recipient_profile": recip_profile,
            "donor_quality": donor_dq,
            "recipient_quality": recip_dq,
            "donor_hospital": donor_hosp,
            "recipient_hospital": recip_hosp,
            "crossmatch": xm,
        }

        # 1. Execute Rule Engine Pipeline
        rule_eval = self.rule_engine.evaluate(donor, recipient, context)

        # 2. Calculate Soft Ranking Scores
        scores = self.ranking_engine.calculate_scores(
            donor,
            recipient,
            rule_eval,
            weights_override=weights_override,
        )

        # 3. Generate Structured Clinical Narrative
        explanation_data = self.explainability_engine.generate_explanation(
            donor,
            recipient,
            rule_eval["status"],
            rule_eval["hard_failures"],
            rule_eval["warnings"],
            rule_eval["explanations"],
            scores,
        )

        ts = current_timestamp()
        source_ts = max(donor.updated_at, recipient.updated_at)

        result = CompatibilityResult(
            id=None,
            donor_id=donor_id,
            recipient_id=recipient_id,
            status=rule_eval["status"],
            score=scores["overall_score"],
            blood_score=scores["blood_score"],
            organ_score=scores["organ_score"],
            clinical_score=scores["clinical_score"],
            urgency_score=scores["urgency_score"],
            waiting_time_score=scores["waiting_time_score"],
            hla_score=scores["hla_score"],
            geographic_score=scores["geographic_score"],
            data_quality_score=scores["data_quality_score"],
            hard_failures=rule_eval["hard_failures"],
            warnings=rule_eval["warnings"],
            explanations=rule_eval["explanations"],
            rule_version=RULE_VERSION,
            source_updated_at=source_ts,
            evaluated_at=ts,
            created_at=ts,
            updated_at=ts,
            donor_name=donor.name,
            recipient_name=recipient.name,
            organ=recipient.organ_needed or donor.organ,
            donor_blood_group=donor.blood_group,
            recipient_blood_group=recipient.blood_group,
            donor_hospital=donor_hosp.name if donor_hosp else None,
            recipient_hospital=recip_hosp.name if recip_hosp else None,
            urgency=recipient.urgency,
            waiting_time_days=recipient.waiting_time_days,
        )

        if persist:
            saved_id = self.repo.save_result(result)
            result.id = saved_id
            self.audit_repo.create(
                AuditLog(
                    id=None,
                    entity_type="COMPATIBILITY",
                    entity_id=saved_id,
                    action="EVALUATE_PAIR",
                    details=f"Evaluated Pair D{donor_id} -> R{recipient_id}: Status {result.status}, Score {result.score:.1f}",
                    created_at=ts,
                )
            )

        return result

    def find_candidates_for_donor(
        self,
        donor_id: int,
        min_score: float = 0.0,
        recalculate: bool = False,
    ) -> list[CompatibilityResult]:
        """Find all potential and review-required candidates for a donor using pre-filtering."""
        donor = self.donor_repo.get_by_id(donor_id)
        if not donor:
            raise RecordNotFoundError(f"Donor {donor_id} not found.")

        # If cached and not recalculating, return existing records
        if not recalculate:
            cached = self.repo.get_by_donor(donor_id, min_score=min_score)
            if cached:
                return cached

        # Pre-filter recipients: only recipients waiting for this organ and with compatible blood group
        recipients = self.recip_repo.get_all()
        allowed_bg = BLOOD_COMPATIBILITY_MAP.get(donor.blood_group, set())

        candidate_results: list[CompatibilityResult] = []
        for r in recipients:
            if str(r.organ_needed).strip().lower() != str(donor.organ).strip().lower():
                continue
            if r.blood_group not in allowed_bg:
                continue

            res = self.evaluate_pair(donor.id, r.id, persist=True)
            if res.score >= min_score and res.status in (STATUS_POTENTIAL_CANDIDATE, STATUS_REQUIRES_REVIEW):
                candidate_results.append(res)

        candidate_results.sort(key=lambda x: x.score, reverse=True)
        return candidate_results

    def find_candidates_for_recipient(
        self,
        recipient_id: int,
        min_score: float = 0.0,
        recalculate: bool = False,
    ) -> list[CompatibilityResult]:
        """Find all candidate donors for a recipient using pre-filtering."""
        recipient = self.recip_repo.get_by_id(recipient_id)
        if not recipient:
            raise RecordNotFoundError(f"Recipient {recipient_id} not found.")

        if not recalculate:
            cached = self.repo.get_by_recipient(recipient_id, min_score=min_score)
            if cached:
                return cached

        donors = self.donor_repo.get_all()
        candidate_results: list[CompatibilityResult] = []

        for d in donors:
            if str(d.organ).strip().lower() != str(recipient.organ_needed).strip().lower():
                continue
            allowed_bg = BLOOD_COMPATIBILITY_MAP.get(d.blood_group, set())
            if recipient.blood_group not in allowed_bg:
                continue

            res = self.evaluate_pair(d.id, recipient.id, persist=True)
            if res.score >= min_score and res.status in (STATUS_POTENTIAL_CANDIDATE, STATUS_REQUIRES_REVIEW):
                candidate_results.append(res)

        candidate_results.sort(key=lambda x: x.score, reverse=True)
        return candidate_results

    def evaluate_all_pairs(
        self,
        prefilter: bool = True,
        weights_override: dict[str, float] | None = None,
    ) -> pd.DataFrame:
        """Perform batch compatibility evaluations across network and return structured DataFrame."""
        donors = self.donor_repo.get_all()
        recipients = self.recip_repo.get_all()

        records: list[dict[str, Any]] = []

        for d in donors:
            allowed_bg = BLOOD_COMPATIBILITY_MAP.get(d.blood_group, set())
            for r in recipients:
                # If prefilter is active, skip obvious mismatched organ or blood group to save execution time
                if prefilter:
                    if str(d.organ).strip().lower() != str(r.organ_needed).strip().lower():
                        continue
                    if r.blood_group not in allowed_bg:
                        continue

                res = self.evaluate_pair(d.id, r.id, persist=True, weights_override=weights_override)
                records.append({
                    "donor_id": res.donor_id,
                    "recipient_id": res.recipient_id,
                    "donor_name": res.donor_name,
                    "recipient_name": res.recipient_name,
                    "organ": res.organ,
                    "donor_blood_group": res.donor_blood_group,
                    "recipient_blood_group": res.recipient_blood_group,
                    "status": res.status,
                    "score": res.score,
                    "blood_score": res.blood_score,
                    "organ_score": res.organ_score,
                    "clinical_score": res.clinical_score,
                    "urgency_score": res.urgency_score,
                    "waiting_time_score": res.waiting_time_score,
                    "hla_score": res.hla_score,
                    "geographic_score": res.geographic_score,
                    "data_quality_score": res.data_quality_score,
                    "hard_failures_count": len(res.hard_failures),
                    "warnings_count": len(res.warnings),
                    "hard_failures": "; ".join(res.hard_failures),
                    "warnings": "; ".join(res.warnings),
                    "evaluated_at": res.evaluated_at,
                })

        return pd.DataFrame(records)

    def get_candidate_edges(
        self,
        min_score: float = 0.0,
        include_review: bool = True,
    ) -> list[dict[str, Any]]:
        """Phase 4 Graph API Interface: returns structured candidate edges for graph algorithm construction."""
        allowed_statuses = [STATUS_POTENTIAL_CANDIDATE]
        if include_review:
            allowed_statuses.append(STATUS_REQUIRES_REVIEW)

        candidates = self.repo.get_candidates(min_score=min_score, limit=1000)
        edges: list[dict[str, Any]] = []

        for c in candidates:
            if c.status in allowed_statuses:
                edges.append({
                    "donor_id": c.donor_id,
                    "recipient_id": c.recipient_id,
                    "score": c.score,
                    "status": c.status,
                    "metadata": {
                        "organ": c.organ,
                        "donor_name": c.donor_name,
                        "recipient_name": c.recipient_name,
                        "donor_blood_group": c.donor_blood_group,
                        "recipient_blood_group": c.recipient_blood_group,
                        "blood_score": c.blood_score,
                        "organ_score": c.organ_score,
                        "clinical_score": c.clinical_score,
                        "urgency_score": c.urgency_score,
                        "waiting_time_score": c.waiting_time_score,
                        "hla_score": c.hla_score,
                        "geographic_score": c.geographic_score,
                        "data_quality_score": c.data_quality_score,
                        "warnings": c.warnings,
                        "evaluated_at": c.evaluated_at,
                    },
                })
        return edges

    def invalidate_entity_results(self, entity_type: str, entity_id: int) -> int:
        """Invalidate and purge cached compatibility results when an entity changes."""
        deleted_count = self.repo.delete_by_entity(entity_type, entity_id)
        if deleted_count > 0:
            logger.info("Invalidated %d compatibility results for %s ID %d", deleted_count, entity_type, entity_id)
        return deleted_count
