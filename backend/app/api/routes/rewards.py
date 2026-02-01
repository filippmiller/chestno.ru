"""
Review Rewards API Routes.

Endpoints for the "Баллы за отзывы" system:
- Points calculator preview
- Rewards catalog
- Redemption management
- User rewards dashboard
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user, get_optional_current_user
from app.schemas.rewards import (
    PartnerCategory,
    PointsCalculationRequest,
    PointsCalculationResponse,
    RateLimitStatus,
    RedeemRewardRequest,
    RedeemRewardResponse,
    RedemptionHistoryResponse,
    RedemptionStatus,
    ReviewQualityConfig,
    RewardCatalogResponse,
    RewardPartnerListResponse,
    UserRewardsOverview,
)
from app.services.rewards import (
    calculate_review_points,
    check_rate_limit,
    get_partners,
    get_quality_config,
    get_rewards_catalog,
    get_user_redemptions,
    get_user_rewards_overview,
    redeem_reward,
)

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


# =============================================================================
# PUBLIC ENDPOINTS
# =============================================================================

@router.get("/config", response_model=ReviewQualityConfig)
def get_points_config():
    """
    Get current points calculation configuration.

    This shows users how many points they can earn for different actions.
    """
    return get_quality_config()


@router.post("/calculate", response_model=PointsCalculationResponse)
def preview_points_calculation(request: PointsCalculationRequest):
    """
    Preview points calculation for a review.

    Use this to show users how many points they'll earn based on:
    - Word count
    - Photo/video attachments
    - Verified purchase status
    """
    return calculate_review_points(request)


@router.get("/partners", response_model=RewardPartnerListResponse)
def list_partners(
    category: Optional[PartnerCategory] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Get list of reward partner companies.

    Returns partners grouped by category with their logos and descriptions.
    """
    return get_partners(category=category, limit=limit)


@router.get("/catalog", response_model=RewardCatalogResponse)
def list_rewards(
    current_user: Optional[dict] = Depends(get_optional_current_user),
    category: Optional[PartnerCategory] = Query(None, description="Filter by partner category"),
    affordable_only: bool = Query(False, description="Only show rewards user can afford"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Get rewards catalog.

    When authenticated, shows:
    - Whether user can afford each reward
    - User's redemption count for each reward
    - Whether user can still redeem each reward
    """
    user_id = current_user["id"] if current_user else None
    return get_rewards_catalog(
        user_id=user_id,
        category=category,
        affordable_only=affordable_only,
        limit=limit,
        offset=offset,
    )


# =============================================================================
# AUTHENTICATED ENDPOINTS
# =============================================================================

@router.get("/me/overview", response_model=UserRewardsOverview)
def get_my_rewards_overview(current_user: dict = Depends(get_current_user)):
    """
    Get user's rewards dashboard overview.

    Returns:
    - Current and lifetime points
    - Review statistics
    - Voucher counts
    - Rate limit status
    - Recent redemptions
    - Suggested rewards
    """
    return get_user_rewards_overview(current_user["id"])


@router.get("/me/rate-limit", response_model=RateLimitStatus)
def get_my_rate_limit(current_user: dict = Depends(get_current_user)):
    """
    Check user's current rate limit status.

    Use before submitting a review to warn user if they're approaching limits.
    """
    return check_rate_limit(current_user["id"])


@router.post("/redeem", response_model=RedeemRewardResponse)
def redeem_reward_endpoint(
    request: RedeemRewardRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Redeem a reward using points.

    Deducts points and generates a voucher code.
    Returns the voucher code and updated points balance.
    """
    return redeem_reward(current_user["id"], request.reward_id)


@router.get("/me/redemptions", response_model=RedemptionHistoryResponse)
def get_my_redemptions(
    current_user: dict = Depends(get_current_user),
    status_filter: Optional[RedemptionStatus] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Get user's reward redemption history.

    Shows all vouchers with their codes, status, and expiration dates.
    """
    return get_user_redemptions(
        user_id=current_user["id"],
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/me/voucher/{redemption_id}")
def get_voucher_details(
    redemption_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get details of a specific voucher.

    Returns voucher code and usage instructions.
    """
    redemptions = get_user_redemptions(current_user["id"], limit=100)

    for r in redemptions.redemptions:
        if r.id == redemption_id:
            return {
                "voucher": r,
                "instructions": {
                    "code": r.voucher_code,
                    "expires": r.expires_at.isoformat(),
                    "status": r.status,
                    "how_to_use": f"Введите код {r.voucher_code} при оформлении заказа на сайте {r.partner_name}",
                }
            }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Ваучер не найден"
    )
