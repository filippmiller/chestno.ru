"""
Schemas for Manufacturer Promotions API.

Pydantic models for creating, updating, and retrieving promotions
and subscriber promo codes.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DiscountType(str, Enum):
    PERCENT = 'percent'
    FIXED = 'fixed'
    FREE_SHIPPING = 'free_shipping'
    CUSTOM = 'custom'


class Platform(str, Enum):
    OWN_WEBSITE = 'own_website'
    OZON = 'ozon'
    WILDBERRIES = 'wildberries'
    YANDEX_MARKET = 'yandex_market'
    OTHER = 'other'


class PromotionStatus(str, Enum):
    DRAFT = 'draft'
    ACTIVE = 'active'
    PAUSED = 'paused'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'


class PromoCodeStatus(str, Enum):
    PENDING = 'pending'
    ACTIVE = 'active'
    USED = 'used'
    EXPIRED = 'expired'


# =============================================================================
# Request Models
# =============================================================================

class PromotionCreate(BaseModel):
    """Create a new promotion."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)

    discount_type: DiscountType
    discount_value: Optional[int] = Field(None, ge=0)  # percent or kopeks
    discount_description: Optional[str] = Field(None, max_length=500)
    min_purchase_amount: Optional[int] = Field(None, ge=0)  # kopeks

    platform: Platform
    platform_name: Optional[str] = Field(None, max_length=100)
    platform_url: Optional[str] = Field(None, max_length=500)

    code_prefix: str = Field('PROMO', min_length=2, max_length=10)

    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class PromotionUpdate(BaseModel):
    """Update an existing promotion."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)

    discount_type: Optional[DiscountType] = None
    discount_value: Optional[int] = Field(None, ge=0)
    discount_description: Optional[str] = Field(None, max_length=500)
    min_purchase_amount: Optional[int] = Field(None, ge=0)

    platform: Optional[Platform] = None
    platform_name: Optional[str] = Field(None, max_length=100)
    platform_url: Optional[str] = Field(None, max_length=500)

    code_prefix: Optional[str] = Field(None, min_length=2, max_length=10)

    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    status: Optional[PromotionStatus] = None


class DistributeRequest(BaseModel):
    """Request to distribute codes to subscribers."""
    notify_email: bool = True
    notify_in_app: bool = True


class MarkCodeUsedRequest(BaseModel):
    """Mark a promo code as used."""
    pass  # No additional fields needed


# =============================================================================
# Response Models
# =============================================================================

class Promotion(BaseModel):
    """Promotion response model."""
    id: UUID
    organization_id: UUID
    title: str
    description: Optional[str]

    discount_type: DiscountType
    discount_value: Optional[int]
    discount_description: Optional[str]
    min_purchase_amount: Optional[int]

    platform: Platform
    platform_name: Optional[str]
    platform_url: Optional[str]

    code_prefix: str

    starts_at: datetime
    ends_at: Optional[datetime]
    status: PromotionStatus

    distributed_at: Optional[datetime]
    total_codes_generated: int
    total_codes_used: int

    created_at: datetime
    updated_at: datetime

    # Computed fields (added by service)
    subscriber_count: Optional[int] = None
    discount_display: Optional[str] = None

    class Config:
        from_attributes = True


class PromotionListResponse(BaseModel):
    """List of promotions."""
    items: list[Promotion]
    total: int
    limit: int
    offset: int


class PromoCode(BaseModel):
    """Promo code response model for users."""
    id: UUID
    promotion_id: UUID
    code: str
    status: PromoCodeStatus
    sent_at: Optional[datetime]
    viewed_at: Optional[datetime]
    used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    # Promotion details (joined)
    promotion_title: Optional[str] = None
    organization_name: Optional[str] = None
    organization_logo: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[int] = None
    discount_description: Optional[str] = None
    discount_display: Optional[str] = None
    platform: Optional[Platform] = None
    platform_name: Optional[str] = None
    platform_url: Optional[str] = None

    class Config:
        from_attributes = True


class PromoCodeListResponse(BaseModel):
    """List of promo codes for a user."""
    items: list[PromoCode]
    total: int
    active_count: int
    used_count: int
    expired_count: int


class DistributeResponse(BaseModel):
    """Response after distributing codes."""
    success: bool
    codes_created: int
    distributed_at: datetime


class SubscriberCountResponse(BaseModel):
    """Subscriber count for preview."""
    count: int
    organization_id: UUID
