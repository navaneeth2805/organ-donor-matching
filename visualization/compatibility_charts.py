"""Visual chart components for Phase 3 Compatibility, Candidate Ranking, and Matrix Visualization."""

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st
from ui.components import render_empty_state


def _configure_plot_style() -> None:
    """Configure modern, clean matplotlib typography and borders."""
    plt.rcParams["font.family"] = "sans-serif"
    plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Arial", "Helvetica"]
    plt.rcParams["axes.edgecolor"] = "#E2E8F0"
    plt.rcParams["axes.linewidth"] = 0.8
    plt.rcParams["grid.color"] = "#F1F5F9"
    plt.rcParams["grid.linestyle"] = "--"
    plt.rcParams["grid.alpha"] = 0.7


def render_status_distribution_chart(status_counts: dict[str, int]) -> None:
    """Render donut chart of compatibility evaluation status distribution."""
    if not status_counts or sum(status_counts.values()) == 0:
        render_empty_state("No evaluations yet", "Run candidate evaluations to view status distribution.")
        return

    _configure_plot_style()
    labels = []
    sizes = []
    colors = []

    color_map = {
        "POTENTIAL_CANDIDATE": ("#059669", "Potential Candidate"),
        "REQUIRES_REVIEW": ("#D97706", "Requires Review"),
        "INSUFFICIENT_DATA": ("#0284C7", "Insufficient Data"),
        "INCOMPATIBLE": ("#E11D48", "Incompatible"),
    }

    for k, v in status_counts.items():
        if v > 0:
            c, lbl = color_map.get(k, ("#64748B", k.replace("_", " ").title()))
            labels.append(f"{lbl} ({v})")
            sizes.append(v)
            colors.append(c)

    fig, ax = plt.subplots(figsize=(5.5, 3.8), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct="%1.0f%%",
        startangle=140,
        pctdistance=0.75,
        wedgeprops=dict(width=0.45, edgecolor="#FFFFFF", linewidth=2),
    )

    for at in autotexts:
        at.set_fontsize(8.5)
        at.set_fontweight("bold")
        at.set_color("#FFFFFF")
    for t in texts:
        t.set_fontsize(8)
        t.set_color("#334155")

    ax.axis("equal")
    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)


def render_score_histogram(scores: list[float], bins: int = 10) -> None:
    """Render distribution histogram of software candidate ranking scores."""
    if not scores:
        render_empty_state("No candidate scores", "Evaluate pairs to generate candidate distribution.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6, 3.4), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    n, bins_edges, patches = ax.hist(
        scores,
        bins=np.linspace(0, 100, bins + 1),
        color="#2563EB",
        edgecolor="#FFFFFF",
        linewidth=1.2,
        rwidth=0.85,
    )

    # Color gradient across score tiers
    for i, patch in enumerate(patches):
        mid = (bins_edges[i] + bins_edges[i + 1]) / 2.0
        if mid >= 80:
            patch.set_facecolor("#059669")
        elif mid >= 50:
            patch.set_facecolor("#2563EB")
        elif mid >= 30:
            patch.set_facecolor("#D97706")
        else:
            patch.set_facecolor("#94A3B8")

    ax.set_xlabel("Software Candidate Score (0 - 100)", fontsize=8.5, color="#475569")
    ax.set_ylabel("Pair Count", fontsize=8.5, color="#475569")
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    ax.tick_params(colors="#64748B", labelsize=8)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)


def render_component_score_bar_chart(score_breakdown: dict[str, float]) -> None:
    """Render horizontal bar chart for the 8 normalized component scores."""
    if not score_breakdown:
        return

    _configure_plot_style()
    labels = [
        "Blood Compatibility",
        "Organ Compatibility",
        "Clinical Readiness",
        "Urgency Priority",
        "Waiting Time",
        "HLA Histocompatibility",
        "Geographic Proximity",
        "Data Completeness",
    ]
    keys = [
        "blood_score",
        "organ_score",
        "clinical_score",
        "urgency_score",
        "waiting_time_score",
        "hla_score",
        "geographic_score",
        "data_quality_score",
    ]
    vals = [score_breakdown.get(k, 0.0) for k in keys]

    fig, ax = plt.subplots(figsize=(6.5, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    y_pos = np.arange(len(labels))
    bars = ax.barh(y_pos, vals, color="#0EA5E9", height=0.6, edgecolor="none")

    # Add numeric labels
    for bar in bars:
        w = bar.get_width()
        color = "#059669" if w >= 80 else ("#2563EB" if w >= 50 else "#D97706")
        bar.set_facecolor(color)
        ax.text(
            w + 1.5,
            bar.get_y() + bar.get_height() / 2,
            f"{w:.0f}",
            va="center",
            ha="left",
            fontsize=8,
            fontweight="bold",
            color="#334155",
        )

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=8, color="#334155")
    ax.set_xlim(0, 115)
    ax.set_xlabel("Component Score (0–100 Scale)", fontsize=8, color="#475569")
    ax.grid(axis="x", linestyle="--", alpha=0.5)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)
