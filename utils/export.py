"""CSV and data export utilities using Pandas."""

import io
from typing import Any, Sequence
import pandas as pd


def export_donors_csv(donors: Sequence[Any]) -> str:
    """Export donors to sanitized CSV format, excluding sensitive contact details."""
    rows = []
    for d in donors:
        # Support either dataclass models or dictionaries
        data = d.to_dict() if hasattr(d, "to_dict") else dict(d)
        rows.append({
            "Donor ID": data.get("id"),
            "Name": data.get("name"),
            "Age": data.get("age"),
            "Blood Group": data.get("blood_group"),
            "Organ": data.get("organ"),
            "Hospital": data.get("hospital_name") or data.get("hospital_id"),
            "Location": data.get("location"),
            "Availability": data.get("availability"),
            "Registration Date": data.get("registration_date"),
        })
    df = pd.DataFrame(rows)
    return df.to_csv(index=False)


def export_recipients_csv(recipients: Sequence[Any]) -> str:
    """Export recipients to sanitized CSV format."""
    rows = []
    for r in recipients:
        data = r.to_dict() if hasattr(r, "to_dict") else dict(r)
        rows.append({
            "Recipient ID": data.get("id"),
            "Name": data.get("name"),
            "Age": data.get("age"),
            "Blood Group": data.get("blood_group"),
            "Organ Needed": data.get("organ_needed"),
            "Hospital": data.get("hospital_name") or data.get("hospital_id"),
            "Location": data.get("location"),
            "Urgency": data.get("urgency"),
            "Waiting Time (Days)": data.get("waiting_time_days"),
            "Registration Date": data.get("registration_date"),
        })
    df = pd.DataFrame(rows)
    return df.to_csv(index=False)


def export_hospitals_csv(hospitals: Sequence[Any]) -> str:
    """Export hospitals to CSV format."""
    rows = []
    for h in hospitals:
        data = h.to_dict() if hasattr(h, "to_dict") else dict(h)
        rows.append({
            "Hospital ID": data.get("id"),
            "Hospital Name": data.get("name"),
            "City": data.get("city"),
            "State": data.get("state"),
            "Country": data.get("country"),
            "Phone": data.get("phone"),
            "Email": data.get("email"),
            "Status": "Active" if data.get("active", 1) else "Inactive",
        })
    df = pd.DataFrame(rows)
    return df.to_csv(index=False)


def export_analytics_csv(data_dict: dict[str, Any]) -> str:
    """Export summarized analytics dictionary to CSV format."""
    rows = []
    for section, metrics in data_dict.items():
        if isinstance(metrics, dict):
            for k, v in metrics.items():
                rows.append({"Category": section, "Metric": k, "Value": v})
        else:
            rows.append({"Category": "Overview", "Metric": section, "Value": metrics})
    df = pd.DataFrame(rows)
    return df.to_csv(index=False)
