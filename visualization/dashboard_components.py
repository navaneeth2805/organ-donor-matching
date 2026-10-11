"""Visual chart components for the healthcare analytics dashboard."""

import matplotlib.pyplot as plt
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


def render_organ_distribution_chart(df: pd.DataFrame, title: str = "Donors by Organ", color: str = "#1E40AF") -> None:
    """Render horizontal bar chart for organ distribution."""
    if df.empty or df["Count"].sum() == 0:
        render_empty_state("No data available yet.", "Add records to populate this chart.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    df_sorted = df.sort_values(by="Count", ascending=True)
    bars = ax.barh(df_sorted.iloc[:, 0], df_sorted["Count"], color=color, height=0.62, edgecolor="none")
    
    # Add count labels at the end of each bar
    for bar in bars:
        width = bar.get_width()
        ax.text(
            width + 0.1,
            bar.get_y() + bar.get_height() / 2,
            f"{int(width)}",
            va="center",
            ha="left",
            fontsize=8.5,
            fontweight="bold",
            color="#334155",
        )

    ax.set_title(title, fontsize=11, fontweight="bold", color="#0F172A", pad=12)
    ax.grid(axis="x", alpha=0.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(axis="both", which="major", labelsize=8.5, colors="#475569")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_blood_group_chart(df: pd.DataFrame, title: str = "Donors by Blood Group") -> None:
    """Render vertical bar chart for blood group distribution."""
    if df.empty or df["Count"].sum() == 0:
        render_empty_state("No data available yet.", "Add records to populate this chart.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    colors = ["#0284C7", "#0EA5E9", "#38BDF8", "#7DD3FC", "#0369A1", "#075985", "#0C4A6E", "#BAE6FD"]
    bars = ax.bar(df.iloc[:, 0], df["Count"], color=colors[: len(df)], width=0.6, edgecolor="none")

    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            height + 0.1,
            f"{int(height)}",
            ha="center",
            va="bottom",
            fontsize=8.5,
            fontweight="bold",
            color="#334155",
        )

    ax.set_title(title, fontsize=11, fontweight="bold", color="#0F172A", pad=12)
    ax.grid(axis="y", alpha=0.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(axis="both", which="major", labelsize=8.5, colors="#475569")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_urgency_chart(df: pd.DataFrame) -> None:
    """Render clinical urgency breakdown chart."""
    if df.empty or df["Count"].sum() == 0:
        render_empty_state("No data available yet.", "Add records to populate this chart.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(6, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    urgency_color_map = {
        "Critical": "#DC2626",
        "High": "#EA580C",
        "Medium": "#D97706",
        "Low": "#16A34A",
    }
    bar_colors = [urgency_color_map.get(u, "#64748B") for u in df.iloc[:, 0]]
    bars = ax.bar(df.iloc[:, 0], df["Count"], color=bar_colors, width=0.55)

    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            height + 0.1,
            f"{int(height)}",
            ha="center",
            va="bottom",
            fontsize=8.5,
            fontweight="bold",
            color="#334155",
        )

    ax.set_title("Recipients by Urgency Level", fontsize=11, fontweight="bold", color="#0F172A", pad=12)
    ax.grid(axis="y", alpha=0.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(axis="both", which="major", labelsize=8.5, colors="#475569")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_availability_pie_chart(df: pd.DataFrame) -> None:
    """Render donut chart for donor availability status."""
    if df.empty or df["Count"].sum() == 0:
        render_empty_state("No data available yet.", "Add records to populate this chart.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(5, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")

    status_color_map = {
        "Available": "#16A34A",
        "Pending": "#EAB308",
        "Unavailable": "#DC2626",
    }
    colors = [status_color_map.get(s, "#94A3B8") for s in df.iloc[:, 0]]

    wedges, texts, autotexts = ax.pie(
        df["Count"],
        labels=df.iloc[:, 0],
        colors=colors,
        autopct="%1.1f%%",
        startangle=140,
        pctdistance=0.75,
        textprops={"fontsize": 8.5, "color": "#334155"},
        wedgeprops=dict(width=0.45, edgecolor="#FFFFFF", linewidth=2),
    )
    for at in autotexts:
        at.set_color("#FFFFFF")
        at.set_fontweight("bold")
        at.set_fontsize(8)

    ax.set_title("Donor Availability Status", fontsize=11, fontweight="bold", color="#0F172A", pad=12)
    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_registration_trend_chart(df: pd.DataFrame) -> None:
    """Render registration trends over time."""
    if df.empty or (df["Donors"].sum() == 0 and df["Recipients"].sum() == 0):
        render_empty_state("No registration timeline data.", "Add donor and recipient dates to populate trend.")
        return

    _configure_plot_style()
    fig, ax = plt.subplots(figsize=(10, 3.6), dpi=120)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")

    ax.plot(df["Date"], df["Donors"], marker="o", color="#1E40AF", linewidth=2, label="Donors Registered")
    ax.plot(df["Date"], df["Recipients"], marker="s", color="#0284C7", linewidth=2, label="Recipients Registered")

    ax.set_title("Daily Registration Activity Trend", fontsize=11, fontweight="bold", color="#0F172A", pad=12)
    ax.set_xlabel("Date", fontsize=8.5, color="#64748B")
    ax.set_ylabel("Registrations", fontsize=8.5, color="#64748B")
    ax.grid(True, alpha=0.5)
    ax.legend(frameon=True, facecolor="#F8FAFC", edgecolor="#E2E8F0", fontsize=8.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.xticks(rotation=30, ha="right", fontsize=8, color="#475569")
    plt.yticks(fontsize=8, color="#475569")

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
