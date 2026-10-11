"""Graph Engine orchestrating bipartite graph operations and clinical network queries."""

import time
from typing import Any
import networkx as nx

from algorithms.graph_builder import BipartiteGraphBuilder, GraphValidator
from algorithms.graph_metrics import GraphMetricsCalculator
from config.logging_config import get_logger
from database.models import CompatibilityResult, Donor, Recipient
from database.repositories import AuditLogRepository

logger = get_logger("modules.graph_engine")


class GraphEngine:
    """Central operational interface for graph construction, filtering, and inspection."""

    def __init__(self, audit_repo: AuditLogRepository | None = None):
        self.audit_repo = audit_repo
        self._graph: nx.Graph = nx.Graph()
        self._last_built_at: str | None = None
        self._rule_version: str = "3.0"
        self._source_candidate_count: int = 0

    @property
    def graph(self) -> nx.Graph:
        """Access the underlying NetworkX graph."""
        return self._graph

    def build(
        self,
        candidates: list[CompatibilityResult],
        donors_map: dict[int, Donor] | None = None,
        recipients_map: dict[int, Recipient] | None = None,
        include_review: bool = False,
        min_score: float = 0.0,
    ) -> nx.Graph:
        """Construct the bipartite compatibility graph from Phase 3 candidate pairs."""
        start_time = time.perf_counter()

        self._graph = BipartiteGraphBuilder.build_from_candidates(
            candidates=candidates,
            donors_map=donors_map,
            recipients_map=recipients_map,
            include_review=include_review,
            min_score=min_score,
            eligible_only=True,
        )

        self._source_candidate_count = len(candidates)
        if candidates and hasattr(candidates[0], "rule_version"):
            self._rule_version = candidates[0].rule_version or "3.0"

        build_time_ms = (time.perf_counter() - start_time) * 1000.0

        is_valid, errors = self.validate()
        logger.info(
            "Graph built with %d nodes and %d edges in %.2f ms (Valid: %s)",
            self._graph.number_of_nodes(),
            self._graph.number_of_edges(),
            build_time_ms,
            is_valid,
        )

        if self.audit_repo:
            try:
                from datetime import datetime, timezone
                ts = datetime.now(timezone.utc).isoformat()
                from database.models import AuditLog
                self.audit_repo.create(
                    AuditLog(
                        id=None,
                        entity_type="GRAPH",
                        entity_id=None,
                        action="BUILD_GRAPH",
                        details=f"Constructed bipartite graph with {self._graph.number_of_nodes()} nodes, {self._graph.number_of_edges()} edges from {len(candidates)} candidates.",
                        created_at=ts,
                    )
                )
            except Exception as ex:
                logger.warning("Failed to record audit log for graph build: %s", ex)

        return self._graph

    def validate(self) -> tuple[bool, list[str]]:
        """Validate bipartite structural integrity and edge weights."""
        return GraphValidator.validate(self._graph)

    def get_metrics(self) -> dict[str, Any]:
        """Compute full graph metrics."""
        return GraphMetricsCalculator.calculate(self._graph)

    def get_nodes(self) -> list[dict[str, Any]]:
        """Return all node representations with full metadata."""
        nodes = []
        for node_id, data in self._graph.nodes(data=True):
            nodes.append({
                "node_id": node_id,
                "node_type": data.get("node_type", "unknown"),
                "entity_id": data.get("entity_id"),
                "display_name": data.get("display_name", node_id),
                "blood_group": data.get("blood_group"),
                "organ": data.get("organ"),
                "hospital": data.get("hospital"),
                "degree": self._graph.degree(node_id),
                "metadata": data.get("metadata", {}),
            })
        return nodes

    def get_donor_nodes(self) -> list[dict[str, Any]]:
        """Return only donor partition nodes."""
        return [n for n in self.get_nodes() if n["node_type"] == "donor"]

    def get_recipient_nodes(self) -> list[dict[str, Any]]:
        """Return only recipient partition nodes."""
        return [n for n in self.get_nodes() if n["node_type"] == "recipient"]

    def get_edges(self) -> list[dict[str, Any]]:
        """Return all edge records with full compatibility attributes."""
        edges = []
        for u, v, data in self._graph.edges(data=True):
            # Normalise u as donor, v as recipient
            d_node = u if self._graph.nodes[u].get("node_type") == "donor" else v
            r_node = v if d_node == u else u

            edges.append({
                "donor_id": d_node,
                "recipient_id": r_node,
                "weight": data.get("weight", 0.0),
                "compatibility_score": data.get("compatibility_score", 0.0),
                "status": data.get("status", "POTENTIAL_CANDIDATE"),
                "blood_score": data.get("blood_score", 0.0),
                "organ_score": data.get("organ_score", 0.0),
                "clinical_score": data.get("clinical_score", 0.0),
                "urgency_score": data.get("urgency_score", 0.0),
                "waiting_time_score": data.get("waiting_time_score", 0.0),
                "hla_score": data.get("hla_score", 0.0),
                "geographic_score": data.get("geographic_score", 0.0),
                "rule_version": data.get("rule_version", "3.0"),
            })
        return edges

    def get_candidate_edges(self) -> list[dict[str, Any]]:
        """Alias for get_edges."""
        return self.get_edges()

    def filter_graph(
        self,
        organ: str | None = None,
        donor_blood_group: str | None = None,
        recipient_blood_group: str | None = None,
        hospital: str | None = None,
        min_score: float = 0.0,
        max_score: float = 100.0,
        urgency: str | None = None,
        candidate_status: str | None = None,
    ) -> nx.Graph:
        """Create a filtered induced subgraph without rebuilding database datasets."""
        subG = nx.Graph()

        # Filter edges based on criteria
        eligible_edges = []
        for u, v, data in self._graph.edges(data=True):
            score = data.get("compatibility_score", data.get("weight", 0.0))
            if score < min_score or score > max_score:
                continue

            status = data.get("status", "POTENTIAL_CANDIDATE")
            if candidate_status and status != candidate_status:
                continue

            d_node = u if self._graph.nodes[u].get("node_type") == "donor" else v
            r_node = v if d_node == u else u

            d_data = self._graph.nodes[d_node]
            r_data = self._graph.nodes[r_node]

            if organ and d_data.get("organ") != organ and r_data.get("organ") != organ:
                continue

            if donor_blood_group and d_data.get("blood_group") != donor_blood_group:
                continue

            if recipient_blood_group and r_data.get("blood_group") != recipient_blood_group:
                continue

            if hospital and hospital not in [d_data.get("hospital"), r_data.get("hospital")]:
                continue

            if urgency and r_data.get("urgency") != urgency:
                continue

            eligible_edges.append((u, v, data))

        # Add filtered edges and their endpoint nodes
        for u, v, data in eligible_edges:
            if u not in subG:
                subG.add_node(u, **self._graph.nodes[u])
            if v not in subG:
                subG.add_node(v, **self._graph.nodes[v])
            subG.add_edge(u, v, **data)

        if self.audit_repo:
            try:
                from datetime import datetime, timezone
                ts = datetime.now(timezone.utc).isoformat()
                from database.models import AuditLog
                self.audit_repo.create(
                    AuditLog(
                        id=None,
                        entity_type="GRAPH",
                        entity_id=None,
                        action="FILTER_GRAPH",
                        details=f"Filtered graph yielded {subG.number_of_nodes()} nodes, {subG.number_of_edges()} edges.",
                        created_at=ts,
                    )
                )
            except Exception:
                pass

        return subG
