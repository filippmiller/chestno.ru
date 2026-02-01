"""
Review Votes Schemas
Pydantic models for the review helpfulness voting system
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# Vote type literals
VoteType = Literal['up', 'down', 'none']
VoteAction = Literal['created', 'updated', 'removed']


class CastVoteRequest(BaseModel):
    """Request to cast or update a vote."""
    vote_type: VoteType = Field(..., description="Vote type: 'up', 'down', or 'none' to remove")


class CastVoteResponse(BaseModel):
    """Response from casting a vote."""
    success: bool
    action: VoteAction
    vote_type: Literal['up', 'down'] | None
    vote_weight: float | None = None
    previous_vote: Literal['up', 'down'] | None = None


class UserVoteResponse(BaseModel):
    """Response for getting user's current vote."""
    review_id: str
    vote_type: Literal['up', 'down'] | None


class BatchVotesRequest(BaseModel):
    """Request for batch vote lookup."""
    review_ids: list[str] = Field(..., min_length=1, max_length=100)


class BatchVotesResponse(BaseModel):
    """Response for batch vote lookup."""
    votes: list[UserVoteResponse]


class VoteStats(BaseModel):
    """Vote statistics for a review."""
    upvotes: int
    downvotes: int
    total_votes: int
    wilson_score: float
    net_score: int
    helpful_percentage: int


class ReviewWithVotes(BaseModel):
    """Review with vote information included."""
    id: str
    organization_id: str
    product_id: str | None = None
    author_user_id: str
    rating: int
    title: str | None = None
    body: str
    status: Literal['pending', 'approved', 'rejected']
    created_at: datetime
    updated_at: datetime

    # Vote fields
    upvote_count: int = 0
    downvote_count: int = 0
    helpful_count: int = 0
    wilson_score: float = 0.0

    # Verification
    is_verified_purchase: bool = False

    # User's current vote (populated when authenticated)
    user_vote: Literal['up', 'down'] | None = None

    class Config:
        from_attributes = True


class ReviewsSortOption(BaseModel):
    """Sorting options for reviews."""
    sort: Literal['most_helpful', 'most_recent', 'highest_rated', 'lowest_rated'] = 'most_recent'


class VerifiedPurchase(BaseModel):
    """Verified purchase record."""
    id: str
    user_id: str
    organization_id: str
    product_id: str | None = None
    verification_method: Literal['qr_scan', 'receipt_upload', 'order_integration', 'manual_approval']
    verified_at: datetime
    purchase_date: datetime | None = None

    class Config:
        from_attributes = True


class VerifyPurchaseRequest(BaseModel):
    """Request to verify a purchase."""
    organization_id: str
    product_id: str | None = None
    verification_method: Literal['qr_scan', 'receipt_upload', 'order_integration']
    evidence_data: dict | None = None
    purchase_date: datetime | None = None
