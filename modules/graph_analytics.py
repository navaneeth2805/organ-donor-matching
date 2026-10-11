"""Graph Analytics Service providing high-level summaries and performance benchmarking."""

import random
import time
from typing import Any
import networkx as nx

from algorithms.bipartite_matching import MaximumBipartiteMatching
from algorithms.centrality import CentralityAnalyzer
from algorithms.connected_components import ConnectedComponentAnalyzer
from algorithms.graph_metrics import GraphMetricsCalculator
from algorithms.vertex_degree import VertexDegreeAnalyzer
from algorithms.weighted_matching import MaximumWeightMatching


class GraphAnalyticsService:
    """Provides high-level analytical computations and execution profiling."""

    @staticmethod
    def get_graph_summary(graph: nx.Graph) -> dict[str, Any]:
        """Compute top-level graph metrics and partition demographics."""
        return GraphMetricsCalculator.calculate(graph)

    @staticmethod
    def get_degree_analysis(graph: nx.Graph) -> dict[str, Any]:
        """Compute degree metrics, distributions, and connectivity extremes."""
        analyzer = VertexDegreeAnalyzer(graph)
        return analyzer.get_degree_summary()

    @staticmethod
    def get_centrality_analysis(graph: nx.Graph, top_k: int = 20) -> list[dict[str, Any]]:
        """Compute degree, betweenness, and closeness centrality distributions."""
        analyzer = CentralityAnalyzer(graph)
        return analyzer.get_top_k(metric="degree_centrality", k=top_k)

    @staticmethod
    def get_component_analysis(graph: nx.Graph) -> dict[str, Any]:
        """Compute connected components, cluster sizes, and isolate demographics."""
        analyzer = ConnectedComponentAnalyzer(graph)
        return {
            "total_components": analyzer.number_of_components(),
            "largest_component_size": analyzer.largest_component_size(),
            "isolated_donors": analyzer.isolated_donors(),
            "isolated_recipients": analyzer.isolated_recipients(),
            "isolated_total": len(analyzer.isolated_nodes()),
            "components": analyzer.component_summary(),
        }

    @staticmethod
    def run_benchmark(num_donors: int = 1000, num_recipients: int = 1000, edge_probability: float = 0.015) -> dict[str, Any]:
        """Benchmark synthetic bipartite graph operations without modifying production database."""
        # 1. Synthetic Graph Construction
        t0 = time.perf_counter()
        synth_G = nx.Graph()

        for d in range(1, num_donors + 1):
            synth_G.add_node(
                f"DONOR_D{d:04d}",
                bipartite=0,
                node_type="donor",
                display_name=f"Synth Donor {d}",
                organ="Kidney",
                blood_group="O+",
            )

        for r in range(1, num_recipients + 1):
            synth_G.add_node(
                f"RECIPIENT_R{r:04d}",
                bipartite=1,
                node_type="recipient",
                display_name=f"Synth Recipient {r}",
                organ="Kidney",
                blood_group="O+",
            )

        # Generate pseudo-random compatibility edges
        random.seed(42)
        donor_ids = [f"DONOR_D{d:04d}" for d in range(1, num_donors + 1)]
        recip_ids = [f"RECIPIENT_R{r:04d}" for r in range(1, num_recipients + 1)]

        for d_id in donor_ids:
            # Connect to a subset of recipients based on probability
            targets = random.sample(recip_ids, max(1, int(num_recipients * edge_probability)))
            for r_id in targets:
                score = round(random.uniform(60.0, 98.0), 1)
                synth_G.add_edge(d_id, r_id, weight=score, compatibility_score=score, status="POTENTIAL_CANDIDATE")

        build_time_ms = (time.perf_counter() - t0) * 1000.0

        # 2. Validation
        t_val = time.perf_counter()
        is_valid = nx.is_bipartite(synth_G)
        val_time_ms = (time.perf_counter() - t_val) * 1000.0

        # 3. Maximum Cardinality Matching
        t_max = time.perf_counter()
        max_res = MaximumBipartiteMatching.match(synth_G)
        max_time_ms = (time.perf_counter() - t_max) * 1000.0

        # 4. Maximum Weight Matching
        t_weight = time.perf_counter()
        weight_res = MaximumWeightMatching.match(synth_G)
        weight_time_ms = (time.perf_counter() - t_weight) * 1000.0

        # 5. Centrality
        t_cent = time.perf_counter()
        deg_cent = nx.degree_centrality(synth_G)
        cent_time_ms = (time.perf_counter() - t_cent) * 1000.0

        # 6. Connected Components
        t_comp = time.perf_counter()
        num_comps = nx.number_connected_components(synth_G)
        comp_time_ms = (time.perf_counter() - t_comp) * 1000.0

        total_time_ms = (
            build_time_ms + val_time_ms + max_time_ms + weight_time_ms + cent_time_ms + comp_time_ms
        )

        return {
            "num_donors": num_donors,
            "num_recipients": num_recipients,
            "total_nodes": synth_G.number_of_nodes(),
            "total_edges": synth_G.number_of_edges(),
            "is_valid_bipartite": is_valid,
            "graph_build_ms": round(build_time_ms, 2),
            "validation_ms": round(val_time_ms, 2),
            "max_matching_ms": round(max_time_ms, 2),
            "max_matches_count": max_res.total_matches,
            "weighted_matching_ms": round(weight_time_ms, 2),
            "weighted_matches_count": weight_res.total_matches,
            "centrality_ms": round(cent_time_ms, 2),
            "components_ms": round(comp_time_ms, 2),
            "total_time_ms": round(total_time_ms, 2),
        }
