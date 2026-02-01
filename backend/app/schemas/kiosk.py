"""
Kiosk Schemas.

Pydantic models for interactive scanner kiosk mode.
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ==================== Kiosk Device Models ====================

class KioskAuthRequest(BaseModel):
    """Kiosk device authentication request."""
    device_code: str = Field(..., min_length=1, max_length=100)
    store_id: str


class KioskAuthResponse(BaseModel):
    """Kiosk device authentication response."""
    success: bool
    kiosk_id: str | None = None
    session_token: str | None = None
    store_name: str | None = None
    error: str | None = None


class KioskFeatures(BaseModel):
    """Kiosk features configuration."""
    price_comparison: bool = True
    reviews: bool = True
    loyalty_signup: bool = True
    print_receipt: bool = False


class KioskConfig(BaseModel):
    """Kiosk configuration."""
    store_id: str
    store_name: str
    kiosk_id: str
    location_in_store: str | None = None
    branding_color: str | None = None
    logo_url: str | None = None
    idle_video_url: str | None = None
    language: str = 'ru'
    features: KioskFeatures = Field(default_factory=KioskFeatures)
    idle_timeout_seconds: int = 30


class KioskConfigUpdate(BaseModel):
    """Update kiosk configuration."""
    device_name: str | None = None
    location_in_store: str | None = None
    config: dict[str, Any] | None = None


# ==================== Kiosk Scan Models ====================

class KioskScanRequest(BaseModel):
    """Kiosk scan request."""
    barcode: str | None = None
    qr_code: str | None = None
    session_token: str


class KioskProductInfo(BaseModel):
    """Product info returned from kiosk scan."""
    product_id: str
    name: str
    brand: str | None = None
    status_level: str | None = None
    trust_score: int | None = None
    verification_date: datetime | None = None
    certifications: list[str] = []
    origin: str | None = None
    ingredients: list[str] | None = None
    image_url: str | None = None


class KioskPriceComparison(BaseModel):
    """Price comparison data."""
    current_price: int | None = None
    average_price: int | None = None
    lowest_price: int | None = None
    price_history: list[dict] = []


class KioskReviews(BaseModel):
    """Review summary for kiosk display."""
    average_rating: float | None = None
    total_reviews: int = 0
    recent_reviews: list[dict] = []


class KioskScanResponse(BaseModel):
    """Response from kiosk scan."""
    success: bool
    product: KioskProductInfo | None = None
    price_comparison: KioskPriceComparison | None = None
    reviews: KioskReviews | None = None
    error: str | None = None


# ==================== Kiosk Heartbeat Models ====================

class KioskHeartbeatRequest(BaseModel):
    """Kiosk heartbeat request."""
    session_token: str
    battery_level: int | None = Field(None, ge=0, le=100)
    memory_usage_mb: int | None = None
    last_scan_at: datetime | None = None
    error_count: int = 0


class KioskHeartbeatResponse(BaseModel):
    """Kiosk heartbeat response."""
    success: bool
    server_time: datetime
    config_updated: bool = False
    message: str | None = None


# ==================== Kiosk Session Models ====================

class KioskSessionStats(BaseModel):
    """Kiosk session statistics."""
    session_id: str
    kiosk_id: str
    started_at: datetime
    ended_at: datetime | None = None
    products_scanned: int = 0
    reviews_submitted: int = 0
    loyalty_signups: int = 0
    duration_seconds: int | None = None


class KioskPrintRequest(BaseModel):
    """Request to print product summary."""
    session_token: str
    product_id: str
    include_qr: bool = True


class KioskPrintResponse(BaseModel):
    """Response with printable content."""
    success: bool
    print_data: str | None = None
    error: str | None = None
