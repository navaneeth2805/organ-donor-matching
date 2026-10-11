"""Reusable UI component library for consistent medical presentation."""

import streamlit as st
from utils.constants import (
    COLOR_PRIMARY,
    COLOR_SECONDARY,
    COLOR_SUCCESS,
    COLOR_WARNING,
    COLOR_DANGER,
    STATUS_BADGE_MAP,
)


def inject_custom_css() -> None:
    """Inject application-wide polished medical CSS design system."""
    st.markdown(
        """
        <style>
        /* Base typography & clean background */
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        html, body, [class*="css"] {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Sidebar Styling */
        section[data-testid="stSidebar"] {
            background-color: #0F172A !important;
            color: #F8FAFC !important;
        }
        section[data-testid="stSidebar"] h1, 
        section[data-testid="stSidebar"] h2, 
        section[data-testid="stSidebar"] h3,
        section[data-testid="stSidebar"] span,
        section[data-testid="stSidebar"] label,
        section[data-testid="stSidebar"] p {
            color: #F1F5F9 !important;
        }
        section[data-testid="stSidebar"] .stRadio label {
            color: #E2E8F0 !important;
        }

        /* Main app container */
        .main .block-container {
            padding-top: 1.8rem;
            padding-bottom: 2.5rem;
            max-width: 1280px;
        }

        /* Stat Card styling */
        .med-stat-card {
            background: #FFFFFF;
            border-radius: 12px;
            padding: 20px 22px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
            border: 1px solid #E2E8F0;
            display: flex;
            flex-direction: column;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .med-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(15, 23, 42, 0.09);
        }
        .med-stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .med-stat-label {
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748B;
        }
        .med-stat-icon {
            font-size: 1.3rem;
        }
        .med-stat-value {
            font-size: 2.1rem;
            font-weight: 800;
            color: #0F172A;
            line-height: 1.1;
        }
        .med-stat-subtext {
            font-size: 0.78rem;
            color: #94A3B8;
            margin-top: 6px;
        }

        /* Status Badges */
        .med-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.76rem;
            font-weight: 600;
            white-space: nowrap;
            letter-spacing: 0.01em;
            border: 1px solid transparent;
        }

        /* Page Headers */
        .med-header-container {
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #E2E8F0;
        }
        .med-header-title {
            font-size: 1.85rem;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.02em;
            margin: 0;
        }
        .med-header-desc {
            font-size: 0.95rem;
            color: #475569;
            margin-top: 4px;
        }

        /* Section Headings */
        .med-section-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1E293B;
            margin-top: 1.2rem;
            margin-bottom: 0.7rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Empty state card */
        .med-empty-box {
            background-color: #F8FAFC;
            border: 1.5px dashed #CBD5E1;
            border-radius: 12px;
            padding: 36px 20px;
            text-align: center;
            margin: 1.5rem 0;
        }
        .med-empty-title {
            font-size: 1.05rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 4px;
        }
        .med-empty-subtitle {
            font-size: 0.88rem;
            color: #64748B;
        }

        /* Medical Table tweaks */
        div[data-testid="stDataFrame"] {
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #E2E8F0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_page_header(title: str, description: str) -> None:
    """Render standardized high-clarity page header."""
    st.markdown(
        f"""
        <div class="med-header-container">
            <h1 class="med-header-title">{title}</h1>
            <p class="med-header-desc">{description}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_stat_card(label: str, value: str | int, subtext: str = "", icon: str = "📊", color: str = "#1E40AF") -> None:
    """Render a clean medical metric card."""
    st.markdown(
        f"""
        <div class="med-stat-card">
            <div class="med-stat-header">
                <span class="med-stat-label">{label}</span>
                <span class="med-stat-icon">{icon}</span>
            </div>
            <div class="med-stat-value" style="color: {color};">{value}</div>
            <div class="med-stat-subtext">{subtext}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_badge(status_text: str) -> str:
    """Return HTML markup for a styled status badge."""
    cfg = STATUS_BADGE_MAP.get(
        status_text,
        {"bg": "#F1F5F9", "color": "#475569", "border": "#CBD5E1", "icon": "•"},
    )
    return (
        f'<span class="med-badge" style="background-color: {cfg["bg"]}; color: {cfg["color"]}; border-color: {cfg["border"]};">'
        f'{cfg["icon"]} {status_text}</span>'
    )


def render_section_header(title: str, icon: str = "") -> None:
    """Render consistent section header."""
    icon_html = f"<span>{icon}</span> " if icon else ""
    st.markdown(
        f'<div class="med-section-title">{icon_html}{title}</div>',
        unsafe_allow_html=True,
    )


def render_empty_state(message: str, suggestion: str = "Try adjusting filters or registering new records.") -> None:
    """Render empty state card when records or queries return no results."""
    st.markdown(
        f"""
        <div class="med-empty-box">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📋</div>
            <div class="med-empty-title">{message}</div>
            <div class="med-empty-subtitle">{suggestion}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
