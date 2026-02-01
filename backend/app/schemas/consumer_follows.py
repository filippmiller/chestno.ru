"""
Pydantic schemas for consumer follow/subscription functionality.
Allows consumers to follow organizations and products.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FollowTargetType(str, Enum):
    """Type of entity being followed."""
    organization = 'organization'
    product = 'product'


class NotificationChannel(str, Enum):
    """Notification delivery channel."""
    email = 'email'
    push = 'push'
    telegram = 'telegram'


class NotificationPreferences(BaseModel):
    """User preferences for follow notifications."""
    email_enabled: bool = True
    push_enabled: bool = False
    telegram_enabled: bool = False
    notify_on_new_products: bool = True
    notify_on_journey_updates: bool = True
    notify_on_price_changes: bool = True
    notify_on_posts: bool = False


class ConsumerFollowCreate(BaseModel):
    """Request to create a new follow/subscription."""
    target_type: FollowTargetType
    target_id: str = Field(..., description='Organization or product ID')
    preferences: Optional[NotificationPreferences] = None


class ConsumerFollowUpdate(BaseModel):
    """Update notification preferences for an existing follow."""
    preferences: NotificationPreferences


class ConsumerFollow(BaseModel):
    """A consumer's follow record."""
    id: str
    user_id: str
    target_type: FollowTargetType
    target_id: str
    preferences: NotificationPreferences
    created_at: datetime
    updated_at: datetime


class FollowedOrganization(BaseModel):
    """Organization data for follows list."""
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None


class FollowedProduct(BaseModel):
    """Product data for follows list."""
    id: str
    name: str
    slug: str
    main_image_url: Optional[str] = None
    organization_name: Optional[str] = None


class ConsumerFollowWithTarget(ConsumerFollow):
    """Follow record with resolved target info."""
    organization: Optional[FollowedOrganization] = None
    product: Optional[FollowedProduct] = None


class ConsumerFollowsList(BaseModel):
    """Paginated list of follows."""
    items: List[ConsumerFollowWithTarget]
    total: int
    has_more: bool
