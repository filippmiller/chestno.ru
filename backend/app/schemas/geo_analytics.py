"""
Geo Analytics Schemas
Privacy-respecting geographic analytics for product scans
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class RecordScanLocationRequest(BaseModel):
    """Request to record a scan with location data."""
    organization_id: str
    product_id: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    device_type: str = Field(default="unknown", pattern="^(mobile|desktop|tablet|unknown)$")
    session_hash: Optional[str] = None  # Hashed session for unique counting


class StoreLocationCreate(BaseModel):
    """Create a new store location."""
    name: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    attribution_radius_m: int = Field(default=100, ge=10, le=5000)
    store_type: str = Field(default="retail", pattern="^(retail|wholesale|warehouse|popup|partner|other)$")


class StoreLocationUpdate(BaseModel):
    """Update a store location."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    attribution_radius_m: Optional[int] = Field(None, ge=10, le=5000)
    store_type: Optional[str] = Field(None, pattern="^(retail|wholesale|warehouse|popup|partner|other)$")
    is_active: Optional[bool] = None


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class HeatmapPoint(BaseModel):
    """Single point for heatmap visualization."""
    lat: float
    lng: float
    weight: int
    city: Optional[str] = None
    region_name: Optional[str] = None


class HeatmapDataResponse(BaseModel):
    """Heatmap data for map visualization."""
    points: list[HeatmapPoint]
    total_scans: int
    max_weight: int
    center_lat: float
    center_lng: float
    bounds: dict  # {"ne": {"lat": x, "lng": y}, "sw": {"lat": x, "lng": y}}
    generated_at: datetime


class RegionBreakdown(BaseModel):
    """Scan breakdown for a single region."""
    region_code: str
    region_name: str
    federal_district: Optional[str] = None
    total_scans: int
    unique_sessions: int
    top_city: Optional[str] = None
    percent_of_total: float


class RegionBreakdownResponse(BaseModel):
    """Complete regional breakdown response."""
    regions: list[RegionBreakdown]
    total_scans: int
    total_regions: int
    time_range_days: int


class HourlyPattern(BaseModel):
    """Scan pattern for a single hour."""
    hour_of_day: int
    total_scans: int
    avg_scans_per_day: float
    percent_of_total: float


class TimePatternResponse(BaseModel):
    """Time-of-day pattern analysis."""
    hourly_data: list[HourlyPattern]
    peak_hour: int
    peak_hour_scans: int
    peak_period: str  # "morning", "afternoon", "evening", "night"
    time_range_days: int


class StoreLocation(BaseModel):
    """Store location response."""
    id: str
    organization_id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    region_name: Optional[str] = None
    latitude: float
    longitude: float
    attribution_radius_m: int
    store_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StoreScanSummary(BaseModel):
    """Scan summary for a store."""
    store_id: str
    store_name: str
    total_scans: int
    unique_sessions: int
    peak_hour: Optional[int] = None
    last_scan_date: Optional[date] = None


class StoreAnalyticsResponse(BaseModel):
    """Store-level analytics response."""
    stores: list[StoreScanSummary]
    total_stores: int
    total_attributed_scans: int
    attribution_rate: float  # Percentage of scans attributed to stores


class GeoAnalyticsSummary(BaseModel):
    """Summary of geographic analytics."""
    total_scans: int
    total_regions: int
    total_cities: int
    top_region: Optional[str] = None
    top_city: Optional[str] = None
    peak_hour: int
    peak_day_of_week: str
    device_breakdown: dict  # {"mobile": 60, "desktop": 30, "tablet": 10}
    time_range_days: int


class GeoRegion(BaseModel):
    """Geographic region reference."""
    id: str
    code: str
    name: str
    name_en: Optional[str] = None
    federal_district: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None


class GeoRegionsResponse(BaseModel):
    """List of available geographic regions."""
    regions: list[GeoRegion]
    total: int


# =============================================================================
# EXPORT SCHEMAS
# =============================================================================

class GeoExportRequest(BaseModel):
    """Request for geographic data export."""
    format: str = Field(default="csv", pattern="^(csv|json|geojson)$")
    include_heatmap: bool = True
    include_regions: bool = True
    include_time_patterns: bool = True
    include_stores: bool = False
    days: int = Field(default=30, ge=1, le=365)


class CompetitorBenchmark(BaseModel):
    """Anonymized competitor benchmark data."""
    region_name: str
    your_scans: int
    industry_avg: int
    industry_median: int
    percentile_rank: int  # Your position (e.g., 75 = top 25%)
    above_average: bool
