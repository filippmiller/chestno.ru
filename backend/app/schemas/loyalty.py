"""
Loyalty Points System Schemas.

Defines Pydantic models for the reviewer loyalty/gamification system.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PointsActionType(str, Enum):
    """Types of actions that earn or spend points."""
    # Earning actions
    REVIEW_SUBMITTED = "review_submitted"
    REVIEW_APPROVED = "review_approved"
    REVIEW_WITH_PHOTO = "review_with_photo"
    REVIEW_WITH_VIDEO = "review_with_video"
    REVIEW_HELPFUL_VOTE = "review_helpful_vote"
    FIRST_REVIEW = "first_review"
    STREAK_BONUS = "streak_bonus"
    PROFILE_COMPLETED = "profile_completed"
    REFERRAL_BONUS = "referral_bonus"

    # Spending/adjustment actions
    POINTS_REDEEMED = "points_redeemed"
    ADMIN_ADJUSTMENT = "admin_adjustment"
    POINTS_EXPIRED = "points_expired"


class LoyaltyTier(str, Enum):
    """Reviewer loyalty tiers based on points."""
    BRONZE = "bronze"      # 0-99 points
    SILVER = "silver"      # 100-499 points
    GOLD = "gold"          # 500-1499 points
    PLATINUM = "platinum"  # 1500+ points


# Points values for each action
POINTS_CONFIG = {
    PointsActionType.REVIEW_SUBMITTED: 5,
    PointsActionType.REVIEW_APPROVED: 10,
    PointsActionType.REVIEW_WITH_PHOTO: 5,
    PointsActionType.REVIEW_WITH_VIDEO: 10,
    PointsActionType.REVIEW_HELPFUL_VOTE: 2,
    PointsActionType.FIRST_REVIEW: 20,
    PointsActionType.STREAK_BONUS: 15,  # Per week streak
    PointsActionType.PROFILE_COMPLETED: 25,
    PointsActionType.REFERRAL_BONUS: 50,
}

# Tier thresholds
TIER_THRESHOLDS = {
    LoyaltyTier.BRONZE: 0,
    LoyaltyTier.SILVER: 100,
    LoyaltyTier.GOLD: 500,
    LoyaltyTier.PLATINUM: 1500,
}

# Tier benefits (multipliers, etc.)
TIER_BENEFITS = {
    LoyaltyTier.BRONZE: {
        "points_multiplier": 1.0,
        "badge_color": "#CD7F32",
        "badge_name_ru": "Бронза",
        "badge_name_en": "Bronze",
    },
    LoyaltyTier.SILVER: {
        "points_multiplier": 1.25,
        "badge_color": "#C0C0C0",
        "badge_name_ru": "Серебро",
        "badge_name_en": "Silver",
    },
    LoyaltyTier.GOLD: {
        "points_multiplier": 1.5,
        "badge_color": "#FFD700",
        "badge_name_ru": "Золото",
        "badge_name_en": "Gold",
    },
    LoyaltyTier.PLATINUM: {
        "points_multiplier": 2.0,
        "badge_color": "#E5E4E2",
        "badge_name_ru": "Платина",
        "badge_name_en": "Platinum",
    },
}


class PointsTransaction(BaseModel):
    """A single points transaction record."""
    id: str
    user_id: str
    action_type: PointsActionType
    points: int  # Positive for earning, negative for spending
    balance_after: int
    description: Optional[str] = None
    reference_id: Optional[str] = None  # e.g., review_id
    reference_type: Optional[str] = None  # e.g., "review"
    created_at: datetime


class UserLoyaltyProfile(BaseModel):
    """User's loyalty profile with current status."""
    user_id: str
    total_points: int = 0
    lifetime_points: int = 0  # Total ever earned (doesn't decrease)
    current_tier: LoyaltyTier = LoyaltyTier.BRONZE
    next_tier: Optional[LoyaltyTier] = LoyaltyTier.SILVER
    points_to_next_tier: Optional[int] = None
    tier_progress_percent: float = 0.0
    review_count: int = 0
    helpful_votes_received: int = 0
    current_streak_weeks: int = 0
    longest_streak_weeks: int = 0
    tier_benefits: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class UserLoyaltyResponse(BaseModel):
    """API response for user loyalty data."""
    profile: UserLoyaltyProfile
    recent_transactions: list[PointsTransaction] = []


class PointsHistoryResponse(BaseModel):
    """Paginated points history response."""
    transactions: list[PointsTransaction]
    total: int
    has_more: bool


class LeaderboardEntry(BaseModel):
    """Single entry in the leaderboard."""
    rank: int
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    total_points: int
    tier: LoyaltyTier
    review_count: int


class LeaderboardResponse(BaseModel):
    """Leaderboard response."""
    entries: list[LeaderboardEntry]
    user_rank: Optional[int] = None  # Current user's rank if authenticated
    total_users: int
    period: str  # "all_time", "monthly", "weekly"


class AwardPointsRequest(BaseModel):
    """Admin request to manually award/deduct points."""
    user_id: str
    points: int  # Can be negative for deductions
    reason: str
