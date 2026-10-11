"""Visual chart components for clinical vitals trending, laboratory tracking, and data quality."""

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st
from database.models import LaboratoryResults, VitalSigns
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


def render_vitals_trend_chart(vitals_history: list[VitalSigns]) -> None:
    """Plot systolic/diastolic blood pressure and heart rate trend over time."""
    if not vitals_history or len(vitals_history) < 2:
        render_empty_state(
            "Insufficient Vital Signs History",
            "At least 2 vital sign recordings are needed to generate longitudinal trends.",
        )
        return

    # Sort chronological
    sorted_vitals = sorted(vitals_history, key=lambda v: str(v.recorded_at or ""))

    dates = [str(v.recorded_at or "")[:10] for v in sorted_vitals]
    systolic = [v.systolic_bp for v in sorted_vitals]
    diastolic = [v.diastolic_bp for v in sorted_vitals]
    hr = [v.heart_rate for v in sorted_vitals]

    _configure_plot_style()
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(7, 4.5), dpi=120, sharex=True)
    fig.patch.set_facecolor("#FFFFFF")

    # BP plot
    ax1.set_facecolor("#FFFFFF")
    ax1.plot(dates, systolic, marker="o", color="#DC2626", linewidth=1.8, label="Systolic (mmHg)")
    ax1.plot(dates, diastolic, marker="s", color="#2563EB", linewidth=1.8, label="Diastolic (mmHg)")
    ax1.axhspan(90, 120, color="#22C55E", alpha=0.12, label="Optimal BP Range")
    ax1.set_title("Blood Pressure Dynamics", fontsize=10, fontweight="bold", color="#0F172A", pad=6)
    ax1.set_ylabel("mmHg", fontsize=8.5, color="#475569")
    ax1.legend(loc="upper right", fontsize=7.5, frameon=True, facecolor="#FFFFFF")
    ax1.grid(True, alpha=0.4)
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.tick_params(axis="both", labelsize=8, colors="#475569")

    # HR plot
    ax2.set_facecolor("#FFFFFF")
    ax2.plot(dates, hr, marker="^", color="#0D9488", linewidth=1.8, label="Heart Rate (bpm)")
    ax2.axhspan(60, 100, color="#22C55E", alpha=0.12, label="Normal Resting HR (60-100)")
    ax2.set_title("Heart Rate Telemetry", fontsize=10, fontweight="bold", color="#0F172A", pad=6)
    ax2.set_ylabel("BPM", fontsize=8.5, color="#475569")
    ax2.legend(loc="upper right", fontsize=7.5, frameon=True, facecolor="#FFFFFF")
    ax2.grid(True, alpha=0.4)
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    ax2.tick_params(axis="both", labelsize=8, colors="#475569")
    plt.xticks(rotation=25, ha="right")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_labs_trend_chart(labs_history: list[LaboratoryResults], biomarker_key: str = "creatinine") -> None:
    """Plot biomarker progression over time."""
    if not labs_history or len(labs_history) < 2:
        render_empty_state(
            "Insufficient Laboratory History",
            "At least 2 lab tests are required to plot biomarker progression.",
        )
        return

    sorted_labs = sorted(labs_history, key=lambda l: str(l.test_date or ""))
    dates: list[str] = []
    values: list[float] = []

    for l in sorted_labs:
        val = getattr(l, biomarker_key, None)
        if val is not None:
            dates.append(str(l.test_date or "")[:10])
            values.append(float(val))

    if len(values) < 2:
        render_empty_state(
            "Insufficient Biomarker Records",
            f"Fewer than 2 recorded values found for {biomarker_key.replace('_', ' ').title()}.",
        )
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6.5, 3.2), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    label_clean = biomarker_key.replace("_", " ").title()
    ax.plot(dates, values, marker="o", color="#4F46E5", linewidth=2.0, label=f"{label_clean} Level")

    # Add reference band for common biomarkers
    if biomarker_key == "creatinine":
        ax.axhspan(0.6, 1.2, color="#22C55E", alpha=0.15, label="Standard Reference (0.6-1.2 mg/dL)")
        ax.set_ylabel("mg/dL", fontsize=8.5, color="#475569")
    elif biomarker_key == "egfr":
        ax.axhspan(60.0, 120.0, color="#22C55E", alpha=0.15, label="Normal Kidney Function (>=60)")
        ax.set_ylabel("mL/min/1.73m²", fontsize=8.5, color="#475569")
    elif biomarker_key == "blood_glucose":
        ax.axhspan(70.0, 140.0, color="#22C55E", alpha=0.15, label="Euglycemic Range (70-140 mg/dL)")
        ax.set_ylabel("mg/dL", fontsize=8.5, color="#475569")
    elif biomarker_key == "hemoglobin":
        ax.axhspan(12.0, 17.5, color="#22C55E", alpha=0.15, label="Standard Reference (12-17.5 g/dL)")
        ax.set_ylabel("g/dL", fontsize=8.5, color="#475569")

    ax.set_title(f"Longitudinal Progression: {label_clean}", fontsize=10.5, fontweight="bold", color="#0F172A", pad=10)
    ax.legend(loc="upper right", fontsize=8, frameon=True, facecolor="#FFFFFF")
    ax.grid(True, alpha=0.4)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(axis="both", labelsize=8, colors="#475569")
    plt.xticks(rotation=25, ha="right")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_completeness_breakdown_chart(completeness_by_cat: dict[str, float]) -> None:
    """Render horizontal bar chart for category data completeness percentage."""
    if not completeness_by_cat:
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6, 2.8), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    categories = list(completeness_by_cat.keys())
    scores = list(completeness_by_cat.values())

    # Dynamic color coding
    colors = []
    for s in scores:
        if s >= 80.0:
            colors.append("#16A34A")  # Green
        elif s >= 50.0:
            colors.append("#D97706")  # Amber
        else:
            colors.append("#DC2626")  # Red

    y_pos = range(len(categories))
    bars = ax.barh(y_pos, scores, color=colors, height=0.55, edgecolor="none")
    ax.set_yticks(y_pos)
    ax.set_yticklabels(categories, fontsize=8.5, color="#334155")
    ax.set_xlim(0, 105)

    for bar in bars:
        width = bar.get_width()
        ax.text(
            width + 1.5,
            bar.get_y() + bar.get_height() / 2,
            f"{width:.0f}%",
            va="center",
            ha="left",
            fontsize=8.5,
            fontweight="bold",
            color="#334155",
        )

    ax.set_title("Clinical Data Completeness by Subspecialty", fontsize=10, fontweight="bold", color="#0F172A", pad=8)
    ax.grid(axis="x", alpha=0.4)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(axis="both", labelsize=8, colors="#475569")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
