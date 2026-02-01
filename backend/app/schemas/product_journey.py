"""
Pydantic schemas for product journey tracking.
Tracks the lifecycle/supply chain steps of a product.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class JourneyStepType(str, Enum):
    """Type of journey step."""
    origin = 'origin'              # Raw material source
    processing = 'processing'      # Processing/manufacturing
    quality_check = 'quality_check'
    packaging = 'packaging'
    storage = 'storage'
    transport = 'transport'
    distribution = 'distribution'
    retail = 'retail'
    custom = 'custom'


class JourneyStepStatus(str, Enum):
    """Status of a journey step."""
    pending = 'pending'
    in_progress = 'in_progress'
    completed = 'completed'
    verified = 'verified'


class GeoLocation(BaseModel):
    """Geographic coordinates."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


class JourneyStepCreate(BaseModel):
    """Request to create a journey step."""
    step_type: JourneyStepType
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[GeoLocation] = None
    occurred_at: Optional[datetime] = None
    status: JourneyStepStatus = JourneyStepStatus.completed
    media_urls: Optional[List[str]] = Field(default_factory=list)
    metadata: Optional[dict] = None
    order_index: Optional[int] = None


class JourneyStepUpdate(BaseModel):
    """Request to update a journey step."""
    step_type: Optional[JourneyStepType] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[GeoLocation] = None
    occurred_at: Optional[datetime] = None
    status: Optional[JourneyStepStatus] = None
    media_urls: Optional[List[str]] = None
    metadata: Optional[dict] = None
    order_index: Optional[int] = None


class JourneyStep(BaseModel):
    """A single step in the product journey."""
    id: str
    product_id: str
    step_type: JourneyStepType
    title: str
    description: Optional[str] = None
    location: Optional[GeoLocation] = None
    occurred_at: Optional[datetime] = None
    status: JourneyStepStatus
    media_urls: List[str] = Field(default_factory=list)
    metadata: Optional[dict] = None
    order_index: int
    created_by: str
    created_at: datetime
    updated_at: datetime


class ProductJourney(BaseModel):
    """Complete product journey with all steps."""
    product_id: str
    product_name: str
    product_slug: str
    organization_name: str
    steps: List[JourneyStep] = Field(default_factory=list)
    total_steps: int = 0
    completed_steps: int = 0
    verified_steps: int = 0


class PublicProductPage(BaseModel):
    """Extended public product data for standalone product pages."""
    id: str
    organization_id: str
    organization_name: str
    organization_slug: str
    organization_logo_url: Optional[str] = None
    slug: str
    name: str
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    price_cents: Optional[int] = None
    currency: str = 'RUB'
    main_image_url: Optional[str] = None
    gallery: Optional[List[dict]] = None
    external_url: Optional[str] = None
    sku: Optional[str] = None
    is_variant: bool = False
    # Journey summary
    journey_steps_count: int = 0
    journey_verified_count: int = 0
    # Engagement stats
    followers_count: int = 0
    shares_count: int = 0
    # Timestamps
    created_at: datetime
    updated_at: datetime
