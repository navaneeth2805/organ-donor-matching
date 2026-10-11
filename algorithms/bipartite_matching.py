"""Maximum Cardinality Bipartite Matching Algorithm Implementation."""

from dataclasses import asdict, dataclass
import time
from typing import Any
import networkx as nx
from networkx.algorithms import bipartite


@dataclass
class MatchingResult:
    """Encapsulates the output of a maximum cardinality bipartite matching."""

    algorithm: str
    matched_pairs: list[dict[str, Any]]  # List of normalized dicts with donor_id, recipient_id, weight, etc.
    unmatched_donors: list[str]
    unmatched_recipients: list[str]
    total_matches: int
    donor_count: int
    recipient_count: int
    donor_coverage: float
    recipient_coverage: float
    execution_time_ms: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MaximumBipartiteMatching:
    """Executes Maximum Cardinality Bipartite Matching on a donor-recipient graph.

    Objective: Maximize the absolute number of donor-recipient pairs selected
    from the eligible compatibility graph. Does not prioritize edge weights.
    """

    @classmethod
    def match(cls, graph: nx.Graph) -> MatchingResult:
        """Run Hopcroft-Karp maximum cardinality matching on the bipartite graph."""
        start_time = time.perf_counter()

        if graph is None or len(graph.nodes) == 0:
            return MatchingResult(
                algorithm="Maximum Cardinality Bipartite Matching",
                matched_pairs=[],
                unmatched_donors=[],
                unmatched_recipients=[],
                total_matches=0,
                donor_count=0,
                recipient_count=0,
                donor_coverage=0.0,
                recipient_coverage=0.0,
                execution_time_ms=0.0,
            )

        # Extract partitions
        donor_nodes = {n for n, d in graph.nodes(data=True) if d.get("bipartite") == 0 or d.get("node_type") == "donor"}
        recipient_nodes = {n for n, d in graph.nodes(data=True) if d.get("bipartite") == 1 or d.get("node_type") == "recipient"}

        # Execute maximum matching
        # nx.bipartite.maximum_matching returns a dictionary where both u->v and v->u are present
        raw_matching = bipartite.maximum_matching(graph, top_nodes=donor_nodes)

        # Normalize into unique (donor_id, recipient_id) pairs
        matched_pairs: list[dict[str, Any]] = []
        matched_donors = set()
        matched_recipients = set()

        for node, partner in raw_matching.items():
            # Only process each pair once, starting from donor
            if node in donor_nodes and partner in recipient_nodes:
                matched_donors.add(node)
                matched_recipients.add(partner)

                edge_data = graph.get_edge_data(node, partner, default={})
                weight = float(edge_data.get("weight", edge_data.get("compatibility_score", 0.0)))

                matched_pairs.append({
                    "donor_id": node,
                    "recipient_id": partner,
                    "weight": weight,
                    "compatibility_score": weight,
                    "status": edge_data.get("status", "POTENTIAL_CANDIDATE"),
                    "organ": edge_data.get("organ") or graph.nodes[node].get("organ"),
                    "details": edge_data,
                })

        # Sort matches descending by score for consistent deterministic display
        matched_pairs.sort(key=lambda x: x["compatibility_score"], reverse=True)

        unmatched_donors = sorted(list(donor_nodes - matched_donors))
        unmatched_recipients = sorted(list(recipient_nodes - matched_recipients))

        donor_count = len(donor_nodes)
        recipient_count = len(recipient_nodes)
        total_matches = len(matched_pairs)

        donor_cov = (total_matches / donor_count * 100.0) if donor_count > 0 else 0.0
        recip_cov = (total_matches / recipient_count * 100.0) if recipient_count > 0 else 0.0

        execution_time_ms = (time.perf_counter() - start_time) * 1000.0

        return MatchingResult(
            algorithm="Maximum Cardinality Bipartite Matching",
            matched_pairs=matched_pairs,
            unmatched_donors=unmatched_donors,
            unmatched_recipients=unmatched_recipients,
            total_matches=total_matches,
            donor_count=donor_count,
            recipient_count=recipient_count,
            donor_coverage=round(donor_cov, 2),
            recipient_coverage=round(recip_cov, 2),
            execution_time_ms=round(execution_time_ms, 3),
        )
