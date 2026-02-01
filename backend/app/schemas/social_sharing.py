"""
Pydantic schemas for social sharing functionality.
Tracks share events and generates share card data.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class SharePlatform(str, Enum):
    """Social platform where content was shared."""
    telegram = 'telegram'
    whatsapp = 'whatsapp'
    vk = 'vk'
    twitter = 'twitter'
    facebook = 'facebook'
    copy_link = 'copy_link'
    qr_code = 'qr_code'
    other = 'other'


class ShareTargetType(str, Enum):
    """Type of content being shared."""
    product = 'product'
    organization = 'organization'
    post = 'post'
    review = 'review'


class ShareEventCreate(BaseModel):
    """Request to log a share event."""
    target_type: ShareTargetType
    target_id: str = Field(..., description='ID of the shared entity')
    platform: SharePlatform
    referrer_url: Optional[str] = None
    user_agent: Optional[str] = None


class ShareEvent(BaseModel):
    """A logged share event."""
    id: str
    user_id: Optional[str] = None  # Null for anonymous shares
    target_type: ShareTargetType
    target_id: str
    platform: SharePlatform
    referrer_url: Optional[str] = None
    ip_hash: Optional[str] = None  # Hashed for privacy
    created_at: datetime


class ShareCardData(BaseModel):
    """Data for generating a share card/preview."""
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    canonical_url: str
    og_type: str = 'website'
    site_name: str = 'Работаем Честно'
    # Additional metadata
    target_type: ShareTargetType
    target_id: str
    # Stats for display
    followers_count: Optional[int] = None
    shares_count: Optional[int] = None
    # Organization branding (if applicable)
    organization_name: Optional[str] = None
    organization_logo_url: Optional[str] = None


class ShareStats(BaseModel):
    """Sharing statistics for an entity."""
    target_type: ShareTargetType
    target_id: str
    total_shares: int = 0
    shares_by_platform: dict = Field(default_factory=dict)
    last_shared_at: Optional[datetime] = None
