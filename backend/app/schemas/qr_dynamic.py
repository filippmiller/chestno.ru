"""
Schemas for Dynamic QR URL System

Supports:
- URL versioning (change destination without reprinting)
- Campaign scheduling (time-based URL changes)
- A/B testing (split traffic between destinations)
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator
import re


# ============================================================================
# URL VERSIONS
# ============================================================================

class QRUrlVersionBase(BaseModel):
    """Base schema for URL version."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    target_url: str = Field(..., min_length=1, max_length=2000)
    target_type: Literal['organization', 'product', 'custom', 'external'] = 'custom'

    @field_validator('target_url')
    @classmethod
    def validate_target_url(cls, v: str) -> str:
        """Validate URL format - allow relative paths or full URLs."""
        v = v.strip()
        # Allow relative paths starting with /
        if v.startswith('/'):
            return v
        # Allow full URLs
        if re.match(r'^https?://', v):
            return v
        raise ValueError('URL must start with / for relative paths or http(s):// for external URLs')


class QRUrlVersionCreate(QRUrlVersionBase):
    """Schema for creating a new URL version."""
    is_default: bool = False


class QRUrlVersionUpdate(BaseModel):
    """Schema for updating a URL version."""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    target_url: str | None = Field(None, min_length=1, max_length=2000)
    target_type: Literal['organization', 'product', 'custom', 'external'] | None = None
    is_default: bool | None = None
    is_active: bool | None = None

    @field_validator('target_url')
    @classmethod
    def validate_target_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if v.startswith('/') or re.match(r'^https?://', v):
            return v
        raise ValueError('URL must start with / or http(s)://')


class QRUrlVersion(QRUrlVersionBase):
    """Full URL version model."""
    id: str
    qr_code_id: str
    version_number: int
    is_active: bool
    is_default: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None

    # Statistics (computed)
    total_clicks: int = 0


class QRUrlVersionWithStats(QRUrlVersion):
    """URL version with detailed statistics."""
    clicks_7d: int = 0
    clicks_30d: int = 0
    unique_visitors: int = 0


# ============================================================================
# CAMPAIGNS
# ============================================================================

class QRCampaignBase(BaseModel):
    """Base schema for campaign."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    url_version_id: str
    starts_at: datetime
    ends_at: datetime | None = None
    timezone: str = 'Europe/Moscow'
    priority: int = Field(default=0, ge=0, le=100)
    recurrence_rule: str | None = None  # iCal RRULE format


class QRCampaignCreate(QRCampaignBase):
    """Schema for creating a campaign."""
    pass


class QRCampaignUpdate(BaseModel):
    """Schema for updating a campaign."""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    url_version_id: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone: str | None = None
    priority: int | None = Field(None, ge=0, le=100)
    recurrence_rule: str | None = None
    status: Literal['draft', 'scheduled', 'active', 'paused', 'cancelled'] | None = None


class QRCampaign(QRCampaignBase):
    """Full campaign model."""
    id: str
    qr_code_id: str
    status: Literal['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']
    created_by: str
    created_at: datetime
    updated_at: datetime

    # Joined data
    url_version_name: str | None = None


class QRCampaignWithStats(QRCampaign):
    """Campaign with statistics."""
    total_clicks: int = 0
    unique_visitors: int = 0


# ============================================================================
# A/B TESTS
# ============================================================================

class QRABTestVariantBase(BaseModel):
    """Base schema for A/B test variant."""
    url_version_id: str
    variant_name: str = Field(default='Variant', min_length=1, max_length=50)
    weight: int = Field(default=50, ge=0, le=100)


class QRABTestVariantCreate(QRABTestVariantBase):
    """Schema for creating a variant."""
    pass


class QRABTestVariant(QRABTestVariantBase):
    """Full variant model."""
    id: str
    ab_test_id: str
    total_clicks: int = 0
    unique_visitors: int = 0
    created_at: datetime

    # Computed
    conversion_rate: float = 0.0  # If we have conversion tracking


class QRABTestBase(BaseModel):
    """Base schema for A/B test."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    hypothesis: str | None = None
    starts_at: datetime | None = None  # Default to now
    ends_at: datetime | None = None
    min_sample_size: int = Field(default=100, ge=10)
    confidence_level: float = Field(default=0.95, ge=0.80, le=0.99)


class QRABTestCreate(QRABTestBase):
    """Schema for creating an A/B test."""
    variants: list[QRABTestVariantCreate] = Field(..., min_length=2, max_length=5)

    @field_validator('variants')
    @classmethod
    def validate_variants_weight(cls, v: list[QRABTestVariantCreate]) -> list[QRABTestVariantCreate]:
        """Ensure variant weights sum to 100."""
        total_weight = sum(variant.weight for variant in v)
        if total_weight != 100:
            raise ValueError(f'Variant weights must sum to 100, got {total_weight}')
        return v


class QRABTestUpdate(BaseModel):
    """Schema for updating an A/B test."""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    hypothesis: str | None = None
    ends_at: datetime | None = None
    status: Literal['draft', 'running', 'paused'] | None = None


class QRABTestConclude(BaseModel):
    """Schema for concluding an A/B test."""
    winning_variant_id: str
    conclusion_notes: str | None = None
    apply_winner: bool = False  # If true, make winning variant the default


class QRABTest(QRABTestBase):
    """Full A/B test model."""
    id: str
    qr_code_id: str
    status: Literal['draft', 'running', 'paused', 'concluded']
    winning_variant_id: str | None = None
    concluded_at: datetime | None = None
    concluded_by: str | None = None
    conclusion_notes: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class QRABTestWithVariants(QRABTest):
    """A/B test with all variants."""
    variants: list[QRABTestVariant] = []
    total_clicks: int = 0


class QRABTestResults(BaseModel):
    """Statistical results for an A/B test."""
    test_id: str
    status: str
    total_clicks: int
    variants: list[QRABTestVariant]

    # Statistical analysis
    has_enough_data: bool
    recommended_winner: str | None = None
    confidence: float = 0.0
    improvement_percent: float = 0.0
    days_running: int = 0


# ============================================================================
# REDIRECT RESOLUTION
# ============================================================================

class ResolvedQRUrl(BaseModel):
    """Result of resolving which URL to redirect to."""
    target_url: str
    url_version_id: str | None = None
    campaign_id: str | None = None
    ab_test_id: str | None = None
    ab_variant_id: str | None = None
    resolution_type: Literal['ab_test', 'campaign', 'default', 'legacy']


# ============================================================================
# VERSION HISTORY
# ============================================================================

class QRUrlVersionHistoryItem(BaseModel):
    """Single history entry."""
    id: str
    url_version_id: str
    action: Literal['created', 'updated', 'activated', 'deactivated', 'archived']
    changes: dict | None = None
    performed_by: str
    performed_at: datetime


# ============================================================================
# ANALYTICS
# ============================================================================

class QRVersionAnalytics(BaseModel):
    """Analytics for a specific URL version."""
    version_id: str
    version_name: str
    total_clicks: int
    unique_visitors: int
    clicks_by_day: list[dict]  # [{"date": "2026-01-15", "count": 42}, ...]
    top_countries: list[dict]  # [{"country": "RU", "count": 100}, ...]
    top_cities: list[dict]


class QRDynamicOverview(BaseModel):
    """Overview of dynamic QR features for a QR code."""
    qr_code_id: str
    total_versions: int
    active_version: QRUrlVersion | None
    active_campaign: QRCampaign | None
    running_ab_test: QRABTest | None
    total_clicks_all_time: int
    total_clicks_30d: int
