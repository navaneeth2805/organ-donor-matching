"""Geographic proximity and logistical feasibility rule."""

import math
from typing import Any
from compatibility.base_rule import CompatibilityRule, RuleResult
from database.models import Donor, Recipient


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in kilometers."""
    r = 6371.0  # Earth's mean radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 1)


class GeographicRule(CompatibilityRule):
    """Evaluates logistical transit feasibility and geographic distance between facilities."""

    def __init__(self):
        super().__init__(rule_name="Geographic & Logistics Feasibility", is_hard_constraint=False)

    def evaluate(
        self,
        donor: Donor,
        recipient: Recipient,
        context: dict[str, Any] | None = None,
    ) -> RuleResult:
        ctx = context or {}
        donor_hosp = ctx.get("donor_hospital")
        recip_hosp = ctx.get("recipient_hospital")

        # 1. Check if same hospital ID
        if donor.hospital_id and recipient.hospital_id and donor.hospital_id == recipient.hospital_id:
            hosp_name = getattr(donor_hosp, "name", "Same Hospital")
            return RuleResult(
                passed=True,
                severity="PASS",
                code="GEO_SAME_FACILITY",
                message=f"Direct co-location: Donor and Recipient are located at the same facility ({hosp_name}).",
                score=100.0,
                metadata={"distance_km": 0.0, "logistics": "Immediate local transfer"},
            )

        # 2. Check coordinates if present on hospital records
        d_lat = getattr(donor_hosp, "latitude", None)
        d_lon = getattr(donor_hosp, "longitude", None)
        r_lat = getattr(recip_hosp, "latitude", None)
        r_lon = getattr(recip_hosp, "longitude", None)

        if d_lat is not None and d_lon is not None and r_lat is not None and r_lon is not None:
            dist_km = haversine_distance_km(d_lat, d_lon, r_lat, r_lon)
            if dist_km <= 50.0:
                score = 100.0
            elif dist_km <= 200.0:
                score = 85.0
            elif dist_km <= 500.0:
                score = 70.0
            elif dist_km <= 1000.0:
                score = 55.0
            else:
                score = 40.0

            return RuleResult(
                passed=True,
                severity="PASS",
                code="GEO_COORDINATES_MEASURED",
                message=f"Logistical transit distance calculated at {dist_km:.1f} km.",
                score=score,
                metadata={"distance_km": dist_km, "logistics": "Measured coordinates"},
            )

        # 3. Location/City/State fallback if coordinates not recorded
        d_loc = str(donor.location or getattr(donor_hosp, "city", "") or "").strip().lower()
        r_loc = str(recipient.location or getattr(recip_hosp, "city", "") or "").strip().lower()

        if d_loc and r_loc and d_loc == r_loc:
            return RuleResult(
                passed=True,
                severity="PASS",
                code="GEO_SAME_CITY",
                message=f"Same metropolitan service area ({d_loc.title()}). Logistical transit is favorable.",
                score=85.0,
                metadata={"distance_km": "Estimated Local", "location": d_loc.title()},
            )

        # 4. State comparison
        d_state = str(getattr(donor_hosp, "state", "") or "").strip().lower()
        r_state = str(getattr(recip_hosp, "state", "") or "").strip().lower()

        if d_state and r_state and d_state == r_state:
            return RuleResult(
                passed=True,
                severity="PASS",
                code="GEO_SAME_STATE",
                message=f"Intra-state matching in {d_state.title()}. Regional transit feasible.",
                score=70.0,
                metadata={"distance_km": "Intra-state", "state": d_state.title()},
            )

        # Neutral fallback when distance is unknown
        return RuleResult(
            passed=True,
            severity="PASS",
            code="GEO_UNKNOWN",
            message="Precise facility coordinates unavailable; assigned neutral logistical baseline score.",
            score=50.0,
            metadata={"distance_km": "UNKNOWN", "logistics": "Neutral baseline"},
        )
