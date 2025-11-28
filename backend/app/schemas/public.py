from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from app.schemas.auth import GalleryItem
from app.schemas.products import PublicProduct


class CertificationItem(BaseModel):
    name: str
    issuer: str | None = None
    valid_until: datetime | None = None
    link: str | None = None


class BuyLinkItem(BaseModel):
    label: str
    url: str


class PublicOrganizationSummary(BaseModel):
    name: str
    slug: str
    country: str | None = None
    city: str | None = None
    primary_category: str | None = None
    is_verified: bool = False
    verification_status: str | None = None
    short_description: str | None = None
    main_image_url: str | None = None


class PublicOrganizationDetails(BaseModel):
    name: str
    slug: str
    country: str | None = None
    city: str | None = None
    website_url: str | None = None
    is_verified: bool = False
    verification_status: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    production_description: str | None = None
    safety_and_quality: str | None = None
    video_url: str | None = None
    gallery: List[GalleryItem] = Field(default_factory=list)
    tags: str | None = None
    primary_category: str | None = None
    founded_year: int | None = None
    employee_count: int | None = None
    factory_size: str | None = None
    category: str | None = None
    certifications: List[CertificationItem] = Field(default_factory=list)
    sustainability_practices: str | None = None
    quality_standards: str | None = None
    buy_links: List[BuyLinkItem] = Field(default_factory=list)
    products: List[PublicProduct] = Field(default_factory=list)
    # Contacts
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_website: str | None = None
    contact_address: str | None = None
    contact_telegram: str | None = None
    contact_whatsapp: str | None = None
    social_links: List[dict] = Field(default_factory=list)  # [{type, label, url}]


class PublicOrganizationsResponse(BaseModel):
    items: List[PublicOrganizationSummary]
    total: int

