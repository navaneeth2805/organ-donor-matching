"""Bipartite Graph Builder and Validator for Organ Donor Matching Network."""

from dataclasses import asdict, dataclass
from typing import Any
import networkx as nx

from database.models import CompatibilityResult, Donor, Recipient


@dataclass
class GraphNode:
    """Represents a node in the bipartite donor-recipient graph."""

    node_id: str
    node_type: str  # 'donor' or 'recipient'
    entity_id: int
    display_name: str
    blood_group: str | None
    organ: str | None
    hospital: str | None
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class GraphEdge:
    """Represents an edge between donor and recipient in the bipartite graph."""

    donor_id: str
    recipient_id: str
    weight: float
    compatibility_score: float
    status: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class GraphValidator:
    """Validates structural integrity, partition constraints, and weights of bipartite graphs."""

    @staticmethod
    def validate(graph: nx.Graph) -> tuple[bool, list[str]]:
        """Validate bipartite constraints, partition sets, weights, and attributes.

        Returns (is_valid, error_messages).
        """
        errors: list[str] = []

        if graph is None:
            return False, ["Graph instance is None."]

        if len(graph.nodes) == 0:
            return True, []  # Empty graph is trivially valid

        # Verify bipartite partition attribute
        donor_nodes = set()
        recipient_nodes = set()

        for node_id, data in graph.nodes(data=True):
            bipartite_val = data.get("bipartite")
            node_type = data.get("node_type")

            if bipartite_val is None:
                errors.append(f"Node '{node_id}' is missing required 'bipartite' attribute.")
            elif bipartite_val == 0:
                donor_nodes.add(node_id)
                if node_type != "donor":
                    errors.append(f"Node '{node_id}' with bipartite=0 must have node_type='donor', got '{node_type}'.")
            elif bipartite_val == 1:
                recipient_nodes.add(node_id)
                if node_type != "recipient":
                    errors.append(f"Node '{node_id}' with bipartite=1 must have node_type='recipient', got '{node_type}'.")
            else:
                errors.append(f"Node '{node_id}' has invalid bipartite partition '{bipartite_val}' (must be 0 or 1).")

        # Verify edge endpoints and no intra-partition edges
        for u, v, data in graph.edges(data=True):
            u_bipartite = graph.nodes[u].get("bipartite")
            v_bipartite = graph.nodes[v].get("bipartite")

            if u_bipartite is None or v_bipartite is None:
                errors.append(f"Edge ({u}, {v}) connects nodes with undefined partitions.")
                continue

            if u_bipartite == v_bipartite:
                if u_bipartite == 0:
                    errors.append(f"Invalid donor-donor edge detected between '{u}' and '{v}'.")
                else:
                    errors.append(f"Invalid recipient-recipient edge detected between '{u}' and '{v}'.")

            # Verify edge weights
            weight = data.get("weight")
            if weight is None:
                errors.append(f"Edge ({u}, {v}) missing 'weight' attribute.")
            elif not isinstance(weight, (int, float)):
                errors.append(f"Edge ({u}, {v}) weight '{weight}' is not numeric.")
            elif weight < 0 or weight > 100.01:
                errors.append(f"Edge ({u}, {v}) weight {weight} out of expected clinical range [0, 100].")

        # Check NetworkX is_bipartite
        if not errors and not nx.is_bipartite(graph):
            errors.append("NetworkX graph verification failed: graph is not bipartite.")

        return len(errors) == 0, errors


class BipartiteGraphBuilder:
    """Constructs NetworkX bipartite graphs from Phase 3 candidate compatibility results."""

    @staticmethod
    def format_donor_id(entity_id: int) -> str:
        """Standardized donor node identifier."""
        return f"DONOR_D{entity_id:03d}" if entity_id < 1000 else f"DONOR_D{entity_id}"

    @staticmethod
    def format_recipient_id(entity_id: int) -> str:
        """Standardized recipient node identifier."""
        return f"RECIPIENT_R{entity_id:03d}" if entity_id < 1000 else f"RECIPIENT_R{entity_id}"

    @classmethod
    def build_from_candidates(
        cls,
        candidates: list[CompatibilityResult],
        donors_map: dict[int, Donor] | None = None,
        recipients_map: dict[int, Recipient] | None = None,
        include_review: bool = False,
        min_score: float = 0.0,
        eligible_only: bool = True,
    ) -> nx.Graph:
        """Construct a bipartite NetworkX graph from evaluated Phase 3 candidate pairs."""
        G = nx.Graph()
        donors_map = donors_map or {}
        recipients_map = recipients_map or {}

        # Track added nodes to populate attributes
        for cand in candidates:
            # Check edge status eligibility
            status = cand.status.upper() if cand.status else "INCOMPATIBLE"

            if eligible_only:
                if status == "POTENTIAL_CANDIDATE":
                    pass
                elif status == "REQUIRES_REVIEW" and include_review:
                    pass
                else:
                    # Incompatible, insufficient data, or excluded review edge
                    continue

            if cand.score < min_score:
                continue

            d_id = cand.donor_id
            r_id = cand.recipient_id

            d_node_id = cls.format_donor_id(d_id)
            r_node_id = cls.format_recipient_id(r_id)

            # Add donor node if not present
            if d_node_id not in G:
                d_obj = donors_map.get(d_id)
                d_meta = {
                    "entity_type": "donor",
                    "entity_id": d_id,
                    "name": d_obj.name if d_obj else (cand.donor_name or f"Donor {d_id}"),
                    "blood_group": d_obj.blood_group if d_obj else cand.donor_blood_group,
                    "organ": d_obj.organ if d_obj else cand.organ,
                    "hospital": (d_obj.hospital_name or d_obj.location) if d_obj else cand.donor_hospital,
                    "availability": d_obj.availability if d_obj else "Available",
                }
                G.add_node(
                    d_node_id,
                    bipartite=0,
                    node_type="donor",
                    entity_id=d_id,
                    label=f"D{d_id}",
                    display_name=d_meta["name"],
                    blood_group=d_meta["blood_group"],
                    organ=d_meta["organ"],
                    hospital=d_meta["hospital"],
                    metadata=d_meta,
                )

            # Add recipient node if not present
            if r_node_id not in G:
                r_obj = recipients_map.get(r_id)
                r_meta = {
                    "entity_type": "recipient",
                    "entity_id": r_id,
                    "name": r_obj.name if r_obj else (cand.recipient_name or f"Recipient {r_id}"),
                    "blood_group": r_obj.blood_group if r_obj else cand.recipient_blood_group,
                    "organ": r_obj.organ_needed if r_obj else cand.organ,
                    "hospital": (r_obj.hospital_name or r_obj.location) if r_obj else cand.recipient_hospital,
                    "urgency": r_obj.urgency if r_obj else (cand.urgency or "Standard"),
                    "waiting_time": r_obj.waiting_time_days if r_obj else (cand.waiting_time_days or 0),
                }
                G.add_node(
                    r_node_id,
                    bipartite=1,
                    node_type="recipient",
                    entity_id=r_id,
                    label=f"R{r_id}",
                    display_name=r_meta["name"],
                    blood_group=r_meta["blood_group"],
                    organ=r_meta["organ"],
                    hospital=r_meta["hospital"],
                    urgency=r_meta["urgency"],
                    waiting_time=r_meta["waiting_time"],
                    metadata=r_meta,
                )

            # Add edge preserving all Phase 3 multi-criteria scores
            weight = float(cand.score)
            G.add_edge(
                d_node_id,
                r_node_id,
                weight=weight,
                compatibility_score=weight,
                blood_score=float(cand.blood_score),
                organ_score=float(cand.organ_score),
                clinical_score=float(cand.clinical_score),
                urgency_score=float(cand.urgency_score),
                waiting_time_score=float(cand.waiting_time_score),
                hla_score=float(cand.hla_score),
                geographic_score=float(cand.geographic_score),
                data_quality_score=float(cand.data_quality_score),
                status=status,
                rule_version=cand.rule_version,
                evaluated_at=cand.evaluated_at,
                hard_failures=cand.hard_failures,
                warnings=cand.warnings,
                explanations=cand.explanations,
            )

        # Also add any standalone donors/recipients if passed in maps to preserve isolated nodes
        for d_id, d_obj in donors_map.items():
            d_node_id = cls.format_donor_id(d_id)
            if d_node_id not in G:
                d_meta = {
                    "entity_type": "donor",
                    "entity_id": d_id,
                    "name": d_obj.name,
                    "blood_group": d_obj.blood_group,
                    "organ": d_obj.organ,
                    "hospital": d_obj.hospital_name or d_obj.location,
                    "availability": d_obj.availability,
                }
                G.add_node(
                    d_node_id,
                    bipartite=0,
                    node_type="donor",
                    entity_id=d_id,
                    label=f"D{d_id}",
                    display_name=d_meta["name"],
                    blood_group=d_meta["blood_group"],
                    organ=d_meta["organ"],
                    hospital=d_meta["hospital"],
                    metadata=d_meta,
                )

        for r_id, r_obj in recipients_map.items():
            r_node_id = cls.format_recipient_id(r_id)
            if r_node_id not in G:
                r_meta = {
                    "entity_type": "recipient",
                    "entity_id": r_id,
                    "name": r_obj.name,
                    "blood_group": r_obj.blood_group,
                    "organ": r_obj.organ_needed,
                    "hospital": r_obj.hospital_name or r_obj.location,
                    "urgency": r_obj.urgency,
                    "waiting_time": r_obj.waiting_time_days,
                }
                G.add_node(
                    r_node_id,
                    bipartite=1,
                    node_type="recipient",
                    entity_id=r_id,
                    label=f"R{r_id}",
                    display_name=r_meta["name"],
                    blood_group=r_meta["blood_group"],
                    organ=r_meta["organ"],
                    hospital=r_meta["hospital"],
                    urgency=r_meta["urgency"],
                    waiting_time=r_meta["waiting_time"],
                    metadata=r_meta,
                )

        return G
