from __future__ import annotations

from pydantic import BaseModel


class AdminDashboardSummary(BaseModel):
    total_organizations: int
    verified_organizations: int
    public_organizations: int
    total_products: int
    total_qr_codes: int
    total_qr_events: int

