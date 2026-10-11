"""UI theme constants, badge mappings, and formatting helpers."""

from config.settings import (
    APP_NAME,
    APP_SUBTITLE,
    BLOOD_GROUPS,
    ORGANS,
    AVAILABILITY_STATUSES,
    URGENCY_LEVELS,
    HOSPITAL_CATEGORIES,
)

# Semantic Colors
COLOR_PRIMARY = "#1E40AF"  # Deep Medical Blue
COLOR_SECONDARY = "#0284C7"  # Cyan / Light Medical Blue
COLOR_SUCCESS = "#16A34A"  # Medical Emerald Green
COLOR_WARNING = "#D97706"  # Amber Warning
COLOR_DANGER = "#DC2626"  # Crimson Danger
COLOR_BG_CARD = "#FFFFFF"
COLOR_TEXT_PRIMARY = "#0F172A"
COLOR_TEXT_MUTED = "#64748B"

# Status Badges Configuration (Label, Background color, Text color, Icon)
STATUS_BADGE_MAP = {
    # Availability
    "Available": {"bg": "#DCFCE7", "color": "#15803D", "border": "#86EFAC", "icon": "🟢"},
    "Pending": {"bg": "#FEF9C3", "color": "#A16207", "border": "#FDE047", "icon": "🟡"},
    "Unavailable": {"bg": "#FEE2E2", "color": "#B91C1C", "border": "#FCA5A5", "icon": "🔴"},
    # Urgency
    "Critical": {"bg": "#FEE2E2", "color": "#991B1B", "border": "#F87171", "icon": "🚨"},
    "High": {"bg": "#FFEDD5", "color": "#C2410C", "border": "#FDBA74", "icon": "⚠️"},
    "Medium": {"bg": "#FEF3C7", "color": "#B45309", "border": "#FCD34D", "icon": "⏳"},
    "Low": {"bg": "#F0FDF4", "color": "#166534", "border": "#BBF7D0", "icon": "ℹ️"},
    # Hospital status
    "Active": {"bg": "#EFF6FF", "color": "#1D4ED8", "border": "#93C5FD", "icon": "🏥"},
    "Inactive": {"bg": "#F1F5F9", "color": "#475569", "border": "#CBD5E1", "icon": "⏸️"},
}
