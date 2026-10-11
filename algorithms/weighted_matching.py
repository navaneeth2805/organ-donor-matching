"""Maximum Weight Bipartite Matching Algorithm Implementation."""

from dataclasses import asdict, dataclass
import time
from typing import Any
import networkx as nx


@dataclass
class WeightedMatchingResult:
    """Encapsulates the output of a maximum weight bipartite matching."""

    algorithm: str
    matched_pairs: list[dict[str, Any]]
    total_matches: int
    total_weight: float
    average_weight: float
    unmatched_donors: list[str]
    unmatched_recipients: list[str]
    donor_count: int
    recipient_count: int
    donor_coverage: float
    recipient_coverage: float
    execution_time_ms: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MaximumWeightMatching:
    """Executes Maximum Weight Matching on a weighted donor-recipient graph.

    Objective: Maximize the aggregate sum of edge weights (Phase 3 software
    compatibility scores) among the chosen disjoint candidate pairs.
    Note: A weighted matching algorithm can choose fewer pairs if that produces
    a higher total score.
    """

    @classmethod
    def match(cls, graph: nx.Graph, maxcardinality: bool = False) -> WeightedMatchingResult:
        """Run NetworkX max_weight_matching on the weighted bipartite graph."""
        start_time = time.perf_counter()

        if graph is None or len(graph.nodes) == 0 or len(graph.edges) == 0:
            return WeightedMatchingResult(
                algorithm="Maximum Weight Matching",
                matched_pairs=[],
                total_matches=0,
                total_weight=0.0,
                average_weight=0.0,
                unmatched_donors=[],
                unmatched_recipients=[],
                donor_count=0,
                recipient_count=0,
                donor_coverage=0.0,
                recipient_coverage=0.0,
                execution_time_ms=0.0,
            )

        # Extract partitions
        donor_nodes = {n for n, d in graph.nodes(data=True) if d.get("bipartite") == 0 or d.get("node_type") == "donor"}
        recipient_nodes = {n for n, d in graph.nodes(data=True) if d.get("bipartite") == 1 or d.get("node_type") == "recipient"}

        # NetworkX max_weight_matching returns a set of unordered 2-tuples {(u, v), ...}
        raw_edges = nx.max_weight_matching(graph, maxcardinality=maxcardinality, weight="weight")

        matched_pairs: list[dict[str, Any]] = []
        matched_donors = set()
        matched_recipients = set()
        total_weight = 0.0

        for u, v in raw_edges:
            # Orient into donor -> recipient
            if u in donor_nodes and v in recipient_nodes:
                d_node, r_node = u, v
            elif v in donor_nodes and u in recipient_nodes:
                d_node, r_node = v, u
            else:
                # Should not happen on a valid bipartite graph, but handle gracefully
                d_node, r_node = (u, v) if "DONOR" in str(u) else (v, u)

            matched_donors.add(d_node)
            matched_recipients.add(r_node)

            edge_data = graph.get_edge_data(u, v, default={})
            score = float(edge_data.get("weight", edge_data.get("compatibility_score", 0.0)))
            total_weight += score

            matched_pairs.append({
                "donor_id": d_node,
                "recipient_id": r_node,
                "weight": score,
                "compatibility_score": score,
                "status": edge_data.get("status", "POTENTIAL_CANDIDATE"),
                "organ": edge_data.get("organ") or graph.nodes.get(d_node, {}).get("organ"),
                "details": edge_data,
            })

        # Sort matches descending by score
        matched_pairs.sort(key=lambda x: x["compatibility_score"], reverse=True)

        unmatched_donors = sorted(list(donor_nodes - matched_donors))
        unmatched_recipients = sorted(list(recipient_nodes - matched_recipients))

        donor_count = len(donor_nodes)
        recipient_count = len(recipient_nodes)
        total_matches = len(matched_pairs)
        avg_weight = (total_weight / total_matches) if total_matches > 0 else 0.0

        donor_cov = (total_matches / donor_count * 100.0) if donor_count > 0 else 0.0
        recip_cov = (total_matches / recipient_count * 100.0) if recipient_count > 0 else 0.0

        execution_time_ms = (time.perf_counter() - start_time) * 1000.0

        return WeightedMatchingResult(
            algorithm="Maximum Weight Matching",
            matched_pairs=matched_pairs,
            total_matches=total_matches,
            total_weight=round(total_weight, 2),
            average_weight=round(avg_weight, 2),
            unmatched_donors=unmatched_donors,
            unmatched_recipients=unmatched_recipients,
            donor_count=donor_count,
            recipient_count=recipient_count,
            donor_coverage=round(donor_cov, 2),
            recipient_coverage=round(recip_cov, 2),
            execution_time_ms=round(execution_time_ms, 3),
        )
