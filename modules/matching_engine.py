"""Matching Engine executing and comparing Maximum Cardinality and Maximum Weight bipartite matchings."""

from datetime import datetime, timezone
import time
from typing import Any
import networkx as nx

from algorithms.bipartite_matching import MaximumBipartiteMatching, MatchingResult
from algorithms.weighted_matching import MaximumWeightMatching, WeightedMatchingResult
from config.logging_config import get_logger
from database.models import AuditLog, MatchingRun
from database.repositories import (
    AuditLogRepository,
    CompatibilityRepository,
    DonorRepository,
    MatchingRunRepository,
    RecipientRepository,
)
from modules.graph_engine import GraphEngine

logger = get_logger("modules.matching_engine")


class MatchingEngine:
    """Coordinates graph construction, matching algorithm execution, and comparative evaluation."""

    def __init__(
        self,
        graph_engine: GraphEngine,
        compat_repo: CompatibilityRepository | None = None,
        donor_repo: DonorRepository | None = None,
        recipient_repo: RecipientRepository | None = None,
        matching_run_repo: MatchingRunRepository | None = None,
        audit_repo: AuditLogRepository | None = None,
    ):
        self.graph_engine = graph_engine
        self.compat_repo = compat_repo
        self.donor_repo = donor_repo
        self.recipient_repo = recipient_repo
        self.matching_run_repo = matching_run_repo
        self.audit_repo = audit_repo

    def run_maximum_matching(self, graph: nx.Graph | None = None) -> MatchingResult:
        """Run Maximum Cardinality Bipartite Matching to maximize number of pairs."""
        target_graph = graph if graph is not None else self.graph_engine.graph
        result = MaximumBipartiteMatching.match(target_graph)

        # Persist run if repository available
        if self.matching_run_repo and target_graph is not None and len(target_graph.nodes) > 0:
            try:
                ts = datetime.now(timezone.utc).isoformat()
                avg_score = (
                    sum(p["compatibility_score"] for p in result.matched_pairs) / result.total_matches
                    if result.total_matches > 0 else 0.0
                )
                total_score = sum(p["compatibility_score"] for p in result.matched_pairs)

                run_model = MatchingRun(
                    id=None,
                    algorithm="Maximum Cardinality Matching",
                    graph_nodes=target_graph.number_of_nodes(),
                    graph_edges=target_graph.number_of_edges(),
                    matched_pairs=result.total_matches,
                    total_score=round(total_score, 2),
                    average_score=round(avg_score, 2),
                    execution_time_ms=result.execution_time_ms,
                    rule_version="3.0",
                    created_at=ts,
                )
                saved_id = self.matching_run_repo.save_run(run_model)
                logger.info("Saved maximum matching run record ID: %s", saved_id)
            except Exception as ex:
                logger.warning("Failed to persist matching run record: %s", ex)

        if self.audit_repo:
            try:
                ts = datetime.now(timezone.utc).isoformat()
                self.audit_repo.create(
                    AuditLog(
                        id=None,
                        entity_type="MATCHING",
                        entity_id=None,
                        action="MAXIMUM_MATCHING",
                        details=f"Executed Maximum Cardinality Matching: {result.total_matches} pairs formed with {result.donor_coverage}% donor coverage.",
                        created_at=ts,
                    )
                )
            except Exception:
                pass

        return result

    def run_weighted_matching(self, graph: nx.Graph | None = None) -> WeightedMatchingResult:
        """Run Maximum Weight Matching to maximize overall software compatibility scores."""
        target_graph = graph if graph is not None else self.graph_engine.graph
        result = MaximumWeightMatching.match(target_graph)

        # Persist run if repository available
        if self.matching_run_repo and target_graph is not None and len(target_graph.nodes) > 0:
            try:
                ts = datetime.now(timezone.utc).isoformat()
                run_model = MatchingRun(
                    id=None,
                    algorithm="Maximum Weight Matching",
                    graph_nodes=target_graph.number_of_nodes(),
                    graph_edges=target_graph.number_of_edges(),
                    matched_pairs=result.total_matches,
                    total_score=result.total_weight,
                    average_score=result.average_weight,
                    execution_time_ms=result.execution_time_ms,
                    rule_version="3.0",
                    created_at=ts,
                )
                saved_id = self.matching_run_repo.save_run(run_model)
                logger.info("Saved weighted matching run record ID: %s", saved_id)
            except Exception as ex:
                logger.warning("Failed to persist weighted matching run: %s", ex)

        if self.audit_repo:
            try:
                ts = datetime.now(timezone.utc).isoformat()
                self.audit_repo.create(
                    AuditLog(
                        id=None,
                        entity_type="MATCHING",
                        entity_id=None,
                        action="WEIGHTED_MATCHING",
                        details=f"Executed Maximum Weight Matching: {result.total_matches} pairs, total weight {result.total_weight}.",
                        created_at=ts,
                    )
                )
            except Exception:
                pass

        return result

    @staticmethod
    def compare_matching_results(
        max_result: MatchingResult,
        weighted_result: WeightedMatchingResult,
    ) -> dict[str, Any]:
        """Compute set differences, score trade-offs, and coverage comparisons between algorithms."""
        max_pair_keys = {(p["donor_id"], p["recipient_id"]): p for p in max_result.matched_pairs}
        weighted_pair_keys = {(p["donor_id"], p["recipient_id"]): p for p in weighted_result.matched_pairs}

        common_keys = set(max_pair_keys.keys()) & set(weighted_pair_keys.keys())
        max_only_keys = set(max_pair_keys.keys()) - set(weighted_pair_keys.keys())
        weighted_only_keys = set(weighted_pair_keys.keys()) - set(max_pair_keys.keys())

        common_matches = [max_pair_keys[k] for k in common_keys]
        max_only_matches = [max_pair_keys[k] for k in max_only_keys]
        weighted_only_matches = [weighted_pair_keys[k] for k in weighted_only_keys]

        max_total_score = sum(p["compatibility_score"] for p in max_result.matched_pairs)
        max_avg_score = (max_total_score / max_result.total_matches) if max_result.total_matches > 0 else 0.0

        unmatched_donors_both = sorted(list(set(max_result.unmatched_donors) & set(weighted_result.unmatched_donors)))
        unmatched_recipients_both = sorted(list(set(max_result.unmatched_recipients) & set(weighted_result.unmatched_recipients)))

        return {
            "cardinality": {
                "matches": max_result.total_matches,
                "total_score": round(max_total_score, 2),
                "average_score": round(max_avg_score, 2),
                "donor_coverage": max_result.donor_coverage,
                "recipient_coverage": max_result.recipient_coverage,
                "unmatched_donors": len(max_result.unmatched_donors),
                "unmatched_recipients": len(max_result.unmatched_recipients),
                "execution_time_ms": max_result.execution_time_ms,
            },
            "weighted": {
                "matches": weighted_result.total_matches,
                "total_score": weighted_result.total_weight,
                "average_score": weighted_result.average_weight,
                "donor_coverage": weighted_result.donor_coverage,
                "recipient_coverage": weighted_result.recipient_coverage,
                "unmatched_donors": len(weighted_result.unmatched_donors),
                "unmatched_recipients": len(weighted_result.unmatched_recipients),
                "execution_time_ms": weighted_result.execution_time_ms,
            },
            "common_matches": common_matches,
            "max_only_matches": max_only_matches,
            "weighted_only_matches": weighted_only_matches,
            "common_count": len(common_matches),
            "max_only_count": len(max_only_matches),
            "weighted_only_count": len(weighted_only_matches),
            "unmatched_donors_both": unmatched_donors_both,
            "unmatched_recipients_both": unmatched_recipients_both,
        }
