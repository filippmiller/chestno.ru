from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DailyMetric(BaseModel):
    date: datetime
    count: int


class CountryMetric(BaseModel):
    country: str | None
    count: int


class SourceMetric(BaseModel):
    source: str | None
    count: int


class QROverviewResponse(BaseModel):
    total_scans: int
    first_scan_at: datetime | None = None
    last_scan_at: datetime | None = None
    daily: list[DailyMetric] = Field(default_factory=list)
    by_country: list[CountryMetric] = Field(default_factory=list)
    by_source: list[SourceMetric] = Field(default_factory=list)

