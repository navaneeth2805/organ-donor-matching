"""Comprehensive Unit and Integration Test Suite for Phase 4: Graph Theory & Matching Engine."""

import os
import tempfile
import networkx as nx
import pytest

from algorithms.bipartite_matching import MaximumBipartiteMatching
from algorithms.centrality import CentralityAnalyzer
from algorithms.connected_components import ConnectedComponentAnalyzer
from algorithms.graph_builder import (
    BipartiteGraphBuilder,
    GraphEdge,
    GraphNode,
    GraphValidator,
)
from algorithms.graph_metrics import GraphMetricsCalculator
from algorithms.graph_paths import GraphPathEngine
from algorithms.vertex_degree import VertexDegreeAnalyzer
from algorithms.weighted_matching import MaximumWeightMatching
from database.database import DatabaseManager
from database.models import CompatibilityResult, Donor, MatchingRun, Recipient
from database.repositories import CompatibilityRepository, MatchingRunRepository
from modules.graph_analytics import GraphAnalyticsService
from modules.graph_engine import GraphEngine
from modules.matching_engine import MatchingEngine


@pytest.fixture
def memory_db():
    """Isolated SQLite database initialized with full migrations."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db = DatabaseManager(path)
    db.initialize()
    yield db
    if os.path.exists(path):
        try:
            os.unlink(path)
        except Exception:
            pass


@pytest.fixture
def sample_bipartite_graph():
    """Constructs a deterministic sample bipartite graph for algorithm testing."""
    G = nx.Graph()
    # Donors (bipartite = 0)
    G.add_node("DONOR_D1", bipartite=0, node_type="donor", display_name="Donor 1", organ="Kidney", blood_group="O+")
    G.add_node("DONOR_D2", bipartite=0, node_type="donor", display_name="Donor 2", organ="Liver", blood_group="A+")
    G.add_node("DONOR_D3", bipartite=0, node_type="donor", display_name="Donor 3", organ="Heart", blood_group="B+")
    G.add_node("DONOR_D4", bipartite=0, node_type="donor", display_name="Donor 4 (Isolated)", organ="Lung", blood_group="AB+")

    # Recipients (bipartite = 1)
    G.add_node("RECIPIENT_R1", bipartite=1, node_type="recipient", display_name="Recipient 1", organ="Kidney", blood_group="O+", urgency="High")
    G.add_node("RECIPIENT_R2", bipartite=1, node_type="recipient", display_name="Recipient 2", organ="Liver", blood_group="A+", urgency="Critical")
    G.add_node("RECIPIENT_R3", bipartite=1, node_type="recipient", display_name="Recipient 3", organ="Heart", blood_group="B+", urgency="Medium")
    G.add_node("RECIPIENT_R4", bipartite=1, node_type="recipient", display_name="Recipient 4 (Isolated)", organ="Lung", blood_group="AB+", urgency="Low")

    # Edges
    G.add_edge("DONOR_D1", "RECIPIENT_R1", weight=85.0, compatibility_score=85.0, status="POTENTIAL_CANDIDATE")
    G.add_edge("DONOR_D1", "RECIPIENT_R2", weight=60.0, compatibility_score=60.0, status="POTENTIAL_CANDIDATE")
    G.add_edge("DONOR_D2", "RECIPIENT_R2", weight=90.0, compatibility_score=90.0, status="POTENTIAL_CANDIDATE")
    G.add_edge("DONOR_D3", "RECIPIENT_R3", weight=75.0, compatibility_score=75.0, status="POTENTIAL_CANDIDATE")

    return G


# 1. Graph Builder Tests
def test_graph_builder_empty():
    G = BipartiteGraphBuilder.build_from_candidates([])
    assert isinstance(G, nx.Graph)
    assert len(G.nodes) == 0
    assert len(G.edges) == 0


def test_graph_builder_with_candidates():
    candidates = [
        CompatibilityResult(
            id=1,
            donor_id=10,
            recipient_id=20,
            status="POTENTIAL_CANDIDATE",
            score=88.5,
            blood_score=100.0,
            organ_score=90.0,
            clinical_score=85.0,
            urgency_score=80.0,
            waiting_time_score=70.0,
            hla_score=85.0,
            geographic_score=90.0,
            data_quality_score=95.0,
            hard_failures=[],
            warnings=[],
            explanations=["Blood group compatible", "Organ size matched"],
            rule_version="3.0",
            evaluated_at="2026-09-08T00:00:00",
            created_at="2026-09-08T00:00:00",
            updated_at="2026-09-08T00:00:00",
        )
    ]
    G = BipartiteGraphBuilder.build_from_candidates(candidates)
    assert G.number_of_nodes() == 2
    assert G.number_of_edges() == 1
    assert "DONOR_D010" in G or "DONOR_D10" in G
    assert "RECIPIENT_R020" in G or "RECIPIENT_R20" in G
    d_node = "DONOR_D010" if "DONOR_D010" in G else "DONOR_D10"
    r_node = "RECIPIENT_R020" if "RECIPIENT_R020" in G else "RECIPIENT_R20"
    assert G.nodes[d_node]["bipartite"] == 0
    assert G.nodes[r_node]["bipartite"] == 1
    assert G[d_node][r_node]["weight"] == 88.5


# 2. Graph Validator Tests
def test_graph_validator_valid(sample_bipartite_graph):
    is_valid, errors = GraphValidator.validate(sample_bipartite_graph)
    assert is_valid is True
    assert len(errors) == 0


def test_graph_validator_non_bipartite():
    bad_G = nx.Graph()
    bad_G.add_node("DONOR_D1", bipartite=0, node_type="donor")
    bad_G.add_node("DONOR_D2", bipartite=0, node_type="donor")
    # Illegal edge within donor partition!
    bad_G.add_edge("DONOR_D1", "DONOR_D2", weight=50.0)

    is_valid, errors = GraphValidator.validate(bad_G)
    assert is_valid is False
    assert any("donor-donor" in e.lower() or "not bipartite" in e.lower() or "same partition" in e.lower() for e in errors)


def test_graph_validator_out_of_bounds_weight():
    bad_G = nx.Graph()
    bad_G.add_node("DONOR_D1", bipartite=0, node_type="donor")
    bad_G.add_node("RECIPIENT_R1", bipartite=1, node_type="recipient")
    bad_G.add_edge("DONOR_D1", "RECIPIENT_R1", weight=150.0)  # > 100

    is_valid, errors = GraphValidator.validate(bad_G)
    assert is_valid is False
    assert any("clinical range" in e.lower() or "out of expected" in e.lower() or "out of bounds" in e.lower() for e in errors)


# 3. Maximum Cardinality Bipartite Matching
def test_maximum_bipartite_matching(sample_bipartite_graph):
    res = MaximumBipartiteMatching.match(sample_bipartite_graph)
    assert res.total_matches == 3
    assert len(res.matched_pairs) == 3
    assert "DONOR_D4" in res.unmatched_donors
    assert "RECIPIENT_R4" in res.unmatched_recipients
    assert res.donor_count == 4
    assert res.recipient_count == 4
    assert res.donor_coverage == 75.0
    assert res.recipient_coverage == 75.0
    assert res.execution_time_ms >= 0.0

    # Verify normalization into (donor_id, recipient_id)
    for p in res.matched_pairs:
        assert p["donor_id"].startswith("DONOR_")
        assert p["recipient_id"].startswith("RECIPIENT_")


# 4. Maximum Weight Matching
def test_maximum_weight_matching(sample_bipartite_graph):
    res = MaximumWeightMatching.match(sample_bipartite_graph)
    assert res.total_matches == 3
    assert res.total_weight == 85.0 + 90.0 + 75.0  # 250.0
    assert res.average_weight == round(250.0 / 3, 2)
    assert "DONOR_D4" in res.unmatched_donors
    assert "RECIPIENT_R4" in res.unmatched_recipients

    # Verify each pair has donor_id and recipient_id
    for p in res.matched_pairs:
        assert p["donor_id"].startswith("DONOR_")
        assert p["recipient_id"].startswith("RECIPIENT_")


# 5. Graph Path Engine
def test_graph_path_engine(sample_bipartite_graph):
    path_engine = GraphPathEngine(sample_bipartite_graph)

    # Direct connection: D1 to R1 (1 hop)
    assert path_engine.is_connected("DONOR_D1", "RECIPIENT_R1") is True
    path = path_engine.find_shortest_path("DONOR_D1", "RECIPIENT_R1")
    assert path == ["DONOR_D1", "RECIPIENT_R1"]
    assert path_engine.get_path_length("DONOR_D1", "RECIPIENT_R1") == 1

    # 2 hops: D1 -> R2 -> D2
    path_2 = path_engine.find_shortest_path("DONOR_D1", "DONOR_D2")
    assert path_2 == ["DONOR_D1", "RECIPIENT_R2", "DONOR_D2"]
    assert path_engine.get_path_length("DONOR_D1", "DONOR_D2") == 2

    # Isolated node: D4 to R1
    assert path_engine.is_connected("DONOR_D4", "RECIPIENT_R1") is False
    assert path_engine.find_shortest_path("DONOR_D4", "RECIPIENT_R1") is None
    assert path_engine.get_path_length("DONOR_D4", "RECIPIENT_R1") is None

    # Source == target
    assert path_engine.find_shortest_path("DONOR_D1", "DONOR_D1") == ["DONOR_D1"]
    assert path_engine.get_path_length("DONOR_D1", "DONOR_D1") == 0

    # Non-existent node
    assert path_engine.find_shortest_path("DONOR_999", "RECIPIENT_R1") is None


# 6. Vertex Degree Analyzer
def test_vertex_degree_analyzer(sample_bipartite_graph):
    analyzer = VertexDegreeAnalyzer(sample_bipartite_graph)
    summary = analyzer.get_degree_summary()

    assert summary["total_nodes"] == 8
    # D1 has degree 2 (R1, R2); D2 has 1; D3 has 1; D4 has 0
    assert summary["donor_degrees"]["DONOR_D1"] == 2
    assert summary["donor_degrees"]["DONOR_D4"] == 0
    assert summary["highest_degree_donor"]["node_id"] == "DONOR_D1"
    assert summary["lowest_degree_donor"]["node_id"] == "DONOR_D4"


# 7. Centrality Analyzer
def test_centrality_analyzer(sample_bipartite_graph):
    analyzer = CentralityAnalyzer(sample_bipartite_graph)
    all_cents = analyzer.get_all_centralities()

    assert len(all_cents) == 8
    d1_entry = next(c for c in all_cents if c["node_id"] == "DONOR_D1")
    assert d1_entry["degree"] == 2
    assert d1_entry["degree_centrality"] > 0
    # D4 isolated has degree 0
    d4_entry = next(c for c in all_cents if c["node_id"] == "DONOR_D4")
    assert d4_entry["degree"] == 0
    assert d4_entry["degree_centrality"] == 0.0


# 8. Connected Components Analyzer
def test_connected_components_analyzer(sample_bipartite_graph):
    analyzer = ConnectedComponentAnalyzer(sample_bipartite_graph)
    assert analyzer.number_of_components() == 4  # {D1, R1, D2, R2}, {D3, R3}, {D4}, {R4}
    assert analyzer.largest_component_size() == 4

    isolated = analyzer.isolated_nodes()
    assert "DONOR_D4" in isolated
    assert "RECIPIENT_R4" in isolated
    assert len(analyzer.isolated_donors()) == 1
    assert len(analyzer.isolated_recipients()) == 1

    summary = analyzer.component_summary()
    assert len(summary) == 4


# 9. Graph Metrics Calculator
def test_graph_metrics_calculator(sample_bipartite_graph):
    metrics = GraphMetricsCalculator.calculate(sample_bipartite_graph)
    assert metrics["node_count"] == 8
    assert metrics["edge_count"] == 4
    assert metrics["donor_count"] == 4
    assert metrics["recipient_count"] == 4
    assert metrics["is_bipartite"] is True
    assert metrics["connected_components"] == 4
    assert metrics["largest_component_size"] == 4


# 10. Matching Run Repository Integration
def test_matching_run_repository(memory_db):
    repo = MatchingRunRepository(memory_db)
    run = MatchingRun(
        id=None,
        algorithm="Maximum Weight Matching",
        graph_nodes=8,
        graph_edges=4,
        matched_pairs=3,
        total_score=250.0,
        average_score=83.33,
        execution_time_ms=1.45,
        rule_version="3.0",
        created_at="2026-09-08T00:00:00",
    )
    saved_id = repo.save_run(run)
    assert saved_id is not None

    fetched = repo.get_by_id(saved_id)
    assert fetched is not None
    assert fetched.algorithm == "Maximum Weight Matching"
    assert fetched.matched_pairs == 3
    assert fetched.total_score == 250.0

    recent = repo.get_recent_runs(limit=5)
    assert len(recent) == 1


# 11. Matching Engine Integration & Result Comparison
def test_matching_engine_orchestration(sample_bipartite_graph, memory_db):
    graph_engine = GraphEngine()
    graph_engine._graph = sample_bipartite_graph

    matching_run_repo = MatchingRunRepository(memory_db)
    matching_engine = MatchingEngine(
        graph_engine=graph_engine,
        matching_run_repo=matching_run_repo,
    )

    max_res = matching_engine.run_maximum_matching()
    weighted_res = matching_engine.run_weighted_matching()

    assert max_res.total_matches == 3
    assert weighted_res.total_matches == 3

    comparison = matching_engine.compare_matching_results(max_res, weighted_res)
    assert "cardinality" in comparison
    assert "weighted" in comparison
    assert "common_matches" in comparison
    assert comparison["common_count"] >= 1

    # Verify persisted runs in database
    runs = matching_run_repo.get_recent_runs()
    assert len(runs) == 2


# 12. Synthetic Scaling Benchmark
def test_synthetic_scaling_benchmark():
    bench = GraphAnalyticsService.run_benchmark(num_donors=50, num_recipients=50, edge_probability=0.05)
    assert bench["num_donors"] == 50
    assert bench["num_recipients"] == 50
    assert bench["total_nodes"] == 100
    assert bench["is_valid_bipartite"] is True
    assert bench["max_matching_ms"] >= 0.0
    assert bench["weighted_matching_ms"] >= 0.0
    assert bench["total_time_ms"] > 0.0
