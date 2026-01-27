from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator
import re


class QRCode(BaseModel):
    id: str
    organization_id: str
    code: str
    label: str | None = None
    target_type: str
    target_slug: str | None = None
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class QRCodeCreate(BaseModel):
    label: str | None = None
    target_type: Literal['organization'] = 'organization'


class QRCodeStats(BaseModel):
    total: int
    last_7_days: int
    last_30_days: int


class GeoBreakdownItem(BaseModel):
    country: str | None
    city: str | None
    count: int


class UTMBreakdownItem(BaseModel):
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    count: int


class QRCodeDetailedStats(BaseModel):
    total: int
    last_7_days: int
    last_30_days: int
    geo_breakdown: list[GeoBreakdownItem]
    utm_breakdown: list[UTMBreakdownItem]


class QRImageParams(BaseModel):
    """Parameters for QR code image generation."""
    format: Literal["png", "svg"] = "png"
    size: int = 300
    error_correction: Literal["L", "M", "Q", "H"] = "M"

    class Config:
        json_schema_extra = {
            "example": {
                "format": "png",
                "size": 500,
                "error_correction": "Q"
            }
        }


class TimelineDataPoint(BaseModel):
    """Single data point in timeline series."""
    date: str  # ISO 8601 date (YYYY-MM-DD)
    count: int


class QRCodeTimeline(BaseModel):
    """Timeline data for QR code scans over a period."""
    period: Literal["7d", "30d", "90d", "1y"]
    data_points: list[TimelineDataPoint]
    total_scans: int


class QRCustomizationSettings(BaseModel):
    """Full customization settings for a QR code."""
    id: str
    qr_code_id: str
    foreground_color: str
    background_color: str
    logo_url: str | None = None
    logo_size_percent: int = 20
    style: Literal["squares", "dots", "rounded"] = "squares"
    contrast_ratio: float | None = None
    is_valid: bool = True
    created_at: datetime
    updated_at: datetime


class QRCustomizationUpdate(BaseModel):
    """Payload for updating QR code customization."""
    foreground_color: str | None = None
    background_color: str | None = None
    logo_url: str | None = None
    logo_size_percent: int | None = None
    style: Literal["squares", "dots", "rounded"] | None = None

    @field_validator('foreground_color', 'background_color')
    @classmethod
    def validate_hex_color(cls, v: str | None) -> str | None:
        """Validate hex color format (#RRGGBB)."""
        if v is None:
            return v
        if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be in hex format (#RRGGBB)')
        return v.upper()

    @field_validator('logo_size_percent')
    @classmethod
    def validate_logo_size(cls, v: int | None) -> int | None:
        """Validate logo size is between 10-30%."""
        if v is not None and not (10 <= v <= 30):
            raise ValueError('Logo size must be between 10 and 30 percent')
        return v


class QRBulkCreateRequest(BaseModel):
    """Request payload for bulk creating QR codes."""
    labels: list[str]

    @field_validator('labels')
    @classmethod
    def validate_labels(cls, v: list[str]) -> list[str]:
        """Validate labels list."""
        if len(v) == 0:
            raise ValueError('Labels list cannot be empty')
        if len(v) > 50:
            raise ValueError('Maximum 50 QR codes per batch')
        # Remove empty strings and duplicates
        cleaned = [label.strip() for label in v if label.strip()]
        if len(cleaned) == 0:
            raise ValueError('No valid labels provided')
        return cleaned

