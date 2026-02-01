"""
Loyalty Points Service.

Manages the gamification system for reviewers including:
- Points earning and spending
- Tier progression
- Streaks
- Leaderboards
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.loyalty import (
    POINTS_CONFIG,
    TIER_BENEFITS,
    TIER_THRESHOLDS,
    LeaderboardEntry,
    LeaderboardResponse,
    LoyaltyTier,
    PointsActionType,
    PointsHistoryResponse,
    PointsTransaction,
    UserLoyaltyProfile,
    UserLoyaltyResponse,
)

logger = logging.getLogger(__name__)


def _get_tier_from_points(lifetime_points: int) -> LoyaltyTier:
    """Calculate tier from lifetime points."""
    if lifetime_points >= TIER_THRESHOLDS[LoyaltyTier.PLATINUM]:
        return LoyaltyTier.PLATINUM
    elif lifetime_points >= TIER_THRESHOLDS[LoyaltyTier.GOLD]:
        return LoyaltyTier.GOLD
    elif lifetime_points >= TIER_THRESHOLDS[LoyaltyTier.SILVER]:
        return LoyaltyTier.SILVER
    return LoyaltyTier.BRONZE


def _get_next_tier(current_tier: LoyaltyTier) -> Optional[LoyaltyTier]:
    """Get the next tier after current."""
    tiers = [LoyaltyTier.BRONZE, LoyaltyTier.SILVER, LoyaltyTier.GOLD, LoyaltyTier.PLATINUM]
    try:
        idx = tiers.index(current_tier)
        if idx < len(tiers) - 1:
            return tiers[idx + 1]
    except ValueError:
        pass
    return None


def _calculate_tier_progress(lifetime_points: int, current_tier: LoyaltyTier) -> tuple[Optional[int], float]:
    """Calculate points needed for next tier and progress percentage."""
    next_tier = _get_next_tier(current_tier)
    if not next_tier:
        return None, 100.0

    current_threshold = TIER_THRESHOLDS[current_tier]
    next_threshold = TIER_THRESHOLDS[next_tier]

    points_in_tier = lifetime_points - current_threshold
    tier_range = next_threshold - current_threshold
    progress = (points_in_tier / tier_range) * 100 if tier_range > 0 else 100.0

    points_needed = next_threshold - lifetime_points
    return max(0, points_needed), min(100.0, max(0.0, progress))


def ensure_loyalty_profile(user_id: str) -> dict:
    """
    Ensure a loyalty profile exists for the user.
    Creates one if it doesn't exist.

    Returns the profile dict.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Try to get existing profile
        cur.execute(
            """
            SELECT * FROM user_loyalty_profiles WHERE user_id = %s
            """,
            (user_id,)
        )
        profile = cur.fetchone()

        if profile:
            return dict(profile)

        # Create new profile
        cur.execute(
            """
            INSERT INTO user_loyalty_profiles (user_id)
            VALUES (%s)
            RETURNING *
            """,
            (user_id,)
        )
        conn.commit()
        return dict(cur.fetchone())


def get_user_loyalty(user_id: str) -> UserLoyaltyResponse:
    """
    Get user's loyalty profile with recent transactions.

    Args:
        user_id: User UUID

    Returns:
        UserLoyaltyResponse with profile and recent transactions
    """
    profile_dict = ensure_loyalty_profile(user_id)

    current_tier = LoyaltyTier(profile_dict["current_tier"])
    next_tier = _get_next_tier(current_tier)
    points_to_next, progress = _calculate_tier_progress(
        profile_dict["lifetime_points"],
        current_tier
    )

    profile = UserLoyaltyProfile(
        user_id=str(profile_dict["user_id"]),
        total_points=profile_dict["total_points"],
        lifetime_points=profile_dict["lifetime_points"],
        current_tier=current_tier,
        next_tier=next_tier,
        points_to_next_tier=points_to_next,
        tier_progress_percent=progress,
        review_count=profile_dict["review_count"],
        helpful_votes_received=profile_dict["helpful_votes_received"],
        current_streak_weeks=profile_dict["current_streak_weeks"],
        longest_streak_weeks=profile_dict["longest_streak_weeks"],
        tier_benefits=TIER_BENEFITS[current_tier],
        created_at=profile_dict["created_at"],
        updated_at=profile_dict["updated_at"],
    )

    # Get recent transactions
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, action_type, points, balance_after,
                   description, reference_id, reference_type, created_at
            FROM points_transactions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (user_id,)
        )
        rows = cur.fetchall()

    recent_transactions = [
        PointsTransaction(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            action_type=PointsActionType(r["action_type"]),
            points=r["points"],
            balance_after=r["balance_after"],
            description=r["description"],
            reference_id=str(r["reference_id"]) if r["reference_id"] else None,
            reference_type=r["reference_type"],
            created_at=r["created_at"],
        )
        for r in rows
    ]

    return UserLoyaltyResponse(profile=profile, recent_transactions=recent_transactions)


def get_points_history(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> PointsHistoryResponse:
    """
    Get paginated points transaction history for a user.

    Args:
        user_id: User UUID
        limit: Max items per page
        offset: Pagination offset

    Returns:
        PointsHistoryResponse with transactions and pagination info
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get total count
        cur.execute(
            "SELECT COUNT(*) as count FROM points_transactions WHERE user_id = %s",
            (user_id,)
        )
        total = cur.fetchone()["count"]

        # Get transactions
        cur.execute(
            """
            SELECT id, user_id, action_type, points, balance_after,
                   description, reference_id, reference_type, created_at
            FROM points_transactions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset)
        )
        rows = cur.fetchall()

    transactions = [
        PointsTransaction(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            action_type=PointsActionType(r["action_type"]),
            points=r["points"],
            balance_after=r["balance_after"],
            description=r["description"],
            reference_id=str(r["reference_id"]) if r["reference_id"] else None,
            reference_type=r["reference_type"],
            created_at=r["created_at"],
        )
        for r in rows
    ]

    return PointsHistoryResponse(
        transactions=transactions,
        total=total,
        has_more=(offset + limit) < total,
    )


def award_points(
    user_id: str,
    action_type: PointsActionType,
    reference_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    description: Optional[str] = None,
    custom_points: Optional[int] = None,
    performed_by: Optional[str] = None,
) -> PointsTransaction:
    """
    Award points to a user for an action.

    Args:
        user_id: User to award points to
        action_type: Type of action that earned points
        reference_id: Optional reference (e.g., review_id)
        reference_type: Optional reference type (e.g., "review")
        description: Optional description
        custom_points: Override default points (for admin adjustments)
        performed_by: Admin user ID if manual adjustment

    Returns:
        The created transaction
    """
    # Get points value
    if custom_points is not None:
        points = custom_points
    else:
        points = POINTS_CONFIG.get(action_type, 0)

    if points == 0 and action_type not in (
        PointsActionType.ADMIN_ADJUSTMENT,
        PointsActionType.POINTS_REDEEMED,
        PointsActionType.POINTS_EXPIRED,
    ):
        logger.warning(f"No points configured for action type: {action_type}")
        return None

    # Ensure profile exists and update atomically
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Ensure profile exists
        cur.execute(
            """
            INSERT INTO user_loyalty_profiles (user_id)
            VALUES (%s)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id,)
        )

        # Get current balance and apply tier multiplier for earning
        cur.execute(
            "SELECT total_points, lifetime_points, current_tier FROM user_loyalty_profiles WHERE user_id = %s FOR UPDATE",
            (user_id,)
        )
        profile = cur.fetchone()

        # Apply tier multiplier for earning actions (not spending/adjustments)
        if points > 0:
            tier = LoyaltyTier(profile["current_tier"])
            multiplier = TIER_BENEFITS[tier]["points_multiplier"]
            points = int(points * multiplier)

        new_total = profile["total_points"] + points
        new_lifetime = profile["lifetime_points"] + max(0, points)  # Only positive adds to lifetime

        # Update profile
        cur.execute(
            """
            UPDATE user_loyalty_profiles
            SET total_points = %s,
                lifetime_points = %s,
                updated_at = now()
            WHERE user_id = %s
            """,
            (new_total, new_lifetime, user_id)
        )

        # Create transaction
        cur.execute(
            """
            INSERT INTO points_transactions (
                user_id, action_type, points, balance_after,
                description, reference_id, reference_type, performed_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, action_type, points, balance_after,
                      description, reference_id, reference_type, created_at
            """,
            (
                user_id, action_type.value, points, new_total,
                description, reference_id, reference_type, performed_by
            )
        )
        tx = cur.fetchone()
        conn.commit()

    logger.info(f"Awarded {points} points to user {user_id} for {action_type.value}")

    return PointsTransaction(
        id=str(tx["id"]),
        user_id=str(tx["user_id"]),
        action_type=PointsActionType(tx["action_type"]),
        points=tx["points"],
        balance_after=tx["balance_after"],
        description=tx["description"],
        reference_id=str(tx["reference_id"]) if tx["reference_id"] else None,
        reference_type=tx["reference_type"],
        created_at=tx["created_at"],
    )


def award_review_points(
    user_id: str,
    review_id: str,
    has_photo: bool = False,
    has_video: bool = False,
    is_first_review: bool = False,
) -> list[PointsTransaction]:
    """
    Award all applicable points for a review submission.

    Args:
        user_id: Author user ID
        review_id: The review ID
        has_photo: Whether review has photos
        has_video: Whether review has video
        is_first_review: Whether this is user's first review

    Returns:
        List of created transactions
    """
    transactions = []

    # Base points for submission
    tx = award_points(
        user_id=user_id,
        action_type=PointsActionType.REVIEW_SUBMITTED,
        reference_id=review_id,
        reference_type="review",
        description="Отзыв отправлен",
    )
    if tx:
        transactions.append(tx)

    # First review bonus
    if is_first_review:
        tx = award_points(
            user_id=user_id,
            action_type=PointsActionType.FIRST_REVIEW,
            reference_id=review_id,
            reference_type="review",
            description="Бонус за первый отзыв!",
        )
        if tx:
            transactions.append(tx)

    # Photo bonus
    if has_photo:
        tx = award_points(
            user_id=user_id,
            action_type=PointsActionType.REVIEW_WITH_PHOTO,
            reference_id=review_id,
            reference_type="review",
            description="Бонус за фото в отзыве",
        )
        if tx:
            transactions.append(tx)

    # Video bonus
    if has_video:
        tx = award_points(
            user_id=user_id,
            action_type=PointsActionType.REVIEW_WITH_VIDEO,
            reference_id=review_id,
            reference_type="review",
            description="Бонус за видео в отзыве",
        )
        if tx:
            transactions.append(tx)

    # Update review count and check streak
    _update_review_stats(user_id)

    return transactions


def award_review_approved_points(user_id: str, review_id: str) -> Optional[PointsTransaction]:
    """Award points when a review is approved by moderation."""
    return award_points(
        user_id=user_id,
        action_type=PointsActionType.REVIEW_APPROVED,
        reference_id=review_id,
        reference_type="review",
        description="Отзыв одобрен модерацией",
    )


def _update_review_stats(user_id: str) -> None:
    """Update review count and streak for a user."""
    from datetime import date

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get current week start (Monday)
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        # Get current profile
        cur.execute(
            "SELECT last_review_week, current_streak_weeks, longest_streak_weeks, review_count FROM user_loyalty_profiles WHERE user_id = %s",
            (user_id,)
        )
        profile = cur.fetchone()

        if not profile:
            return

        last_week = profile["last_review_week"]
        current_streak = profile["current_streak_weeks"]
        longest_streak = profile["longest_streak_weeks"]
        review_count = profile["review_count"]

        # Calculate new streak
        new_streak = current_streak
        if last_week is None:
            # First review ever
            new_streak = 1
        elif last_week == week_start:
            # Already reviewed this week, no change
            pass
        elif last_week == week_start - timedelta(weeks=1):
            # Consecutive week!
            new_streak = current_streak + 1
            # Award streak bonus
            award_points(
                user_id=user_id,
                action_type=PointsActionType.STREAK_BONUS,
                description=f"Бонус за {new_streak} недель подряд!",
            )
        else:
            # Streak broken
            new_streak = 1

        # Update profile
        cur.execute(
            """
            UPDATE user_loyalty_profiles
            SET review_count = review_count + 1,
                last_review_week = %s,
                current_streak_weeks = %s,
                longest_streak_weeks = GREATEST(longest_streak_weeks, %s),
                updated_at = now()
            WHERE user_id = %s
            """,
            (week_start, new_streak, new_streak, user_id)
        )
        conn.commit()


def vote_review_helpful(
    review_id: str,
    voter_user_id: str,
) -> bool:
    """
    Mark a review as helpful (upvote).

    Args:
        review_id: Review to upvote
        voter_user_id: User casting the vote

    Returns:
        True if vote was recorded, False if already voted
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Check if already voted
        cur.execute(
            "SELECT 1 FROM review_helpful_votes WHERE review_id = %s AND voter_user_id = %s",
            (review_id, voter_user_id)
        )
        if cur.fetchone():
            return False

        # Get review author
        cur.execute("SELECT author_user_id FROM reviews WHERE id = %s", (review_id,))
        review = cur.fetchone()
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )

        author_id = str(review["author_user_id"]) if review["author_user_id"] else None

        # Can't vote for own review
        if author_id == voter_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot vote for your own review"
            )

        # Record vote
        cur.execute(
            """
            INSERT INTO review_helpful_votes (review_id, voter_user_id)
            VALUES (%s, %s)
            """,
            (review_id, voter_user_id)
        )

        # Increment helpful count on review
        cur.execute(
            "UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = %s",
            (review_id,)
        )

        conn.commit()

    # Award points to review author
    if author_id:
        award_points(
            user_id=author_id,
            action_type=PointsActionType.REVIEW_HELPFUL_VOTE,
            reference_id=review_id,
            reference_type="review",
            description="Ваш отзыв отмечен как полезный",
        )

        # Update author's helpful votes count
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_loyalty_profiles
                SET helpful_votes_received = helpful_votes_received + 1,
                    updated_at = now()
                WHERE user_id = %s
                """,
                (author_id,)
            )
            conn.commit()

    return True


def remove_helpful_vote(review_id: str, voter_user_id: str) -> bool:
    """Remove a helpful vote from a review."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM review_helpful_votes
            WHERE review_id = %s AND voter_user_id = %s
            RETURNING review_id
            """,
            (review_id, voter_user_id)
        )
        deleted = cur.fetchone()

        if deleted:
            # Decrement count
            cur.execute(
                "UPDATE reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = %s",
                (review_id,)
            )
            conn.commit()
            return True

        return False


def get_leaderboard(
    period: str = "all_time",
    limit: int = 20,
    current_user_id: Optional[str] = None,
) -> LeaderboardResponse:
    """
    Get the points leaderboard.

    Args:
        period: "all_time", "monthly", or "weekly"
        limit: Number of entries to return
        current_user_id: Optional user to find their rank

    Returns:
        LeaderboardResponse with ranked entries
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build query based on period
        if period == "weekly":
            # Points earned in last 7 days
            points_query = """
                SELECT user_id, COALESCE(SUM(points), 0) as period_points
                FROM points_transactions
                WHERE created_at > now() - interval '7 days' AND points > 0
                GROUP BY user_id
            """
        elif period == "monthly":
            # Points earned in last 30 days
            points_query = """
                SELECT user_id, COALESCE(SUM(points), 0) as period_points
                FROM points_transactions
                WHERE created_at > now() - interval '30 days' AND points > 0
                GROUP BY user_id
            """
        else:
            # All-time uses lifetime_points
            points_query = """
                SELECT user_id, lifetime_points as period_points
                FROM user_loyalty_profiles
            """

        # Get leaderboard
        cur.execute(
            f"""
            WITH ranked AS (
                SELECT
                    p.user_id,
                    COALESCE(u.raw_user_meta_data->>'name', u.email) as display_name,
                    u.raw_user_meta_data->>'avatar_url' as avatar_url,
                    lp.lifetime_points as total_points,
                    lp.current_tier as tier,
                    lp.review_count,
                    pts.period_points,
                    ROW_NUMBER() OVER (ORDER BY pts.period_points DESC, lp.lifetime_points DESC) as rank
                FROM ({points_query}) pts
                JOIN user_loyalty_profiles lp ON lp.user_id = pts.user_id
                JOIN auth.users u ON u.id = pts.user_id
                JOIN profiles p ON p.id = pts.user_id
                WHERE pts.period_points > 0
            )
            SELECT * FROM ranked
            ORDER BY rank
            LIMIT %s
            """,
            (limit,)
        )
        rows = cur.fetchall()

        # Get total count
        cur.execute(
            f"""
            SELECT COUNT(DISTINCT user_id) as count
            FROM ({points_query}) pts
            WHERE pts.period_points > 0
            """
        )
        total = cur.fetchone()["count"]

        # Get current user's rank if provided
        user_rank = None
        if current_user_id:
            cur.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        user_id,
                        ROW_NUMBER() OVER (ORDER BY period_points DESC) as rank
                    FROM ({points_query}) pts
                    WHERE pts.period_points > 0
                )
                SELECT rank FROM ranked WHERE user_id = %s
                """,
                (current_user_id,)
            )
            rank_row = cur.fetchone()
            if rank_row:
                user_rank = rank_row["rank"]

    entries = [
        LeaderboardEntry(
            rank=r["rank"],
            user_id=str(r["user_id"]),
            display_name=r["display_name"] or "Anonymous",
            avatar_url=r["avatar_url"],
            total_points=r["total_points"],
            tier=LoyaltyTier(r["tier"]),
            review_count=r["review_count"],
        )
        for r in rows
    ]

    return LeaderboardResponse(
        entries=entries,
        user_rank=user_rank,
        total_users=total,
        period=period,
    )


def admin_adjust_points(
    target_user_id: str,
    points: int,
    reason: str,
    admin_user_id: str,
) -> PointsTransaction:
    """
    Admin function to manually adjust a user's points.

    Args:
        target_user_id: User to adjust points for
        points: Points to add (positive) or deduct (negative)
        reason: Reason for adjustment
        admin_user_id: Admin performing the adjustment

    Returns:
        The created transaction
    """
    return award_points(
        user_id=target_user_id,
        action_type=PointsActionType.ADMIN_ADJUSTMENT,
        custom_points=points,
        description=reason,
        performed_by=admin_user_id,
    )
