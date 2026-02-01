"""
Review Rewards Service.

Manages the "Баллы за отзывы" system including:
- Quality-based points calculation
- Partner rewards catalog
- Voucher redemption
- Anti-abuse detection
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.loyalty import PointsActionType
from app.schemas.rewards import (
    AbuseSeverity,
    AbuseSignal,
    AbuseSignalType,
    AbuseSignalsResponse,
    DEFAULT_QUALITY_CONFIG,
    PartnerCategory,
    PointsCalculationRequest,
    PointsCalculationResponse,
    RateLimitStatus,
    RedeemRewardResponse,
    RedemptionHistoryResponse,
    RedemptionStatus,
    RewardCatalogResponse,
    RewardItem,
    RewardPartner,
    RewardPartnerListResponse,
    RewardRedemption,
    RewardType,
    ReviewQualityBreakdown,
    ReviewQualityConfig,
    UserRewardsOverview,
)
from app.services.loyalty import award_points, ensure_loyalty_profile

logger = logging.getLogger(__name__)


# =============================================================================
# QUALITY CONFIG
# =============================================================================

def get_quality_config() -> ReviewQualityConfig:
    """Get the active quality configuration from database."""
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT * FROM review_quality_config WHERE is_active = true LIMIT 1"
            )
            row = cur.fetchone()

            if row:
                return ReviewQualityConfig(**dict(row))
    except Exception as e:
        logger.warning(f"Failed to load quality config: {e}")

    return DEFAULT_QUALITY_CONFIG


# =============================================================================
# POINTS CALCULATION
# =============================================================================

def count_words(text: str) -> int:
    """Count words in text, handling Russian and English."""
    if not text:
        return 0
    # Split on whitespace and filter empty strings
    words = re.findall(r'\b[\w\u0400-\u04FF]+\b', text, re.UNICODE)
    return len(words)


def calculate_quality_score(
    word_count: int,
    photo_count: int,
    video_count: int,
    is_verified_purchase: bool,
) -> int:
    """
    Calculate quality score (0-100) for a review.

    Components:
    - Word count: 0-40 points
    - Photos: 0-30 points (10 per photo, max 3)
    - Video: 0-15 points
    - Verified purchase: 0-30 points
    """
    config = get_quality_config()
    score = 0

    # Word count score (0-40)
    if word_count >= config.words_tier_3:
        score += 40
    elif word_count >= config.words_tier_2:
        score += 30
    elif word_count >= config.words_tier_1:
        score += 20
    elif word_count >= config.min_words_for_bonus:
        score += 10

    # Photo score (0-30)
    score += min(photo_count, config.photo_max_count) * 10

    # Video score (0-15)
    if video_count > 0:
        score += 15

    # Verified purchase score (0-30)
    if is_verified_purchase:
        score += 30

    return min(100, score)


def calculate_review_points(
    request: PointsCalculationRequest,
    config: Optional[ReviewQualityConfig] = None,
) -> PointsCalculationResponse:
    """
    Calculate points for a review based on quality.

    Returns detailed breakdown of points calculation.
    """
    if config is None:
        config = get_quality_config()

    # Determine length tier
    if request.word_count >= config.words_tier_3:
        length_tier = "detailed"
        length_bonus = config.words_tier_3_bonus
    elif request.word_count >= config.words_tier_2:
        length_tier = "medium"
        length_bonus = config.words_tier_2_bonus
    elif request.word_count >= config.words_tier_1:
        length_tier = "basic"
        length_bonus = config.words_tier_1_bonus
    elif request.word_count >= config.min_words_for_bonus:
        length_tier = "minimal"
        length_bonus = 0
    else:
        length_tier = "none"
        length_bonus = 0

    # Calculate each bonus
    base_points = config.base_points if request.word_count >= config.min_words_for_points else 0
    photo_bonus = min(request.photo_count, config.photo_max_count) * config.photo_bonus
    video_bonus = config.video_bonus if request.video_count > 0 else 0
    verified_bonus = config.verified_purchase_bonus if request.is_verified_purchase else 0
    helpful_bonus = min(
        request.helpful_votes * config.helpful_vote_bonus,
        config.helpful_vote_max
    )

    # Total
    total_points = base_points + length_bonus + photo_bonus + video_bonus + verified_bonus + helpful_bonus

    # Quality score
    quality_score = calculate_quality_score(
        request.word_count,
        request.photo_count,
        request.video_count,
        request.is_verified_purchase,
    )

    breakdown = ReviewQualityBreakdown(
        word_count=request.word_count,
        photo_count=request.photo_count,
        video_count=request.video_count,
        is_verified_purchase=request.is_verified_purchase,
        helpful_votes=request.helpful_votes,
        quality_score=quality_score,
        base_points=base_points,
        length_bonus=length_bonus,
        photo_bonus=photo_bonus,
        video_bonus=video_bonus,
        verified_bonus=verified_bonus,
        helpful_bonus=helpful_bonus,
        total_points=total_points,
        length_tier=length_tier,
    )

    return PointsCalculationResponse(breakdown=breakdown, config=config)


# =============================================================================
# RATE LIMITING
# =============================================================================

def check_rate_limit(user_id: str) -> RateLimitStatus:
    """Check if user can submit a review that earns points."""
    config = get_quality_config()

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Call database function
        cur.execute("SELECT check_review_rate_limit(%s) as result", (user_id,))
        row = cur.fetchone()
        result = row["result"] if row else {"allowed": True}

        return RateLimitStatus(
            allowed=result.get("allowed", True),
            reason=result.get("reason"),
            daily_remaining=result.get("daily_remaining"),
            weekly_remaining=result.get("weekly_remaining"),
            daily_limit=config.daily_review_limit,
            weekly_limit=config.weekly_review_limit,
            cooldown_until=result.get("cooldown_until"),
            is_flagged=result.get("reason") == "flagged",
            flag_reason=result.get("flag_reason"),
        )


def increment_rate_limit(user_id: str) -> None:
    """Increment rate limit counters after review submission."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT increment_review_rate_limit(%s)", (user_id,))
        conn.commit()


# =============================================================================
# PARTNERS & CATALOG
# =============================================================================

def get_partners(
    category: Optional[PartnerCategory] = None,
    limit: int = 50,
) -> RewardPartnerListResponse:
    """Get list of reward partners."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        query = """
            SELECT id, name, slug, logo_url, description, website_url, category, is_active, priority
            FROM reward_partners
            WHERE is_active = true
        """
        params = []

        if category:
            query += " AND category = %s"
            params.append(category.value)

        query += " ORDER BY priority DESC, name LIMIT %s"
        params.append(limit)

        cur.execute(query, params)
        rows = cur.fetchall()

    partners = [
        RewardPartner(
            id=str(r["id"]),
            name=r["name"],
            slug=r["slug"],
            logo_url=r["logo_url"],
            description=r["description"],
            website_url=r["website_url"],
            category=PartnerCategory(r["category"]),
            is_active=r["is_active"],
            priority=r["priority"],
        )
        for r in rows
    ]

    return RewardPartnerListResponse(partners=partners, total=len(partners))


def get_rewards_catalog(
    user_id: Optional[str] = None,
    category: Optional[PartnerCategory] = None,
    affordable_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> RewardCatalogResponse:
    """Get available rewards, optionally filtered by user affordability."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get user's current points if logged in
        user_points = 0
        user_redemptions = {}

        if user_id:
            cur.execute(
                "SELECT total_points FROM user_loyalty_profiles WHERE user_id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if row:
                user_points = row["total_points"]

            # Get user's redemption counts per reward
            cur.execute(
                """
                SELECT reward_id, COUNT(*) as count
                FROM reward_redemptions
                WHERE user_id = %s AND status != 'cancelled'
                GROUP BY reward_id
                """,
                (user_id,)
            )
            for r in cur.fetchall():
                user_redemptions[str(r["reward_id"])] = r["count"]

        # Build query
        query = """
            SELECT
                rc.id, rc.partner_id, rc.title, rc.description, rc.terms,
                rc.reward_type, rc.discount_percent, rc.discount_amount,
                rc.min_purchase_amount, rc.points_cost, rc.is_active,
                rc.stock_remaining, rc.max_per_user, rc.valid_days,
                rc.image_url, rc.available_from, rc.available_until,
                rp.name as partner_name, rp.logo_url as partner_logo_url,
                rp.category as partner_category
            FROM rewards_catalog rc
            JOIN reward_partners rp ON rp.id = rc.partner_id
            WHERE rc.is_active = true
              AND rp.is_active = true
              AND (rc.available_from IS NULL OR rc.available_from <= now())
              AND (rc.available_until IS NULL OR rc.available_until >= now())
              AND (rc.stock_remaining IS NULL OR rc.stock_remaining > 0)
        """
        params = []

        if category:
            query += " AND rp.category = %s"
            params.append(category.value)

        if affordable_only and user_id:
            query += " AND rc.points_cost <= %s"
            params.append(user_points)

        # Get total count
        count_query = f"SELECT COUNT(*) as count FROM ({query}) sub"
        cur.execute(count_query, params)
        total = cur.fetchone()["count"]

        # Get paginated results
        query += " ORDER BY rc.points_cost ASC, rp.priority DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cur.execute(query, params)
        rows = cur.fetchall()

        # Get unique categories
        cur.execute(
            """
            SELECT DISTINCT rp.category
            FROM rewards_catalog rc
            JOIN reward_partners rp ON rp.id = rc.partner_id
            WHERE rc.is_active = true AND rp.is_active = true
            """
        )
        categories = [PartnerCategory(r["category"]) for r in cur.fetchall()]

    rewards = []
    for r in rows:
        reward_id = str(r["id"])
        user_redemption_count = user_redemptions.get(reward_id, 0)
        can_afford = user_points >= r["points_cost"]
        can_redeem = can_afford and user_redemption_count < r["max_per_user"]

        rewards.append(RewardItem(
            id=reward_id,
            partner_id=str(r["partner_id"]),
            partner_name=r["partner_name"],
            partner_logo_url=r["partner_logo_url"],
            title=r["title"],
            description=r["description"],
            terms=r["terms"],
            reward_type=RewardType(r["reward_type"]),
            discount_percent=r["discount_percent"],
            discount_amount=r["discount_amount"],
            min_purchase_amount=r["min_purchase_amount"],
            points_cost=r["points_cost"],
            is_active=r["is_active"],
            stock_remaining=r["stock_remaining"],
            max_per_user=r["max_per_user"],
            valid_days=r["valid_days"],
            image_url=r["image_url"],
            available_from=r["available_from"],
            available_until=r["available_until"],
            user_can_afford=can_afford if user_id else False,
            user_redemptions_count=user_redemption_count,
            user_can_redeem=can_redeem if user_id else False,
        ))

    return RewardCatalogResponse(rewards=rewards, total=total, categories=categories)


# =============================================================================
# REDEMPTION
# =============================================================================

def redeem_reward(user_id: str, reward_id: str) -> RedeemRewardResponse:
    """
    Redeem a reward using points.

    Validates:
    - User has enough points
    - User hasn't exceeded max redemptions
    - Reward is still available
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get user's current points
        cur.execute(
            "SELECT total_points FROM user_loyalty_profiles WHERE user_id = %s FOR UPDATE",
            (user_id,)
        )
        profile = cur.fetchone()
        if not profile:
            ensure_loyalty_profile(user_id)
            cur.execute(
                "SELECT total_points FROM user_loyalty_profiles WHERE user_id = %s FOR UPDATE",
                (user_id,)
            )
            profile = cur.fetchone()

        user_points = profile["total_points"]

        # Get reward details
        cur.execute(
            """
            SELECT rc.*, rp.name as partner_name, rp.logo_url as partner_logo_url
            FROM rewards_catalog rc
            JOIN reward_partners rp ON rp.id = rc.partner_id
            WHERE rc.id = %s AND rc.is_active = true AND rp.is_active = true
            FOR UPDATE OF rc
            """,
            (reward_id,)
        )
        reward = cur.fetchone()

        if not reward:
            return RedeemRewardResponse(
                success=False,
                error="Награда не найдена или недоступна",
                new_balance=user_points,
            )

        # Check points
        if user_points < reward["points_cost"]:
            return RedeemRewardResponse(
                success=False,
                error=f"Недостаточно баллов. Требуется: {reward['points_cost']}, доступно: {user_points}",
                new_balance=user_points,
            )

        # Check stock
        if reward["stock_remaining"] is not None and reward["stock_remaining"] <= 0:
            return RedeemRewardResponse(
                success=False,
                error="Награда закончилась",
                new_balance=user_points,
            )

        # Check user's redemption count
        cur.execute(
            """
            SELECT COUNT(*) as count FROM reward_redemptions
            WHERE user_id = %s AND reward_id = %s AND status != 'cancelled'
            """,
            (user_id, reward_id)
        )
        redemption_count = cur.fetchone()["count"]

        if redemption_count >= reward["max_per_user"]:
            return RedeemRewardResponse(
                success=False,
                error=f"Вы уже использовали эту награду максимальное количество раз ({reward['max_per_user']})",
                new_balance=user_points,
            )

        # Generate voucher code
        cur.execute("SELECT generate_voucher_code() as code")
        voucher_code = cur.fetchone()["code"]

        # Calculate expiration
        expires_at = datetime.utcnow() + timedelta(days=reward["valid_days"])

        # Create redemption
        cur.execute(
            """
            INSERT INTO reward_redemptions (user_id, reward_id, points_spent, voucher_code, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (user_id, reward_id, reward["points_cost"], voucher_code, expires_at)
        )
        redemption_row = cur.fetchone()

        # Deduct points
        new_balance = user_points - reward["points_cost"]
        cur.execute(
            """
            UPDATE user_loyalty_profiles
            SET total_points = %s, updated_at = now()
            WHERE user_id = %s
            """,
            (new_balance, user_id)
        )

        # Create points transaction
        cur.execute(
            """
            INSERT INTO points_transactions (
                user_id, action_type, points, balance_after,
                description, reference_id, reference_type
            )
            VALUES (%s, 'reward_redemption', %s, %s, %s, %s, 'reward')
            """,
            (
                user_id,
                -reward["points_cost"],
                new_balance,
                f"Получен промокод: {reward['title']}",
                str(redemption_row["id"]),
            )
        )

        # Decrement stock if applicable
        if reward["stock_remaining"] is not None:
            cur.execute(
                "UPDATE rewards_catalog SET stock_remaining = stock_remaining - 1 WHERE id = %s",
                (reward_id,)
            )

        conn.commit()

        # Build response
        redemption = RewardRedemption(
            id=str(redemption_row["id"]),
            user_id=user_id,
            reward_id=str(reward_id),
            reward_title=reward["title"],
            partner_name=reward["partner_name"],
            partner_logo_url=reward["partner_logo_url"],
            reward_type=RewardType(reward["reward_type"]),
            points_spent=reward["points_cost"],
            voucher_code=voucher_code,
            status=RedemptionStatus.ACTIVE,
            expires_at=expires_at,
            created_at=redemption_row["created_at"],
        )

        logger.info(f"User {user_id} redeemed reward {reward_id} for {reward['points_cost']} points")

        return RedeemRewardResponse(
            success=True,
            redemption=redemption,
            new_balance=new_balance,
        )


def get_user_redemptions(
    user_id: str,
    status_filter: Optional[RedemptionStatus] = None,
    limit: int = 20,
    offset: int = 0,
) -> RedemptionHistoryResponse:
    """Get user's redemption history."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        query = """
            SELECT
                rr.id, rr.user_id, rr.reward_id, rr.points_spent,
                rr.voucher_code, rr.status, rr.used_at, rr.expires_at, rr.created_at,
                rc.title as reward_title, rc.reward_type,
                rp.name as partner_name, rp.logo_url as partner_logo_url
            FROM reward_redemptions rr
            JOIN rewards_catalog rc ON rc.id = rr.reward_id
            JOIN reward_partners rp ON rp.id = rc.partner_id
            WHERE rr.user_id = %s
        """
        params = [user_id]

        if status_filter:
            query += " AND rr.status = %s"
            params.append(status_filter.value)

        # Get total
        count_query = f"SELECT COUNT(*) as count FROM ({query}) sub"
        cur.execute(count_query, params)
        total = cur.fetchone()["count"]

        # Get paginated
        query += " ORDER BY rr.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cur.execute(query, params)
        rows = cur.fetchall()

    redemptions = [
        RewardRedemption(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            reward_id=str(r["reward_id"]),
            reward_title=r["reward_title"],
            partner_name=r["partner_name"],
            partner_logo_url=r["partner_logo_url"],
            reward_type=RewardType(r["reward_type"]),
            points_spent=r["points_spent"],
            voucher_code=r["voucher_code"],
            status=RedemptionStatus(r["status"]),
            used_at=r["used_at"],
            expires_at=r["expires_at"],
            created_at=r["created_at"],
        )
        for r in rows
    ]

    return RedemptionHistoryResponse(
        redemptions=redemptions,
        total=total,
        has_more=(offset + limit) < total,
    )


# =============================================================================
# ABUSE DETECTION
# =============================================================================

def record_abuse_signal(
    user_id: str,
    signal_type: AbuseSignalType,
    severity: AbuseSeverity,
    review_id: Optional[str] = None,
    description: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> AbuseSignal:
    """Record a detected abuse signal."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO abuse_signals (user_id, review_id, signal_type, severity, description, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (user_id, review_id, signal_type.value, severity.value, description, metadata)
        )
        row = cur.fetchone()
        conn.commit()

        # Auto-flag user if critical severity
        if severity == AbuseSeverity.CRITICAL:
            cur.execute(
                """
                UPDATE user_review_rate_limits
                SET is_flagged = true, flag_reason = %s, flagged_at = now()
                WHERE user_id = %s
                """,
                (f"Auto-flagged: {signal_type.value}", user_id)
            )
            conn.commit()

        logger.warning(f"Abuse signal recorded: user={user_id}, type={signal_type.value}, severity={severity.value}")

        return AbuseSignal(
            id=str(row["id"]),
            user_id=user_id,
            review_id=review_id,
            signal_type=signal_type,
            severity=severity,
            description=description,
            metadata=metadata,
            resolved=False,
            created_at=row["created_at"],
        )


def detect_rapid_submission(user_id: str, time_window_minutes: int = 5) -> bool:
    """Check if user is submitting reviews too quickly."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COUNT(*) as count FROM reviews
            WHERE author_user_id = %s
            AND created_at > now() - interval '%s minutes'
            """,
            (user_id, time_window_minutes)
        )
        count = cur.fetchone()["count"]

        if count >= 3:  # 3+ reviews in 5 minutes is suspicious
            record_abuse_signal(
                user_id=user_id,
                signal_type=AbuseSignalType.RAPID_SUBMISSION,
                severity=AbuseSeverity.MEDIUM,
                description=f"{count} reviews in {time_window_minutes} minutes",
            )
            return True

    return False


def detect_copy_paste(user_id: str, review_text: str) -> bool:
    """Check if review text is too similar to user's previous reviews."""
    # Simplified check - in production, use proper text similarity algorithms
    words = set(review_text.lower().split())
    if len(words) < 10:
        return False  # Too short to compare

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT body FROM reviews
            WHERE author_user_id = %s
            AND created_at > now() - interval '30 days'
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (user_id,)
        )
        rows = cur.fetchall()

        for row in rows:
            prev_words = set(row["body"].lower().split())
            if len(prev_words) < 10:
                continue

            # Calculate Jaccard similarity
            intersection = len(words & prev_words)
            union = len(words | prev_words)
            similarity = intersection / union if union > 0 else 0

            if similarity > 0.8:  # 80% similarity threshold
                record_abuse_signal(
                    user_id=user_id,
                    signal_type=AbuseSignalType.COPY_PASTE,
                    severity=AbuseSeverity.HIGH,
                    description=f"Review similarity: {similarity:.0%}",
                )
                return True

    return False


# =============================================================================
# USER OVERVIEW
# =============================================================================

def get_user_rewards_overview(user_id: str) -> UserRewardsOverview:
    """Get comprehensive rewards overview for a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get loyalty profile
        cur.execute(
            "SELECT total_points, lifetime_points, review_count FROM user_loyalty_profiles WHERE user_id = %s",
            (user_id,)
        )
        profile = cur.fetchone()

        if not profile:
            ensure_loyalty_profile(user_id)
            cur.execute(
                "SELECT total_points, lifetime_points, review_count FROM user_loyalty_profiles WHERE user_id = %s",
                (user_id,)
            )
            profile = cur.fetchone()

        # Calculate points spent
        cur.execute(
            """
            SELECT COALESCE(SUM(ABS(points)), 0) as spent
            FROM points_transactions
            WHERE user_id = %s AND points < 0
            """,
            (user_id,)
        )
        points_spent = cur.fetchone()["spent"]

        # Get review stats
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE points_awarded > 0) as earning_reviews,
                COALESCE(AVG(quality_score), 0) as avg_quality
            FROM reviews
            WHERE author_user_id = %s
            """,
            (user_id,)
        )
        review_stats = cur.fetchone()

        # Get voucher counts
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'used') as used,
                COUNT(*) FILTER (WHERE status = 'expired') as expired
            FROM reward_redemptions
            WHERE user_id = %s
            """,
            (user_id,)
        )
        voucher_counts = cur.fetchone()

        # Get rate limit status
        rate_limit = check_rate_limit(user_id)

        # Get recent redemptions
        redemptions_response = get_user_redemptions(user_id, limit=3)

        # Get suggested rewards (affordable)
        catalog = get_rewards_catalog(user_id=user_id, affordable_only=True, limit=3)

    return UserRewardsOverview(
        current_points=profile["total_points"],
        lifetime_points=profile["lifetime_points"],
        points_spent=points_spent,
        total_reviews=profile["review_count"],
        reviews_earning_points=review_stats["earning_reviews"],
        average_quality_score=float(review_stats["avg_quality"]),
        active_vouchers=voucher_counts["active"],
        used_vouchers=voucher_counts["used"],
        expired_vouchers=voucher_counts["expired"],
        rate_limit_status=rate_limit,
        recent_redemptions=redemptions_response.redemptions,
        suggested_rewards=catalog.rewards,
    )


# =============================================================================
# AWARD REVIEW POINTS (Enhanced)
# =============================================================================

def award_review_quality_points(
    user_id: str,
    review_id: str,
    review_text: str,
    photo_count: int = 0,
    video_count: int = 0,
    is_verified_purchase: bool = False,
) -> Optional[int]:
    """
    Award points for a review based on quality.

    Returns total points awarded, or None if rate-limited/abusive.
    """
    # Check rate limits
    rate_limit = check_rate_limit(user_id)
    if not rate_limit.allowed:
        logger.info(f"User {user_id} rate-limited: {rate_limit.reason}")
        return None

    # Check for abuse patterns
    if detect_rapid_submission(user_id):
        return None

    if detect_copy_paste(user_id, review_text):
        return None

    # Calculate word count
    word_count = count_words(review_text)

    # Calculate points
    request = PointsCalculationRequest(
        word_count=word_count,
        photo_count=photo_count,
        video_count=video_count,
        is_verified_purchase=is_verified_purchase,
    )
    result = calculate_review_points(request)
    total_points = result.breakdown.total_points

    if total_points <= 0:
        logger.info(f"Review {review_id} below minimum quality for points")
        return 0

    # Update review with quality info
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE reviews
            SET quality_score = %s, word_count = %s, points_awarded = %s
            WHERE id = %s
            """,
            (result.breakdown.quality_score, word_count, total_points, review_id)
        )
        conn.commit()

    # Award the points via loyalty service
    award_points(
        user_id=user_id,
        action_type=PointsActionType.REVIEW_APPROVED,  # Using existing action type
        reference_id=review_id,
        reference_type="review",
        description=f"Баллы за отзыв (качество: {result.breakdown.quality_score}/100)",
        custom_points=total_points,
    )

    # Increment rate limit counter
    increment_rate_limit(user_id)

    logger.info(
        f"Awarded {total_points} points to user {user_id} for review {review_id} "
        f"(quality: {result.breakdown.quality_score})"
    )

    return total_points
