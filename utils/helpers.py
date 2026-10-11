"""General helper utilities for formatting, datetime, and pagination."""

from datetime import datetime
from typing import Any, Sequence, TypeVar

T = TypeVar("T")


def current_timestamp() -> str:
    """Return ISO 8601 formatted UTC timestamp string."""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def current_date() -> str:
    """Return ISO formatted current date YYYY-MM-DD."""
    return datetime.utcnow().strftime("%Y-%m-%d")


def format_display_id(entity_prefix: str, numeric_id: int | None) -> str:
    """Format numeric ID into standard padded human-readable code e.g. D-0012."""
    if numeric_id is None:
        return "N/A"
    return f"{entity_prefix}-{numeric_id:04d}"


def parse_display_id(display_id: str, expected_prefix: str | None = None) -> int | None:
    """Parse integer ID from strings like 'D-0012', '12', 'd12'."""
    if not display_id:
        return None
    cleaned = str(display_id).strip().upper()
    if expected_prefix and cleaned.startswith(expected_prefix.upper()):
        cleaned = cleaned[len(expected_prefix):].lstrip("-").strip()
    # Strip any leading letter
    if cleaned and cleaned[0].isalpha() and not cleaned.isdigit():
        cleaned = cleaned[1:].lstrip("-").strip()
    try:
        return int(cleaned)
    except ValueError:
        return None


def paginate_sequence(items: Sequence[T], page: int, page_size: int) -> tuple[list[T], int]:
    """Return slice of items for requested 1-indexed page and total page count."""
    total_items = len(items)
    if total_items == 0 or page_size <= 0:
        return [], 0
    total_pages = (total_items + page_size - 1) // page_size
    current_page = max(1, min(page, total_pages))
    start_idx = (current_page - 1) * page_size
    end_idx = start_idx + page_size
    return list(items[start_idx:end_idx]), total_pages
