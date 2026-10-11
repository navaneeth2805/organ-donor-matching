"""Analytics and statistical aggregation engine using Pandas."""

from typing import Any
import pandas as pd
from database.repositories import DonorRepository, HospitalRepository, RecipientRepository


class AnalyticsService:
    """Computes healthcare network statistics, distribution series, and trends."""

    def __init__(
        self,
        donor_repo: DonorRepository,
        recipient_repo: RecipientRepository,
        hospital_repo: HospitalRepository,
    ) -> None:
        self.donor_repo = donor_repo
        self.recipient_repo = recipient_repo
        self.hospital_repo = hospital_repo

    def get_total_donors(self) -> int:
        """Return total count of registered donors."""
        return self.donor_repo.count()

    def get_total_recipients(self) -> int:
        """Return total count of registered recipients."""
        return self.recipient_repo.count()

    def get_total_hospitals(self, active_only: bool = False) -> int:
        """Return total count of registered hospitals."""
        return self.hospital_repo.count(active_only=active_only)

    def get_available_donors(self) -> int:
        """Return count of donors currently marked Available."""
        return self.donor_repo.count(availability="Available")

    def get_pending_donors(self) -> int:
        """Return count of donors marked Pending."""
        return self.donor_repo.count(availability="Pending")

    def get_critical_recipients(self) -> int:
        """Return count of recipients with Critical clinical urgency."""
        return self.recipient_repo.count(urgency="Critical")

    def get_donors_by_blood_group(self) -> pd.DataFrame:
        """Return DataFrame of donor count grouped by blood group."""
        donors = self.donor_repo.get_all()
        if not donors:
            return pd.DataFrame(columns=["Blood Group", "Count"])
        data = [d.blood_group for d in donors]
        s = pd.Series(data).value_counts().reset_index()
        s.columns = ["Blood Group", "Count"]
        return s

    def get_donors_by_organ(self) -> pd.DataFrame:
        """Return DataFrame of donor count grouped by organ."""
        donors = self.donor_repo.get_all()
        if not donors:
            return pd.DataFrame(columns=["Organ", "Count"])
        data = [d.organ for d in donors]
        s = pd.Series(data).value_counts().reset_index()
        s.columns = ["Organ", "Count"]
        return s

    def get_recipients_by_organ(self) -> pd.DataFrame:
        """Return DataFrame of recipient count grouped by organ needed."""
        recipients = self.recipient_repo.get_all()
        if not recipients:
            return pd.DataFrame(columns=["Organ Needed", "Count"])
        data = [r.organ_needed for r in recipients]
        s = pd.Series(data).value_counts().reset_index()
        s.columns = ["Organ Needed", "Count"]
        return s

    def get_recipients_by_urgency(self) -> pd.DataFrame:
        """Return DataFrame of recipient count grouped by urgency level."""
        recipients = self.recipient_repo.get_all()
        if not recipients:
            return pd.DataFrame(columns=["Urgency", "Count"])
        data = [r.urgency for r in recipients]
        s = pd.Series(data).value_counts().reset_index()
        s.columns = ["Urgency", "Count"]
        return s

    def get_donor_availability_distribution(self) -> pd.DataFrame:
        """Return DataFrame of donor availability status distribution."""
        donors = self.donor_repo.get_all()
        if not donors:
            return pd.DataFrame(columns=["Availability", "Count"])
        data = [d.availability for d in donors]
        s = pd.Series(data).value_counts().reset_index()
        s.columns = ["Availability", "Count"]
        return s

    def get_registration_trend(self) -> pd.DataFrame:
        """Return DataFrame tracking daily donor and recipient registrations over time."""
        donors = self.donor_repo.get_all()
        recipients = self.recipient_repo.get_all()

        records: list[dict[str, Any]] = []
        for d in donors:
            if d.registration_date:
                records.append({"Date": d.registration_date, "Type": "Donor"})
        for r in recipients:
            if r.registration_date:
                records.append({"Date": r.registration_date, "Type": "Recipient"})

        if not records:
            return pd.DataFrame(columns=["Date", "Donors", "Recipients"])

        df = pd.DataFrame(records)
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df = df.dropna(subset=["Date"])
        if df.empty:
            return pd.DataFrame(columns=["Date", "Donors", "Recipients"])

        df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
        grouped = (
            df.groupby(["Date", "Type"])
            .size()
            .unstack(fill_value=0)
            .reset_index()
        )
        if "Donor" not in grouped.columns:
            grouped["Donor"] = 0
        if "Recipient" not in grouped.columns:
            grouped["Recipient"] = 0

        grouped = grouped.rename(columns={"Donor": "Donors", "Recipient": "Recipients"})
        return grouped.sort_values(by="Date")
