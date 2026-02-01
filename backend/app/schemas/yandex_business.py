"""
Yandex Business Integration Schemas.

Defines models for Yandex Business profile linking and review import.
Note: Yandex doesn't provide a public API for reviews, so this uses:
- Manual CSV import from Yandex Business dashboard
- Profile linking for verification
- Rating badge display
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class YandexBusinessStatus(str, Enum):
    """Status of Yandex Business profile link."""
    PENDING = "pending"      # Link requested, awaiting verification
    VERIFIED = "verified"    # Ownership verified
    UNVERIFIED = "unverified"  # Not verified yet
    REJECTED = "rejected"    # Verification rejected


class YandexBusinessProfileLink(BaseModel):
    """Linked Yandex Business profile information."""
    id: str
    organization_id: str
    yandex_permalink: str  # e.g., "1234567890" from maps.yandex.ru/org/1234567890
    yandex_url: Optional[str] = None  # Full URL to Yandex profile
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    yandex_rating: Optional[float] = None  # 0.0 - 5.0
    yandex_review_count: Optional[int] = None
    status: YandexBusinessStatus = YandexBusinessStatus.UNVERIFIED
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class LinkYandexBusinessRequest(BaseModel):
    """Request to link a Yandex Business profile."""
    yandex_url: str = Field(
        ...,
        description="URL профиля на Яндекс Картах, например: https://yandex.ru/maps/org/название/1234567890/"
    )

    @field_validator('yandex_url')
    @classmethod
    def validate_yandex_url(cls, v: str) -> str:
        """Extract and validate Yandex Maps organization URL."""
        import re
        # Accept various Yandex Maps URL formats
        patterns = [
            r'yandex\.[a-z]+/maps/org/[^/]+/(\d+)',  # Standard format
            r'yandex\.[a-z]+/maps/-/[^/]+/(\d+)',     # Alternative format
            r'maps\.yandex\.[a-z]+/org/[^/]+/(\d+)',  # maps.yandex format
        ]
        for pattern in patterns:
            match = re.search(pattern, v)
            if match:
                return v
        raise ValueError(
            'Неверный формат URL. Используйте ссылку с Яндекс Карт, '
            'например: https://yandex.ru/maps/org/название/1234567890/'
        )


class UpdateYandexRatingRequest(BaseModel):
    """Request to manually update Yandex rating."""
    rating: float = Field(..., ge=0.0, le=5.0)
    review_count: int = Field(..., ge=0)


class YandexReviewImportRow(BaseModel):
    """Single review row from Yandex Business CSV export."""
    author_name: str
    rating: int = Field(..., ge=1, le=5)
    text: str
    date: str  # Will be parsed to datetime
    response_text: Optional[str] = None
    response_date: Optional[str] = None


class YandexReviewImportRequest(BaseModel):
    """Request to import reviews from Yandex Business CSV."""
    reviews: list[YandexReviewImportRow]


class YandexReviewImportResult(BaseModel):
    """Result of Yandex review import."""
    total_submitted: int
    imported: int
    skipped_duplicates: int
    skipped_errors: int
    errors: list[str] = []


class YandexBusinessProfileResponse(BaseModel):
    """Full Yandex Business profile info for organization."""
    link: Optional[YandexBusinessProfileLink] = None
    is_linked: bool = False
    can_display_badge: bool = False  # True if verified and has rating
