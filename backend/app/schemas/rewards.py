"""
Review Rewards System Schemas.

Defines Pydantic models for the "Баллы за отзывы" reward system:
- Partner discounts and vouchers
- Quality-based points calculation
- Anti-abuse tracking
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================

class PartnerCategory(str, Enum):
    """Categories of reward partners."""
    ECOMMERCE = "ecommerce"
    FOOD = "food"
    ENTERTAINMENT = "entertainment"
    SERVICES = "services"
    TRAVEL = "travel"
    EDUCATION = "education"


class RewardType(str, Enum):
    """Types of rewards available."""
    DISCOUNT_PERCENT = "discount_percent"
    DISCOUNT_FIXED = "discount_fixed"
    FREEBIE = "freebie"
    SUBSCRIPTION = "subscription"
    CASHBACK = "cashback"
    EXCLUSIVE_ACCESS = "exclusive_access"


class RedemptionStatus(str, Enum):
    """Status of a reward redemption."""
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AbuseSignalType(str, Enum):
    """Types of abuse signals."""
    RAPID_SUBMISSION = "rapid_submission"
    COPY_PASTE = "copy_paste"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    IP_ANOMALY = "ip_anomaly"
    VOTE_MANIPULATION = "vote_manipulation"
    LOW_QUALITY_BURST = "low_quality_burst"
    NEW_ACCOUNT_ABUSE = "new_account_abuse"


class AbuseSeverity(str, Enum):
    """Severity levels for abuse signals."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# =============================================================================
# QUALITY SCORING CONFIG
# =============================================================================

class ReviewQualityConfig(BaseModel):
    """Configuration for quality-based points calculation."""
    config_version: int = 1

    # Base points
    base_points: int = 10

    # Length bonuses
    min_words_for_bonus: int = 50
    words_tier_1: int = 100
    words_tier_1_bonus: int = 10
    words_tier_2: int = 200
    words_tier_2_bonus: int = 25
    words_tier_3: int = 400
    words_tier_3_bonus: int = 50

    # Media bonuses
    photo_bonus: int = 15
    photo_max_count: int = 3
    video_bonus: int = 30

    # Quality bonuses
    verified_purchase_bonus: int = 20
    helpful_vote_bonus: int = 3
    helpful_vote_max: int = 20

    # Anti-abuse limits
    daily_review_limit: int = 5
    weekly_review_limit: int = 20
    min_account_age_days: int = 3
    min_words_for_points: int = 30


# Default config
DEFAULT_QUALITY_CONFIG = ReviewQualityConfig()


# =============================================================================
# POINTS CALCULATION
# =============================================================================

class ReviewQualityBreakdown(BaseModel):
    """Detailed breakdown of how points were calculated."""
    word_count: int
    photo_count: int
    video_count: int
    is_verified_purchase: bool
    helpful_votes: int = 0

    # Calculated values
    quality_score: int  # 0-100
    base_points: int
    length_bonus: int
    photo_bonus: int
    video_bonus: int
    verified_bonus: int
    helpful_bonus: int
    total_points: int

    # Tier reached
    length_tier: str  # "none", "basic", "medium", "detailed"


class PointsCalculationRequest(BaseModel):
    """Request to calculate points for a review."""
    word_count: int
    photo_count: int = 0
    video_count: int = 0
    is_verified_purchase: bool = False
    helpful_votes: int = 0


class PointsCalculationResponse(BaseModel):
    """Response with points calculation breakdown."""
    breakdown: ReviewQualityBreakdown
    config: ReviewQualityConfig


# =============================================================================
# PARTNER MODELS
# =============================================================================

class RewardPartner(BaseModel):
    """A partner company providing rewards."""
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    category: PartnerCategory
    is_active: bool = True
    priority: int = 0


class RewardPartnerListResponse(BaseModel):
    """List of reward partners."""
    partners: list[RewardPartner]
    total: int


# =============================================================================
# REWARD CATALOG MODELS
# =============================================================================

class RewardItem(BaseModel):
    """A reward available for redemption."""
    id: str
    partner_id: str
    partner_name: str
    partner_logo_url: Optional[str] = None

    title: str
    description: Optional[str] = None
    terms: Optional[str] = None

    reward_type: RewardType
    discount_percent: Optional[int] = None
    discount_amount: Optional[int] = None  # In kopeks
    min_purchase_amount: Optional[int] = None

    points_cost: int
    is_active: bool = True
    stock_remaining: Optional[int] = None  # None = unlimited

    max_per_user: int = 1
    valid_days: int = 30

    image_url: Optional[str] = None
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None

    # User context (filled when user is logged in)
    user_can_afford: bool = False
    user_redemptions_count: int = 0
    user_can_redeem: bool = False


class RewardCatalogResponse(BaseModel):
    """Paginated rewards catalog."""
    rewards: list[RewardItem]
    total: int
    categories: list[PartnerCategory]


# =============================================================================
# REDEMPTION MODELS
# =============================================================================

class RedeemRewardRequest(BaseModel):
    """Request to redeem a reward."""
    reward_id: str


class RewardRedemption(BaseModel):
    """A user's reward redemption."""
    id: str
    user_id: str
    reward_id: str

    # Reward info (denormalized for display)
    reward_title: str
    partner_name: str
    partner_logo_url: Optional[str] = None
    reward_type: RewardType

    points_spent: int
    voucher_code: str
    status: RedemptionStatus

    used_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime


class RedemptionHistoryResponse(BaseModel):
    """User's redemption history."""
    redemptions: list[RewardRedemption]
    total: int
    has_more: bool


class RedeemRewardResponse(BaseModel):
    """Response after redeeming a reward."""
    success: bool
    redemption: Optional[RewardRedemption] = None
    error: Optional[str] = None
    new_balance: int


# =============================================================================
# RATE LIMITING MODELS
# =============================================================================

class RateLimitStatus(BaseModel):
    """User's current rate limit status."""
    allowed: bool
    reason: Optional[str] = None  # 'cooldown', 'daily_limit', 'weekly_limit', 'flagged', 'account_too_new'

    daily_remaining: Optional[int] = None
    weekly_remaining: Optional[int] = None
    daily_limit: int
    weekly_limit: int

    cooldown_until: Optional[datetime] = None
    is_flagged: bool = False
    flag_reason: Optional[str] = None


# =============================================================================
# ABUSE DETECTION MODELS
# =============================================================================

class AbuseSignal(BaseModel):
    """A detected abuse signal."""
    id: str
    user_id: str
    review_id: Optional[str] = None
    signal_type: AbuseSignalType
    severity: AbuseSeverity
    description: Optional[str] = None
    metadata: Optional[dict] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_action: Optional[str] = None
    created_at: datetime


class AbuseSignalsResponse(BaseModel):
    """List of abuse signals for admin."""
    signals: list[AbuseSignal]
    total: int
    unresolved_count: int


class ResolveAbuseRequest(BaseModel):
    """Admin request to resolve an abuse signal."""
    resolution_action: str = Field(..., description="One of: dismissed, warning, points_revoked, banned")
    notes: Optional[str] = None


# =============================================================================
# USER REWARDS DASHBOARD
# =============================================================================

class UserRewardsOverview(BaseModel):
    """Overview of user's rewards status."""
    # Points
    current_points: int
    lifetime_points: int
    points_spent: int

    # Activity
    total_reviews: int
    reviews_earning_points: int
    average_quality_score: float

    # Rewards
    active_vouchers: int
    used_vouchers: int
    expired_vouchers: int

    # Rate limits
    rate_limit_status: RateLimitStatus

    # Recent activity
    recent_redemptions: list[RewardRedemption]
    suggested_rewards: list[RewardItem]
