from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ReviewMediaItem(BaseModel):
    type: Literal['image', 'video']
    url: str
    thumbnail_url: str | None = None
    alt: str | None = None


class ReviewBase(BaseModel):
    rating: int
    title: str | None = None
    body: str
    media: list[ReviewMediaItem] = Field(default_factory=list)

    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError('Rating must be between 1 and 5')
        return v


class ReviewCreate(ReviewBase):
    product_id: str | None = None


class ReviewUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    media: list[ReviewMediaItem] | None = None


class ReviewModeration(BaseModel):
    status: Literal['pending', 'approved', 'rejected']
    moderation_comment: str | None = None


class ReviewResponse(BaseModel):
    response: str = Field(..., min_length=1, description='Response text to the review')


class Review(ReviewBase):
    id: str
    organization_id: str
    product_id: str | None = None
    author_user_id: str
    status: Literal['pending', 'approved', 'rejected']
    moderated_by: str | None = None
    moderated_at: datetime | None = None
    moderation_comment: str | None = None
    response: str | None = None
    response_by: str | None = None
    response_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicReview(BaseModel):
    id: str
    product_id: str | None = None
    author_user_id: str
    rating: int
    title: str | None = None
    body: str
    media: list[ReviewMediaItem] = Field(default_factory=list)
    response: str | None = None
    response_at: datetime | None = None
    created_at: datetime


class ReviewsResponse(BaseModel):
    items: list[Review]
    total: int


class PublicReviewsResponse(BaseModel):
    items: list[PublicReview]
    total: int
    average_rating: float | None = None


class ReviewStats(BaseModel):
    total_reviews: int
    average_rating: float | None = None
    rating_distribution: dict[int, int] = Field(default_factory=dict)  # {1: count, 2: count, ...}

